import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  fetch: vi.fn(),
}));

import { fetch } from "undici";
import { MaestroStackError } from "../utils/errors.js";
import { getBuild, pollBuild } from "./buildStatus.js";

const mockFetch = vi.mocked(fetch);
const auth = { username: "u", accessKey: "k" };

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

beforeEach(() => mockFetch.mockReset());

describe("getBuild", () => {
  it("GETs the build-status endpoint", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: "running" }));
    const build = await getBuild({ auth, buildId: "abc" });
    expect(build.status).toBe("running");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api-cloud.browserstack.com/app-automate/maestro/v2/builds/abc");
    expect(init?.method).toBe("GET");
  });
});

describe("pollBuild", () => {
  it("polls until a terminal status and returns it", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ status: "running" }))
      .mockResolvedValueOnce(jsonResponse({ status: "queued" }))
      .mockResolvedValueOnce(jsonResponse({ status: "passed" }));

    const seen: string[] = [];
    const status = await pollBuild({
      auth,
      buildId: "abc",
      intervalMs: 0,
      onStatus: (s) => seen.push(s),
    });

    expect(status).toBe("passed");
    expect(seen).toEqual(["running", "queued", "passed"]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws when it times out", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: "running" }));
    await expect(
      pollBuild({ auth, buildId: "abc", intervalMs: 0, timeoutMs: -1 }),
    ).rejects.toThrow(MaestroStackError);
  });
});
