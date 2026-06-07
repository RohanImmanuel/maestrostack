import path from "node:path";

/**
 * Internal working directory MaestroStack writes to. Relative to the current
 * working directory so it lands next to the user's project. Should be gitignored.
 */
export const WORK_DIR = ".maestrostack";

/** Directory for build artifacts (the generated suite zip). */
export function distDir(cwd: string = process.cwd()): string {
  return path.join(cwd, WORK_DIR, "dist");
}

/** Directory for transient files. */
export function tmpDir(cwd: string = process.cwd()): string {
  return path.join(cwd, WORK_DIR, "tmp");
}

/**
 * Convert a path into the forward-slash form used internally and by BrowserStack
 * (zip entries, execute paths). Both separators are normalized so a config or
 * `--execute` value authored on Windows (`smoke\login.yml`) matches discovered
 * flows regardless of the OS MaestroStack runs on.
 */
export function toPosix(p: string): string {
  return p.split(/[\\/]+/).join("/");
}
