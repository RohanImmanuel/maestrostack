import { parse as parseYaml } from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configSchema, type Config } from "../config/schema.js";
import { makeTempProject, validConfigYaml } from "../test/helpers.js";
import { validateApp } from "./validate.js";

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

function config(yaml = validConfigYaml()): Config {
  return configSchema.parse(parseYaml(yaml));
}

describe("validateApp", () => {
  it("passes for an existing .apk on android", async () => {
    await project.write("apps/app.apk", "bin");
    await expect(validateApp(config(), project.dir)).resolves.toBeUndefined();
  });

  it("errors when the app file is missing", async () => {
    await expect(validateApp(config(), project.dir)).rejects.toThrow(
      /app\.path does not exist/,
    );
  });

  it("rejects an .ipa on the android platform", async () => {
    await project.write("apps/app.apk", "bin");
    const yaml = validConfigYaml().replace("path: ./apps/app.apk", "path: ./apps/app.ipa");
    await project.write("apps/app.ipa", "bin");
    await expect(validateApp(config(yaml), project.dir)).rejects.toThrow(
      /requires a \.apk file/,
    );
  });

  it("accepts the custom_id source without a local file", async () => {
    const yaml = validConfigYaml().replace(
      "app:\n  source: upload\n  path: ./apps/app.apk",
      "app:\n  source: custom_id\n  customId: SampleApp",
    );
    await expect(validateApp(config(yaml), project.dir)).resolves.toBeUndefined();
  });

  it("passes for app_url source without a local file", async () => {
    const yaml = validConfigYaml().replace(
      "app:\n  source: upload\n  path: ./apps/app.apk",
      "app:\n  source: app_url\n  appUrl: bs://existing",
    );
    await expect(validateApp(config(yaml), project.dir)).resolves.toBeUndefined();
  });
});
