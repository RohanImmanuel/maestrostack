import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { configSchema, type Config } from "../config/schema.js";
import { makeTempProject, validConfigYaml } from "../test/helpers.js";
import { validateSuite } from "./validateSuite.js";

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

function config(overrides = ""): Config {
  return configSchema.parse(parseYaml(validConfigYaml(overrides)));
}

describe("validateSuite (explicit mode)", () => {
  it("passes when execute paths exist in the discovered set", async () => {
    await expect(
      validateSuite(config(), ["smoke/login.yml", "smoke/signup.yml"], project.dir),
    ).resolves.toBeUndefined();
  });

  it("errors when an execute path is missing from the suite", async () => {
    await expect(
      validateSuite(config(), ["smoke/signup.yml"], project.dir),
    ).rejects.toThrow(/do not exist in the packaged suite/);
  });

  it("normalizes backslash execute paths before comparing", async () => {
    const cfg = config();
    // Simulate a Windows-style input by mutating the resolved config.
    cfg.run.execute = ["smoke\\login.yml"];
    await expect(validateSuite(cfg, ["smoke/login.yml"], project.dir)).resolves.toBeUndefined();
  });
});

describe("validateSuite (main mode)", () => {
  function mainCfg(): Config {
    const yaml = validConfigYaml()
      .replace("executeMode: explicit", "executeMode: main")
      .replace("  execute:\n    - smoke/login.yml\n", "");
    return configSchema.parse(parseYaml(yaml));
  }

  it("passes when main.yaml exists at the suite root", async () => {
    await project.write("main.yaml", "appId: x");
    await expect(validateSuite(mainCfg(), [], project.dir)).resolves.toBeUndefined();
  });

  it("errors when main.yaml is missing", async () => {
    await expect(validateSuite(mainCfg(), [], project.dir)).rejects.toThrow(
      /main\.yaml was not found/,
    );
  });
});
