import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { configSchema, type Config } from "../config/schema.js";
import { validConfigYaml } from "../test/helpers.js";
import { buildDashboardUrl, buildPath, buildPayload } from "./startBuild.js";

function config(yaml: string): Config {
  return configSchema.parse(parseYaml(yaml));
}

const resolved = { app: "bs://app", testSuite: "bs://suite" };

describe("buildPath", () => {
  it("selects the platform-specific endpoint", () => {
    expect(buildPath("android")).toBe("/app-automate/maestro/v2/android/build");
    expect(buildPath("ios")).toBe("/app-automate/maestro/v2/ios/build");
  });
});

describe("buildDashboardUrl", () => {
  it("builds the dashboard URL for a build id", () => {
    expect(buildDashboardUrl("abc123")).toBe(
      "https://app-automate.browserstack.com/dashboard/v2/builds/abc123",
    );
  });
});

describe("buildPayload", () => {
  it("includes execute and boolean log flags in explicit mode", () => {
    const yaml = validConfigYaml(
      "  options:\n    networkLogs: true\n    deviceLogs: false\n",
    );
    const payload = buildPayload(config(yaml), resolved);

    expect(payload).toEqual({
      app: "bs://app",
      testSuite: "bs://suite",
      project: "Demo",
      devices: ["Google Pixel 7-13.0"],
      execute: ["smoke/login.yml"],
      networkLogs: true,
      deviceLogs: false,
    });
  });

  it("omits execute in main mode", () => {
    const yaml = validConfigYaml()
      .replace("executeMode: explicit", "executeMode: main")
      .replace("  execute:\n    - smoke/login.yml\n", "");
    const payload = buildPayload(config(yaml), resolved);
    expect(payload.execute).toBeUndefined();
  });

  it("omits log flags when not configured", () => {
    const payload = buildPayload(config(validConfigYaml()), resolved);
    expect(payload.networkLogs).toBeUndefined();
    expect(payload.deviceLogs).toBeUndefined();
  });

  it("uses ios endpoint platform from config", () => {
    const yaml = validConfigYaml()
      .replace("platform: android", "platform: ios")
      .replace("path: ./apps/app.apk", "path: ./apps/app.ipa");
    expect(buildPath(config(yaml).platform)).toContain("/ios/");
  });

  it("uses a device subset when one is supplied (for batched runs)", () => {
    const payload = buildPayload(config(validConfigYaml()), resolved, ["Pixel 8-14.0"]);
    expect(payload.devices).toEqual(["Pixel 8-14.0"]);
  });
});
