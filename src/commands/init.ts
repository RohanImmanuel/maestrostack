import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Platform } from "../config/schema.js";
import { MaestroStackError } from "../utils/errors.js";
import { pathExists } from "../utils/fs.js";
import { logger } from "../utils/logger.js";

export interface InitOptions {
  android?: boolean;
  ios?: boolean;
  force?: boolean;
}

const CONFIG_NAME = "maestrostack.yml";

/** Create a starter maestrostack.yml. */
export async function initCommand(opts: InitOptions): Promise<void> {
  if (opts.android && opts.ios) {
    throw new MaestroStackError("Pass only one of --android or --ios.");
  }
  const platform: Platform = opts.ios ? "ios" : "android";

  const cwd = process.cwd();
  const target = path.join(cwd, CONFIG_NAME);

  if ((await pathExists(target)) && !opts.force) {
    throw new MaestroStackError(`${CONFIG_NAME} already exists.`, [
      "Use --force to overwrite it.",
    ]);
  }

  await writeFile(target, template(platform), "utf8");
  logger.info(`Created ${CONFIG_NAME} (platform: ${platform}).`);
  logger.info("Next: set BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY, then run `maestrostack validate`.");
}

function template(platform: Platform): string {
  const appPath = platform === "ios" ? "./apps/app-release.ipa" : "./apps/app-release.apk";
  const devices =
    platform === "ios"
      ? ["iPhone 15-17.0"]
      : ["Samsung Galaxy S20-10.0", "Google Pixel 7-13.0"];

  const deviceLines = devices.map((d) => `    - ${d}`).join("\n");

  // Always \n line endings so the file is identical across platforms.
  return [
    "version: 1",
    "",
    "auth:",
    "  username: ${BROWSERSTACK_USERNAME}",
    "  accessKey: ${BROWSERSTACK_ACCESS_KEY}",
    "",
    `platform: ${platform}`,
    "",
    "app:",
    "  source: upload",
    `  path: ${appPath}`,
    "  customId: SampleApp",
    "",
    "suite:",
    "  root: .",
    "  packageName: Flows.zip",
    "  customId: SampleTest",
    "  include:",
    "    - smoke/**/*.yml",
    "    - regression/**/*.yml",
    "  exclude:",
    "    - apps/**",
    "",
    "run:",
    "  project: Maestro_Test",
    "  devices:",
    deviceLines,
    "  executeMode: explicit",
    "  execute:",
    "    - smoke/login.yml",
    "  options:",
    "    networkLogs: true",
    "    deviceLogs: true",
    "",
  ].join("\n");
}
