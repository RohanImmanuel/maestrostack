import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  fetch: vi.fn(),
  FormData: class {
    fields = new Map<string, unknown>();
    set(name: string, value: unknown): void {
      this.fields.set(name, value);
    }
  },
}));

import { fetch } from "undici";
import { parse as parseYaml } from "yaml";
import { configSchema, type Config } from "../config/schema.js";
import { makeTempProject, validConfigYaml } from "../test/helpers.js";
import { applyOverrides, runCommand } from "./run.js";

const mockFetch = vi.mocked(fetch);

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

function config(yaml = validConfigYaml()): Config {
  return configSchema.parse(parseYaml(yaml));
}

let project: Awaited<ReturnType<typeof makeTempProject>>;
let originalCwd: string;
let logs: string[];

beforeEach(async () => {
  mockFetch.mockReset();
  project = await makeTempProject();
  originalCwd = process.cwd();
  process.chdir(project.dir);
  logs = [];
  vi.spyOn(console, "log").mockImplementation((m?: unknown) => {
    logs.push(String(m ?? ""));
  });

  await project.write("maestrostack.yml", validConfigYaml());
  await project.write("apps/app.apk", "binary");
  await project.write("smoke/login.yml", "flow: login");
});

afterEach(async () => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
  await project.cleanup();
});

describe("applyOverrides", () => {
  it("replaces devices and execute and forces explicit mode", () => {
    const result = applyOverrides(config(), {
      device: ["A", "B"],
      execute: ["smoke\\login.yml"],
    });
    expect(result.run.devices).toEqual(["A", "B"]);
    expect(result.run.execute).toEqual(["smoke/login.yml"]);
    expect(result.run.executeMode).toBe("explicit");
  });

  it("leaves config unchanged with no overrides", () => {
    const original = config();
    const result = applyOverrides(original, {});
    expect(result.run.devices).toEqual(original.run.devices);
  });
});

describe("runCommand --dry-run", () => {
  it("makes no API calls and prints the payload", async () => {
    await runCommand({ dryRun: true });

    expect(mockFetch).not.toHaveBeenCalled();
    const output = logs.join("\n");
    expect(output).toContain("Dry run only. No API calls made.");
    expect(output).toContain("POST /app-automate/maestro/v2/android/build");
    expect(output).toContain('"app": "<resolved after upload>"');
    expect(output).toContain('"execute"');
  });
});

describe("runCommand (full)", () => {
  it("uploads app + suite, starts the build and prints the build id", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ app_url: "bs://app123" }))
      .mockResolvedValueOnce(jsonResponse({ test_suite_url: "bs://suite123" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Success", build_id: "build123" }));

    await runCommand({});

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const buildCall = mockFetch.mock.calls[2]!;
    expect(buildCall[0]).toContain("/android/build");
    const payload = JSON.parse(buildCall[1]?.body as string);
    expect(payload.app).toBe("bs://app123");
    expect(payload.testSuite).toBe("bs://suite123");

    const output = logs.join("\n");
    expect(output).toContain("Build ID: build123");
  });
});
