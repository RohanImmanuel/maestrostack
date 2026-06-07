import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configSchema } from "../config/schema.js";
import { makeTempProject } from "../test/helpers.js";
import { initCommand } from "./init.js";

let project: Awaited<ReturnType<typeof makeTempProject>>;
let originalCwd: string;

beforeEach(async () => {
  project = await makeTempProject();
  originalCwd = process.cwd();
  process.chdir(project.dir);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
  await project.cleanup();
});

async function readConfig(): Promise<unknown> {
  const raw = await readFile(path.join(project.dir, "maestrostack.yml"), "utf8");
  return parseYaml(raw);
}

describe("initCommand", () => {
  it("writes a valid android config by default", async () => {
    await initCommand({});
    const parsed = (await readConfig()) as Record<string, unknown>;
    expect(parsed.platform).toBe("android");
    // The template is valid except for unresolved ${ENV} tokens; check structure.
    expect(parsed.run).toBeDefined();
  });

  it("writes an ios config with --ios", async () => {
    await initCommand({ ios: true });
    const parsed = (await readConfig()) as Record<string, unknown>;
    expect(parsed.platform).toBe("ios");
    const app = parsed.app as Record<string, string>;
    expect(app.path).toContain(".ipa");
  });

  it("refuses to overwrite without --force", async () => {
    await initCommand({});
    await expect(initCommand({})).rejects.toThrow(/already exists/);
  });

  it("overwrites with --force", async () => {
    await initCommand({});
    await expect(initCommand({ force: true })).resolves.toBeUndefined();
  });

  it("rejects passing both --android and --ios", async () => {
    await expect(initCommand({ android: true, ios: true })).rejects.toThrow(
      /only one of/,
    );
  });

  it("produces a config that passes schema validation once env is substituted", async () => {
    await initCommand({});
    const raw = (await readFile(path.join(project.dir, "maestrostack.yml"), "utf8"))
      .replace("${BROWSERSTACK_USERNAME}", "u")
      .replace("${BROWSERSTACK_ACCESS_KEY}", "k");
    expect(() => configSchema.parse(parseYaml(raw))).not.toThrow();
  });
});
