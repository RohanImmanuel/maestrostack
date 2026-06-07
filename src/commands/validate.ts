import path from "node:path";
import type { Config } from "../config/schema.js";
import { loadConfig, type LoadedConfig } from "../config/loadConfig.js";
import { discoverFlows } from "../suite/discoverFlows.js";
import { validateSuite } from "../suite/validateSuite.js";
import { MaestroStackError } from "../utils/errors.js";
import { extname, isFile } from "../utils/fs.js";
import { logger } from "../utils/logger.js";

export interface GlobalOptions {
  config?: string;
  debug?: boolean;
}

const PLATFORM_EXT: Record<Config["platform"], string> = {
  android: ".apk",
  ios: ".ipa",
};

/**
 * Semantic validation of the app block beyond the Zod schema: file existence and
 * platform/extension agreement. (app_url and custom_id reference an existing
 * BrowserStack app, so there is nothing local to check.)
 */
export async function validateApp(config: Config, cwd: string): Promise<void> {
  const { app, platform } = config;

  if (app.source === "upload") {
    const appPath = path.resolve(cwd, app.path);
    if (!(await isFile(appPath))) {
      throw new MaestroStackError(`app.path does not exist: ${app.path}`);
    }
    const expected = PLATFORM_EXT[platform];
    if (extname(appPath) !== expected) {
      throw new MaestroStackError(
        `Platform "${platform}" requires a ${expected} file, but app.path is "${app.path}".`,
      );
    }
  }
}

/**
 * Full validation pipeline shared by `validate` and `run`: app block, flow
 * discovery and suite/execute checks. Returns the discovered flow paths.
 */
export async function validateAll(
  loaded: LoadedConfig,
  cwd: string,
): Promise<{ flows: string[] }> {
  const { config, configPath } = loaded;
  await validateApp(config, cwd);

  const flows = await discoverFlows(config.suite, {
    cwd,
    configBasename: path.basename(configPath),
  });

  await validateSuite(config, flows, cwd);

  return { flows };
}

export async function validateCommand(opts: GlobalOptions): Promise<void> {
  const cwd = process.cwd();
  const loaded = await loadConfig(opts.config, cwd);
  const { flows } = await validateAll(loaded, cwd);
  const { config } = loaded;

  logger.info("Configuration is valid.");
  logger.info("");
  logger.info(`Config:    ${path.relative(cwd, loaded.configPath) || loaded.configPath}`);
  logger.info(`Platform:  ${config.platform}`);
  logger.info(`Project:   ${config.run.project}`);
  logger.info(`App:       ${describeApp(config)}`);
  logger.info(`Devices:   ${config.run.devices.length}`);
  for (const device of config.run.devices) {
    logger.info(`  - ${device}`);
  }
  logger.info(`Flows:     ${flows.length}`);
  for (const flow of flows) {
    logger.info(`  - ${flow}`);
  }
  logger.info(`Execute:   ${config.run.executeMode}`);
}

function describeApp(config: Config): string {
  const { app } = config;
  if (app.source === "upload") return `upload ${app.path}`;
  if (app.source === "app_url") return `app_url ${app.appUrl}`;
  return `custom_id ${app.customId}`;
}
