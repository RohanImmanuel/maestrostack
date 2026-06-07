import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Create a fresh temp directory for a test, returning helpers scoped to it. */
export async function makeTempProject(): Promise<{
  dir: string;
  /** Write a file (creating parent dirs); `rel` uses forward slashes. */
  write: (rel: string, contents?: string) => Promise<string>;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "maestrostack-"));

  const write = async (rel: string, contents = ""): Promise<string> => {
    const abs = path.join(dir, ...rel.split("/"));
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
    return abs;
  };

  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };

  return { dir, write, cleanup };
}

/** A minimal valid config object (matches the Zod schema after defaults). */
export function validConfigYaml(overrides = ""): string {
  return `version: 1
auth:
  username: user
  accessKey: key
platform: android
app:
  source: upload
  path: ./apps/app.apk
suite:
  root: .
  include:
    - "smoke/**/*.yml"
run:
  project: Demo
  devices:
    - "Google Pixel 7-13.0"
  executeMode: explicit
  execute:
    - smoke/login.yml
${overrides}`;
}
