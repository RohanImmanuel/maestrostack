import path from "node:path";
import fg from "fast-glob";
import type { Config } from "../config/schema.js";
import { MaestroStackError } from "../utils/errors.js";
import { isDirectory } from "../utils/fs.js";

export interface DiscoverOptions {
  /** Working directory the suite root is resolved against. */
  cwd?: string;
  /** Basename of the active config file, always excluded from the suite. */
  configBasename?: string;
}

/**
 * Always-on ignore patterns. Root-level YAML files are treated as config files,
 * not Maestro flows (top-level only - `*.yml` matches `staging.yml` but not
 * `smoke/login.yml`). Build/VCS/dependency dirs are never packaged.
 */
const BUILT_IN_IGNORES = [
  "*.yml",
  "*.yaml",
  ".git/**",
  "node_modules/**",
  ".maestrostack/**",
];

/**
 * Discover Maestro flow files under `suite.root` using the configured include /
 * exclude globs. Returns sorted, forward-slash relative paths (fast-glob emits
 * POSIX separators on every OS, keeping output identical across platforms).
 */
export async function discoverFlows(
  suite: Config["suite"],
  opts: DiscoverOptions = {},
): Promise<string[]> {
  const cwd = opts.cwd ?? process.cwd();
  const root = path.resolve(cwd, suite.root);

  if (!(await isDirectory(root))) {
    throw new MaestroStackError(`suite.root does not exist: ${suite.root}`);
  }

  const ignore = [...BUILT_IN_IGNORES, ...suite.exclude];
  if (opts.configBasename) {
    ignore.push(opts.configBasename);
  }

  const matches = await fg(suite.include, {
    cwd: root,
    ignore,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });

  if (matches.length === 0) {
    throw new MaestroStackError("No Maestro flow files found.", [
      "Maestro flow files should live inside subfolders (root-level YAML files are ignored).",
      `Checked suite.root="${suite.root}" with include=${JSON.stringify(suite.include)}.`,
    ]);
  }

  return matches.sort();
}
