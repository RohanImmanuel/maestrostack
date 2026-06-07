import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTempProject } from "../test/helpers.js";
import { discoverFlows } from "./discoverFlows.js";

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

const suite = (overrides: Partial<Parameters<typeof discoverFlows>[0]> = {}) => ({
  root: ".",
  packageName: "Flows.zip",
  include: ["**/*.yml", "**/*.yaml"],
  exclude: [],
  ...overrides,
});

describe("discoverFlows", () => {
  it("finds flows in subfolders and ignores root-level YAML", async () => {
    await project.write("maestrostack.yml", "version: 1");
    await project.write("staging.yml", "root config");
    await project.write("smoke/login.yml");
    await project.write("regression/checkout.yaml");

    const flows = await discoverFlows(suite(), {
      cwd: project.dir,
      configBasename: "maestrostack.yml",
    });

    expect(flows).toEqual(["regression/checkout.yaml", "smoke/login.yml"]);
    expect(flows).not.toContain("staging.yml");
    expect(flows).not.toContain("maestrostack.yml");
  });

  it("returns forward-slash paths", async () => {
    await project.write("smoke/nested/deep.yml");
    const flows = await discoverFlows(suite(), { cwd: project.dir });
    expect(flows).toEqual(["smoke/nested/deep.yml"]);
    expect(flows[0]).not.toContain("\\");
  });

  it("applies include and exclude globs", async () => {
    await project.write("smoke/login.yml");
    await project.write("regression/checkout.yml");

    const flows = await discoverFlows(
      suite({ include: ["smoke/**/*.yml"], exclude: ["**/skip.yml"] }),
      { cwd: project.dir },
    );
    expect(flows).toEqual(["smoke/login.yml"]);
  });

  it("ignores node_modules and .git", async () => {
    await project.write("node_modules/pkg/flow.yml");
    await project.write(".git/config.yml");
    await project.write("smoke/login.yml");

    const flows = await discoverFlows(suite(), { cwd: project.dir });
    expect(flows).toEqual(["smoke/login.yml"]);
  });

  it("errors when no flows are found", async () => {
    await project.write("maestrostack.yml", "version: 1");
    await expect(
      discoverFlows(suite(), { cwd: project.dir, configBasename: "maestrostack.yml" }),
    ).rejects.toThrow(/No Maestro flow files found/);
  });

  it("errors when suite.root does not exist", async () => {
    await expect(
      discoverFlows(suite({ root: "nope" }), { cwd: project.dir }),
    ).rejects.toThrow(/suite\.root does not exist/);
  });
});
