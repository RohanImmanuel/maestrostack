import { loadConfig } from "../config/loadConfig.js";
import { uploadSuite } from "../browserstack/uploadSuite.js";
import { createZip } from "../suite/createZip.js";
import { logger } from "../utils/logger.js";
import { validateAll, type GlobalOptions } from "./validate.js";

/** Package and upload only the Maestro suite, printing the test_suite_url. */
export async function uploadSuiteCommand(opts: GlobalOptions): Promise<void> {
  const cwd = process.cwd();
  const loaded = await loadConfig(opts.config, cwd);
  const { config } = loaded;
  const { flows } = await validateAll(loaded, cwd);

  const { zipPath } = await createZip({
    files: flows,
    suiteRoot: config.suite.root,
    packageName: config.suite.packageName,
    cwd,
  });

  logger.info(`Uploading test suite (${flows.length} flow(s)) ...`);

  const result = await uploadSuite({
    auth: config.auth,
    zipPath,
    customId: config.suite.customId,
  });

  logger.info("Uploaded test suite:");
  logger.info(`test_suite_url: ${result.test_suite_url}`);
  if (result.custom_id) logger.info(`custom_id: ${result.custom_id}`);
  if (result.expiry) logger.info(`expires: ${result.expiry}`);
}
