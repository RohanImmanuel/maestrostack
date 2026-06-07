import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock undici before importing modules under test.
vi.mock("undici", () => ({
  fetch: vi.fn(),
}));

import { fetch } from "undici";
import { MaestroStackError } from "../utils/errors.js";
import { authHeader, bsRequest } from "./client.js";
import { startBuild } from "./startBuild.js";

const mockFetch = vi.mocked(fetch);

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

const auth = { username: "user", accessKey: "secret-key" };

beforeEach(() => {
  mockFetch.mockReset();
});

describe("authHeader", () => {
  it("builds a Basic auth header", () => {
    const expected = `Basic ${Buffer.from("user:secret-key").toString("base64")}`;
    expect(authHeader(auth)).toBe(expected);
  });
});

describe("bsRequest", () => {
  it("sends JSON with auth header and parses the response", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ build_id: "abc" }));

    const result = await bsRequest<{ build_id: string }>({
      path: "/x",
      method: "POST",
      auth,
      jsonBody: { a: 1 },
    });

    expect(result.build_id).toBe("abc");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api-cloud.browserstack.com/x");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(authHeader(auth));
    expect(headers["content-type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws a MaestroStackError on non-2xx with the server message", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ message: "bad app" }, { ok: false, status: 422 }),
    );

    const err = await bsRequest({ path: "/x", method: "POST", auth }).catch((e) => e);
    expect(err).toBeInstanceOf(MaestroStackError);
    expect((err as Error).message).toContain("422");
    expect((err as Error).message).toContain("bad app");
    // Credentials must never appear in the error.
    expect((err as Error).message).not.toContain("secret-key");
  });

  it("wraps network failures", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(bsRequest({ path: "/x", method: "POST", auth })).rejects.toThrow(
      /Failed to reach BrowserStack/,
    );
  });
});

describe("startBuild", () => {
  it("posts to the platform endpoint and returns the build id", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "Success", build_id: "xyz" }));

    const result = await startBuild({
      auth,
      platform: "android",
      payload: {
        app: "bs://a",
        testSuite: "bs://s",
        project: "P",
        devices: ["D"],
      },
    });

    expect(result.build_id).toBe("xyz");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api-cloud.browserstack.com/app-automate/maestro/v2/android/build");
  });
});
