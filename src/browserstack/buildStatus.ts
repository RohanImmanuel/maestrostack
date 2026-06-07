import { MaestroStackError } from "../utils/errors.js";
import { bsRequest, type BsAuth } from "./client.js";

export interface BuildStatus {
  status: string;
  [key: string]: unknown;
}

/** Statuses that mean the build is not finished yet. Anything else is terminal. */
const IN_PROGRESS = new Set(["running", "queued", "creating"]);

/** Fetch the current status of a build. GET /app-automate/maestro/v2/builds/{id} */
export async function getBuild(options: {
  auth: BsAuth;
  buildId: string;
}): Promise<BuildStatus> {
  return bsRequest<BuildStatus>({
    path: `/app-automate/maestro/v2/builds/${options.buildId}`,
    method: "GET",
    auth: options.auth,
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Poll a build until it reaches a terminal status (anything other than
 * running/queued/creating). Returns the final status string. Throws if the
 * timeout is exceeded.
 */
export async function pollBuild(options: {
  auth: BsAuth;
  buildId: string;
  intervalMs?: number;
  timeoutMs?: number;
  onStatus?: (status: string) => void;
}): Promise<string> {
  const intervalMs = options.intervalMs ?? 20_000;
  const timeoutMs = options.timeoutMs ?? 60 * 60 * 1000; // 1 hour
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const build = await getBuild({ auth: options.auth, buildId: options.buildId });
    const status = build.status;
    options.onStatus?.(status);

    if (!IN_PROGRESS.has(status)) {
      return status;
    }
    if (Date.now() >= deadline) {
      throw new MaestroStackError(
        `Timed out waiting for build ${options.buildId} (last status: ${status}).`,
      );
    }
    await sleep(intervalMs);
  }
}
