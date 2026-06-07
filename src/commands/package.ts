import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import { createZip } from "../suite/createZip.js";
import { logger } from "../utils/logger.js";
import { validateAll, type GlobalOptions } from "./validate.js";

/**
 * Discover flows and create the suite zip without uploading. Useful for
 * debugging the resulting archive structure.
 */
export async function packageCommand(opts: GlobalOptions): Promise<void> {
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

  logger.info(`Created suite zip: ${path.relative(cwd, zipPath) || zipPath}`);
  logger.info("Included flows:");
  for (const flow of flows) {
    logger.info(`- ${flow}`);
  }
}
