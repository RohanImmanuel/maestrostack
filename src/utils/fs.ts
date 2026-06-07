import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

/** Returns true if a file or directory exists at `p`. */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Returns true if `p` exists and is a regular file. */
export async function isFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Returns true if `p` exists and is a directory. */
export async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Creates a directory (and parents) if it does not already exist. */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Removes a directory tree if present; no-op if missing. */
export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Lower-cased file extension including the dot (e.g. ".apk"). */
export function extname(p: string): string {
  return path.extname(p).toLowerCase();
}
