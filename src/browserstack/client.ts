import { fetch, type BodyInit } from "undici";
import { MaestroStackError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const BASE_URL = "https://api-cloud.browserstack.com";

export interface BsAuth {
  username: string;
  accessKey: string;
}

/** Build an HTTP Basic auth header from BrowserStack credentials. */
export function authHeader(auth: BsAuth): string {
  const token = Buffer.from(`${auth.username}:${auth.accessKey}`).toString("base64");
  return `Basic ${token}`;
}

interface RequestOptions {
  path: string;
  method: "GET" | "POST";
  auth: BsAuth;
  /** JSON body - serialized and sent with application/json. */
  jsonBody?: unknown;
  /** Raw body (e.g. multipart FormData). undici sets the content-type. */
  rawBody?: BodyInit;
}

/**
 * Perform a request against the BrowserStack API with Basic auth, returning the
 * parsed JSON. Non-2xx responses become a {@link MaestroStackError} carrying the
 * status and any server message - credentials are never logged.
 */
export async function bsRequest<T>(options: RequestOptions): Promise<T> {
  const url = `${BASE_URL}${options.path}`;
  const headers: Record<string, string> = {
    authorization: authHeader(options.auth),
  };

  let body: BodyInit | undefined;
  if (options.jsonBody !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.jsonBody);
  } else if (options.rawBody !== undefined) {
    body = options.rawBody;
  }

  logger.debug(`${options.method} ${url}`);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, { method: options.method, headers, body });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new MaestroStackError(`Failed to reach BrowserStack: ${reason}`);
  }

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = extractErrorMessage(data) ?? response.statusText;
    throw new MaestroStackError(`BrowserStack API error (${response.status}): ${message}`);
  }

  return data as T;
}

function extractErrorMessage(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["message", "error", "errors"]) {
      const value = obj[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
}
