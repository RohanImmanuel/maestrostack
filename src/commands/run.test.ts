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
import { applyOverrides, deviceBatches, runCommand } from "./run.js";

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

  it("applies a maxParallel override", () => {
    const result = applyOverrides(config(), { maxParallel: 2 });
    expect(result.run.maxParallel).toBe(2);
  });
});

describe("deviceBatches", () => {
  const devices = ["a", "b", "c", "d", "e"];

  it("returns a single batch when maxParallel is unset or large", () => {
    expect(deviceBatches(devices)).toEqual([devices]);
    expect(deviceBatches(devices, 10)).toEqual([devices]);
  });

  it("splits devices into batches of at most maxParallel", () => {
    expect(deviceBatches(devices, 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
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

describe("runCommand --dry-run with custom_id app", () => {
  it("uses the custom_id as the app value and makes no calls", async () => {
    const yaml = validConfigYaml().replace(
      "app:\n  source: upload\n  path: ./apps/app.apk\n",
      "app:\n  source: custom_id\n  customId: SampleApp\n",
    );
    await project.write("maestrostack.yml", yaml);

    await runCommand({ dryRun: true });

    expect(mockFetch).not.toHaveBeenCalled();
    const output = logs.join("\n");
    expect(output).toContain("Would use app (custom_id):");
    expect(output).toContain('"app": "SampleApp"');
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

describe("runCommand (batched with maxParallel)", () => {
  it("submits one build per device batch sequentially and polls each", async () => {
    // Two devices, maxParallel 1 => two sequential batches.
    const yaml = validConfigYaml().replace(
      '  devices:\n    - "Google Pixel 7-13.0"\n',
      '  devices:\n    - "Google Pixel 7-13.0"\n    - "Samsung Galaxy S20-10.0"\n  maxParallel: 1\n',
    );
    await project.write("maestrostack.yml", yaml);

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ app_url: "bs://app" })) // upload app
      .mockResolvedValueOnce(jsonResponse({ test_suite_url: "bs://suite" })) // upload suite
      .mockResolvedValueOnce(jsonResponse({ build_id: "b1" })) // batch 1 build
      .mockResolvedValueOnce(jsonResponse({ status: "passed" })) // batch 1 poll
      .mockResolvedValueOnce(jsonResponse({ build_id: "b2" })) // batch 2 build
      .mockResolvedValueOnce(jsonResponse({ status: "failed" })); // batch 2 poll

    await runCommand({});

    // app + suite + (build + poll) x2 = 6 calls.
    expect(mockFetch).toHaveBeenCalledTimes(6);

    const build1 = JSON.parse(mockFetch.mock.calls[2]![1]?.body as string);
    const build2 = JSON.parse(mockFetch.mock.calls[4]![1]?.body as string);
    expect(build1.devices).toEqual(["Google Pixel 7-13.0"]);
    expect(build2.devices).toEqual(["Samsung Galaxy S20-10.0"]);

    // Status polls hit the build-status endpoint.
    expect(mockFetch.mock.calls[3]![0]).toContain("/builds/b1");
    expect(mockFetch.mock.calls[5]![0]).toContain("/builds/b2");

    const output = logs.join("\n");
    expect(output).toContain("b1 [passed]");
    expect(output).toContain("b2 [failed]");
  });
});
