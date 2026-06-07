import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import { uploadApp } from "../browserstack/uploadApp.js";
import { MaestroStackError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { validateApp, type GlobalOptions } from "./validate.js";

/**
 * Upload only the app and print the resulting BrowserStack app_url. Only valid
 * for app.source: upload.
 */
export async function uploadAppCommand(opts: GlobalOptions): Promise<void> {
  const cwd = process.cwd();
  const { config } = await loadConfig(opts.config, cwd);
  await validateApp(config, cwd);

  if (config.app.source !== "upload") {
    throw new MaestroStackError(
      `upload-app requires app.source "upload" (current: "${config.app.source}").`,
    );
  }

  const filePath = path.resolve(cwd, config.app.path);
  logger.info(`Uploading app: ${config.app.path} ...`);

  const result = await uploadApp({
    auth: config.auth,
    filePath,
    customId: config.app.customId,
  });

  logger.info("Uploaded app:");
  logger.info(`app_url: ${result.app_url}`);
  if (result.custom_id) logger.info(`custom_id: ${result.custom_id}`);
  if (result.expiry) logger.info(`expires: ${result.expiry}`);
}
