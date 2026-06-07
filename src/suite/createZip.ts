import { createWriteStream } from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { ensureDir } from "../utils/fs.js";
import { distDir } from "../utils/paths.js";

export interface ZipResult {
  /** Absolute path to the written zip file. */
  zipPath: string;
  /** Forward-slash flow paths that were included (relative to suite root). */
  files: string[];
}

/** Top-level folder inside the archive. BrowserStack locates flows under this. */
export const SUITE_PREFIX = "Flows";

/**
 * Create the suite zip from the given flow files. Each entry is stored under
 * `Flows/<relativePath>` using forward slashes (required by the ZIP spec and so
 * BrowserStack can locate flows regardless of the host OS that built the zip).
 */
export async function createZip(options: {
  files: string[];
  suiteRoot: string;
  packageName: string;
  cwd?: string;
}): Promise<ZipResult> {
  const cwd = options.cwd ?? process.cwd();
  const root = path.resolve(cwd, options.suiteRoot);
  const outDir = distDir(cwd);
  await ensureDir(outDir);
  const zipPath = path.join(outDir, options.packageName);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") return; // non-fatal
      reject(err);
    });

    archive.pipe(output);

    for (const rel of options.files) {
      // `rel` is already forward-slash (from discoverFlows); resolve to the OS
      // path for reading, but name the entry with forward slashes.
      const absolute = path.join(root, ...rel.split("/"));
      const entryName = `${SUITE_PREFIX}/${rel}`;
      archive.file(absolute, { name: entryName });
    }

    void archive.finalize();
  });

  return { zipPath, files: options.files };
}
