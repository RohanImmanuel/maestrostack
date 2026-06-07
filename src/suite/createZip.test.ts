import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Open } from "unzipper";
import { makeTempProject } from "../test/helpers.js";
import { createZip } from "./createZip.js";

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

async function entryNames(zipPath: string): Promise<string[]> {
  const directory = await Open.file(zipPath);
  return directory.files.map((f) => f.path).sort();
}

describe("createZip", () => {
  it("writes a zip with entries under Flows/ preserving structure", async () => {
    await project.write("smoke/login.yml", "flow: login");
    await project.write("regression/checkout.yml", "flow: checkout");

    const { zipPath, files } = await createZip({
      files: ["regression/checkout.yml", "smoke/login.yml"],
      suiteRoot: ".",
      packageName: "Flows.zip",
      cwd: project.dir,
    });

    expect(zipPath.endsWith("Flows.zip")).toBe(true);
    expect(files).toHaveLength(2);

    const names = await entryNames(zipPath);
    expect(names).toEqual(["Flows/regression/checkout.yml", "Flows/smoke/login.yml"]);
  });

  it("uses forward slashes in entry names (cross-platform contract)", async () => {
    await project.write("smoke/nested/deep.yml", "x: 1");
    const { zipPath } = await createZip({
      files: ["smoke/nested/deep.yml"],
      suiteRoot: ".",
      packageName: "Flows.zip",
      cwd: project.dir,
    });

    const names = await entryNames(zipPath);
    for (const name of names) {
      expect(name).not.toContain("\\");
      expect(name).toContain("/");
    }
  });

  it("preserves file contents", async () => {
    await project.write("smoke/login.yml", "flow: login");
    const { zipPath } = await createZip({
      files: ["smoke/login.yml"],
      suiteRoot: ".",
      packageName: "Flows.zip",
      cwd: project.dir,
    });

    const directory = await Open.file(zipPath);
    const entry = directory.files.find((f) => f.path === "Flows/smoke/login.yml");
    expect(entry).toBeDefined();
    const content = await entry!.buffer();
    expect(content.toString("utf8")).toBe("flow: login");
  });
});
