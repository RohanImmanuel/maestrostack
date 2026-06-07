import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import type { Config } from "../config/schema.js";
import { uploadApp } from "../browserstack/uploadApp.js";
import { uploadSuite } from "../browserstack/uploadSuite.js";
import { buildPath, buildPayload, startBuild } from "../browserstack/startBuild.js";
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
}

const APP_PLACEHOLDER = "<resolved after upload>";
const SUITE_PLACEHOLDER = "<resolved after upload>";

/** Apply CLI overrides for devices / execute onto a loaded config. */
export function applyOverrides(config: Config, opts: RunOptions): Config {
  let run = config.run;
  if (opts.device && opts.device.length > 0) {
    run = { ...run, devices: opts.device };
  }
  if (opts.execute && opts.execute.length > 0) {
    run = { ...run, execute: opts.execute.map(toPosix), executeMode: "explicit" };
  }
  return { ...config, run };
}

export async function runCommand(opts: RunOptions): Promise<void> {
  const cwd = process.cwd();
  const loaded = await loadConfig(opts.config, cwd);
  const config = applyOverrides(loaded.config, opts);

  // Validate with overrides applied.
  const { flows } = await validateAll({ ...loaded, config }, cwd);

  if (opts.dryRun) {
    printDryRun(config, flows, cwd);
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

  // 3. Upload the suite.
  logger.info(`Uploading test suite (${flows.length} flow(s)) ...`);
  const suiteResult = await uploadSuite({
    auth: config.auth,
    zipPath,
    customId: config.suite.customId,
  });

  // 4. Trigger the build.
  const payload = buildPayload(config, {
    app: appUrl,
    testSuite: suiteResult.test_suite_url,
  });
  logger.info(`Starting ${config.platform} build ...`);
  const build = await startBuild({ auth: config.auth, platform: config.platform, payload });

  printSummary(config, appUrl, suiteResult.test_suite_url, build.build_id);
}

async function resolveApp(config: Config, cwd: string): Promise<string> {
  const { app } = config;
  if (app.source === "app_url") {
    return app.appUrl;
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
  throw new MaestroStackError(`Unsupported app.source: ${app.source}`);
}

function previewApp(config: Config): string {
  const { app } = config;
  return app.source === "app_url" ? app.appUrl : APP_PLACEHOLDER;
}

function printDryRun(config: Config, flows: string[], cwd: string): void {
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
  }
  logger.info("");

  logger.info(`Would call:\nPOST ${buildPath(config.platform)}`);
  logger.info("");

  const payload = buildPayload(config, {
    app: previewApp(config),
    testSuite: SUITE_PLACEHOLDER,
  });
  logger.info("Payload:");
  logger.info(JSON.stringify(payload, null, 2));
}

function printSummary(
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
}
