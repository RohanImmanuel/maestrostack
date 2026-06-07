import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTempProject, validConfigYaml } from "../test/helpers.js";
import { MaestroStackError } from "../utils/errors.js";
import { loadConfig, resolveConfigPath } from "./loadConfig.js";

/** Capture a thrown MaestroStackError and return its message + details joined. */
async function errorText(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof MaestroStackError) {
      return [err.message, ...(err.details ?? [])].join("\n");
    }
    return String(err);
  }
  throw new Error("expected the function to throw");
}

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

describe("resolveConfigPath", () => {
  it("finds maestrostack.yml by default", async () => {
    const p = await project.write("maestrostack.yml", validConfigYaml());
    await expect(resolveConfigPath(undefined, project.dir)).resolves.toBe(p);
  });

  it("falls back to maestrostack.yaml", async () => {
    const p = await project.write("maestrostack.yaml", validConfigYaml());
    await expect(resolveConfigPath(undefined, project.dir)).resolves.toBe(p);
  });

  it("errors when no config exists", async () => {
    await expect(resolveConfigPath(undefined, project.dir)).rejects.toThrow(
      /maestrostack\.yml not found/,
    );
  });

  it("errors when an explicit config is missing", async () => {
    await expect(resolveConfigPath("missing.yml", project.dir)).rejects.toThrow(
      /Config file not found/,
    );
  });
});

describe("loadConfig", () => {
  it("loads and validates a correct config", async () => {
    await project.write("maestrostack.yml", validConfigYaml());
    const { config } = await loadConfig(undefined, project.dir);
    expect(config.platform).toBe("android");
    expect(config.run.devices).toEqual(["Google Pixel 7-13.0"]);
  });

  it("substitutes env vars before parsing", async () => {
    process.env.MS_TEST_USER = "envuser";
    await project.write(
      "maestrostack.yml",
      validConfigYaml().replace("username: user", "username: ${MS_TEST_USER}"),
    );
    const { config } = await loadConfig(undefined, project.dir);
    expect(config.auth.username).toBe("envuser");
    delete process.env.MS_TEST_USER;
  });

  it("reports invalid YAML", async () => {
    await project.write("maestrostack.yml", "version: 1\n  bad: : :");
    await expect(loadConfig(undefined, project.dir)).rejects.toThrow(/Invalid YAML/);
  });

  it("rejects an unsupported version", async () => {
    await project.write("maestrostack.yml", validConfigYaml().replace("version: 1", "version: 2"));
    const text = await errorText(() => loadConfig(undefined, project.dir));
    expect(text).toMatch(/Unsupported config version/);
  });

  it("rejects an unsupported platform", async () => {
    await project.write(
      "maestrostack.yml",
      validConfigYaml().replace("platform: android", "platform: windows"),
    );
    const text = await errorText(() => loadConfig(undefined, project.dir));
    expect(text).toMatch(/Unsupported platform/);
  });

  it("requires at least one device", async () => {
    const yaml = validConfigYaml()
      .replace('  devices:\n    - "Google Pixel 7-13.0"\n', "  devices: []\n");
    await project.write("maestrostack.yml", yaml);
    const text = await errorText(() => loadConfig(undefined, project.dir));
    expect(text).toMatch(/at least one device/);
  });
});
