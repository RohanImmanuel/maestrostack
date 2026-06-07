import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import type { Config } from "../config/schema.js";
import { uploadApp } from "../browserstack/uploadApp.js";
import { uploadSuite } from "../browserstack/uploadSuite.js";
import { buildDashboardUrl, buildPath, buildPayload, startBuild } from "../browserstack/startBuild.js";
import { pollBuild } from "../browserstack/buildStatus.js";
import { createZip } from "../suite/createZip.js";
import { MaestroStackError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { toPosix } from "../utils/paths.js";
import { validateAll, type GlobalOptions } from "./validate.js";

export interface RunOptions extends GlobalOptions {
  dryRun?: boolean;
  /** Temporary device override(s); replaces run.devices. */
  device?: string[];
  /** Temporary execute override(s); replaces run.execute (forces explicit mode). */
  execute?: string[];
  /** Temporary max-parallel override; replaces run.maxParallel. */
  maxParallel?: number;
}

const APP_PLACEHOLDER = "<resolved after upload>";
const SUITE_PLACEHOLDER = "<resolved after upload>";

/** Apply CLI overrides for devices / execute / maxParallel onto a loaded config. */
export function applyOverrides(config: Config, opts: RunOptions): Config {
  let run = config.run;
  if (opts.device && opts.device.length > 0) {
    run = { ...run, devices: opts.device };
  }
  if (opts.execute && opts.execute.length > 0) {
    run = { ...run, execute: opts.execute.map(toPosix), executeMode: "explicit" };
  }
  if (opts.maxParallel !== undefined && Number.isFinite(opts.maxParallel)) {
    run = { ...run, maxParallel: opts.maxParallel };
  }
  return { ...config, run };
}

/**
 * Split the device list into sequential batches. With `maxParallel` set (and
 * smaller than the device count), each batch holds at most `maxParallel` devices
 * so no more than that many run at once. Otherwise there is a single batch with
 * every device.
 */
export function deviceBatches(devices: string[], maxParallel?: number): string[][] {
  if (!maxParallel || maxParallel < 1 || maxParallel >= devices.length) {
    return [devices];
  }
  const batches: string[][] = [];
  for (let i = 0; i < devices.length; i += maxParallel) {
    batches.push(devices.slice(i, i + maxParallel));
  }
  return batches;
}

export async function runCommand(opts: RunOptions): Promise<void> {
  const cwd = process.cwd();
  const loaded = await loadConfig(opts.config, cwd);
  const config = applyOverrides(loaded.config, opts);

  // Validate with overrides applied.
  const { flows } = await validateAll({ ...loaded, config }, cwd);

  const batches = deviceBatches(config.run.devices, config.run.maxParallel);

  if (opts.dryRun) {
    printDryRun(config, flows, batches);
    return;
  }

  // 1. Package the suite.
  const { zipPath } = await createZip({
    files: flows,
    suiteRoot: config.suite.root,
    packageName: config.suite.packageName,
    cwd,
  });
  logger.debug(`Created suite zip: ${zipPath}`);

  // 2. Resolve the app (upload local binary or use an existing bs:// url).
  const appUrl = await resolveApp(config, cwd);
  logger.debug(`Resolved app: ${appUrl}`);

  // 3. Upload the suite once; every batch reuses it.
  logger.info(`Uploading test suite (${flows.length} flow(s)) ...`);
  const suiteResult = await uploadSuite({
    auth: config.auth,
    zipPath,
    customId: config.suite.customId,
  });
  const testSuiteUrl = suiteResult.test_suite_url;

  // 4. Trigger build(s).
  if (batches.length === 1) {
    const payload = buildPayload(config, { app: appUrl, testSuite: testSuiteUrl }, batches[0]);
    logger.info(`Starting ${config.platform} build ...`);
    const build = await startBuild({ auth: config.auth, platform: config.platform, payload });
    printSingleSummary(config, appUrl, testSuiteUrl, build.build_id);
    return;
  }

  // Multiple batches: submit one build per batch and wait for it to finish
  // before starting the next, so at most maxParallel devices run at once.
  logger.info(
    `Running ${config.run.devices.length} device(s) in ${batches.length} sequential ` +
      `batch(es) of up to ${config.run.maxParallel}.`,
  );
  logger.info(`App: ${appUrl}`);
  logger.info(`Test suite: ${testSuiteUrl}`);

  const results: { buildId: string; status: string; devices: string[] }[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const label = `Batch ${i + 1}/${batches.length}`;
    const payload = buildPayload(config, { app: appUrl, testSuite: testSuiteUrl }, batch);
    logger.info("");
    logger.info(`${label}: starting build on ${batch.join(", ")} ...`);
    const build = await startBuild({ auth: config.auth, platform: config.platform, payload });
    logger.info(`${label}: build ${build.build_id} running, waiting for it to finish ...`);
    logger.info(`${label}: ${buildDashboardUrl(build.build_id)}`);

    const status = await pollBuild({
      auth: config.auth,
      buildId: build.build_id,
      onStatus: (s) => logger.debug(`${label} status: ${s}`),
    });
    logger.info(`${label}: finished with status "${status}".`);
    results.push({ buildId: build.build_id, status, devices: batch });
  }

  printBatchSummary(config, appUrl, testSuiteUrl, results);
}

async function resolveApp(config: Config, cwd: string): Promise<string> {
  const { app } = config;
  if (app.source === "app_url") {
    return app.appUrl;
  }
  if (app.source === "custom_id") {
    // BrowserStack resolves a custom_id to the latest app uploaded with that id.
    return app.customId;
  }
  if (app.source === "upload") {
    logger.info(`Uploading app: ${app.path} ...`);
    const result = await uploadApp({
      auth: config.auth,
      filePath: path.resolve(cwd, app.path),
      customId: app.customId,
    });
    return result.app_url;
  }
  throw new MaestroStackError("Unsupported app source.");
}

function previewApp(config: Config): string {
  const { app } = config;
  if (app.source === "app_url") return app.appUrl;
  if (app.source === "custom_id") return app.customId;
  return APP_PLACEHOLDER;
}

function printDryRun(config: Config, flows: string[], batches: string[][]): void {
  logger.info("Dry run only. No API calls made.");
  logger.info("");
  logger.info("Would package:");
  for (const flow of flows) {
    logger.info(`- ${flow}`);
  }
  logger.info("");

  const { app } = config;
  if (app.source === "upload") {
    logger.info(`Would upload app:\n${app.path}`);
  } else if (app.source === "app_url") {
    logger.info(`Would use app:\n${app.appUrl}`);
  } else if (app.source === "custom_id") {
    logger.info(`Would use app (custom_id):\n${app.customId}`);
  }
  logger.info("");

  if (batches.length > 1) {
    logger.info(
      `Would submit ${batches.length} builds sequentially ` +
        `(max ${config.run.maxParallel} device(s) at once), waiting for each to finish:`,
    );
    batches.forEach((batch, i) => {
      logger.info(`  Batch ${i + 1}: ${batch.join(", ")}`);
    });
  } else {
    logger.info("Would submit 1 build on all devices.");
  }
  logger.info("");

  logger.info(`Would call:\nPOST ${buildPath(config.platform)}`);
  logger.info("");

  const payload = buildPayload(
    config,
    { app: previewApp(config), testSuite: SUITE_PLACEHOLDER },
    batches[0],
  );
  logger.info(batches.length > 1 ? "Payload (batch 1):" : "Payload:");
  logger.info(JSON.stringify(payload, null, 2));
}

function printSingleSummary(
  config: Config,
  appUrl: string,
  testSuiteUrl: string,
  buildId: string,
): void {
  logger.info("");
  logger.info("MaestroStack run started");
  logger.info("");
  logger.info(`Project: ${config.run.project}`);
  logger.info(`Platform: ${config.platform}`);
  logger.info("Devices:");
  for (const device of config.run.devices) {
    logger.info(`- ${device}`);
  }
  logger.info("");
  logger.info(`App: ${appUrl}`);
  logger.info(`Test suite: ${testSuiteUrl}`);
  logger.info(`Build ID: ${buildId}`);
  logger.info(`Build URL: ${buildDashboardUrl(buildId)}`);
}

function printBatchSummary(
  config: Config,
  appUrl: string,
  testSuiteUrl: string,
  results: { buildId: string; status: string; devices: string[] }[],
): void {
  logger.info("");
  logger.info("MaestroStack run complete");
  logger.info("");
  logger.info(`Project: ${config.run.project}`);
  logger.info(`Platform: ${config.platform}`);
  logger.info(`App: ${appUrl}`);
  logger.info(`Test suite: ${testSuiteUrl}`);
  logger.info("");
  logger.info("Builds:");
  for (const r of results) {
    logger.info(`- ${r.buildId} [${r.status}] on ${r.devices.join(", ")}`);
    logger.info(`  ${buildDashboardUrl(r.buildId)}`);
  }
}
