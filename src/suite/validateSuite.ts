import path from "node:path";
import type { Config } from "../config/schema.js";
import { MaestroStackError } from "../utils/errors.js";
import { isFile } from "../utils/fs.js";
import { toPosix } from "../utils/paths.js";

export const MAIN_FLOW = "main.yaml";

/**
 * Validate the suite against the discovered flow set and the configured execute
 * mode.
 *
 * - explicit mode: every `run.execute` path must exist in the discovered flows.
 * - main mode: a `main.yaml` must exist at the suite root.
 *
 * `discovered` paths are forward-slash relative to the suite root; execute paths
 * supplied by users are normalized so Windows-style separators still match.
 */
export async function validateSuite(
  config: Config,
  discovered: string[],
  cwd: string = process.cwd(),
): Promise<void> {
  const { run, suite } = config;

  if (run.executeMode === "main") {
    const mainPath = path.resolve(cwd, suite.root, MAIN_FLOW);
    if (!(await isFile(mainPath))) {
      throw new MaestroStackError(
        `executeMode is "main" but ${MAIN_FLOW} was not found in suite.root (${suite.root}).`,
        [`Add a ${MAIN_FLOW} or switch to executeMode: explicit with a run.execute list.`],
      );
    }
    return;
  }

  // explicit mode
  if (run.execute && run.execute.length > 0) {
    const available = new Set(discovered.map(toPosix));
    const missing = run.execute
      .map(toPosix)
      .filter((p) => !available.has(p));

    if (missing.length > 0) {
      throw new MaestroStackError(
        "Configured execute file(s) do not exist in the packaged suite:",
        missing.map((p) => `- ${p}`),
      );
    }
  }
}
