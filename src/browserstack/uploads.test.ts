import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Provide a minimal FormData stub so we can assert the multipart fields without
// real network/boundary handling, plus a mocked fetch. Defined inside the
// factory because vi.mock is hoisted above any top-level declarations.
vi.mock("undici", () => ({
  fetch: vi.fn(),
  FormData: class {
    fields = new Map<string, unknown>();
    set(name: string, value: unknown): void {
      this.fields.set(name, value);
    }
  },
}));

interface FakeFormData {
  fields: Map<string, unknown>;
}

import { fetch } from "undici";
import { makeTempProject } from "../test/helpers.js";
import { MaestroStackError } from "../utils/errors.js";
import { uploadApp } from "./uploadApp.js";
import { uploadSuite } from "./uploadSuite.js";

const mockFetch = vi.mocked(fetch);
const auth = { username: "user", accessKey: "key" };

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

let project: Awaited<ReturnType<typeof makeTempProject>>;

beforeEach(async () => {
  mockFetch.mockReset();
  project = await makeTempProject();
});
afterEach(async () => {
  await project.cleanup();
});

describe("uploadApp", () => {
  it("posts the file to the app endpoint and returns app_url", async () => {
    const appPath = await project.write("app.apk", "binary");
    mockFetch.mockResolvedValue(jsonResponse({ app_url: "bs://app", custom_id: "SampleApp" }));

    const result = await uploadApp({ auth, filePath: appPath, customId: "SampleApp" });

    expect(result.app_url).toBe("bs://app");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain("/app-automate/maestro/v2/app");
    const form = init?.body as unknown as FakeFormData;
    expect(form.fields.has("file")).toBe(true);
    expect(form.fields.get("custom_id")).toBe("SampleApp");
  });

  it("errors when the app file is missing", async () => {
    await expect(
      uploadApp({ auth, filePath: project.dir + "/missing.apk" }),
    ).rejects.toThrow(MaestroStackError);
  });
});

describe("uploadSuite", () => {
  it("posts the zip to the test-suite endpoint and returns test_suite_url", async () => {
    const zipPath = await project.write("Flows.zip", "zipdata");
    mockFetch.mockResolvedValue(jsonResponse({ test_suite_url: "bs://suite" }));

    const result = await uploadSuite({ auth, zipPath, customId: "SampleTest" });

    expect(result.test_suite_url).toBe("bs://suite");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain("/app-automate/maestro/v2/test-suite");
    const form = init?.body as unknown as FakeFormData;
    expect(form.fields.get("custom_id")).toBe("SampleTest");
  });
});
