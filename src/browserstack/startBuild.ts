import type { Config, Platform } from "../config/schema.js";
import { bsRequest, type BsAuth } from "./client.js";

export interface BuildPayload {
  app: string;
  testSuite: string;
  project: string;
  devices: string[];
  execute?: string[];
  networkLogs?: boolean;
  deviceLogs?: boolean;
}

export interface StartBuildResult {
  message?: string;
  build_id: string;
}

/** Build endpoint path for the given platform. */
export function buildPath(platform: Platform): string {
  return `/app-automate/maestro/v2/${platform}/build`;
}

/**
 * Construct the BrowserStack build payload from config and the resolved app /
 * test-suite references. Pure and side-effect free so it can be unit-tested and
 * reused for the `--dry-run` preview.
 *
 * - `execute` is included only in explicit mode (in main mode BrowserStack runs
 *   the suite's main.yaml).
 * - `networkLogs` / `deviceLogs` are JSON booleans, included only when set.
 */
export function buildPayload(
  config: Config,
  resolved: { app: string; testSuite: string },
): BuildPayload {
  const { run } = config;
  const payload: BuildPayload = {
    app: resolved.app,
    testSuite: resolved.testSuite,
    project: run.project,
    devices: run.devices,
  };

  if (run.executeMode === "explicit" && run.execute && run.execute.length > 0) {
    payload.execute = run.execute;
  }

  if (run.options.networkLogs !== undefined) {
    payload.networkLogs = run.options.networkLogs;
  }
  if (run.options.deviceLogs !== undefined) {
    payload.deviceLogs = run.options.deviceLogs;
  }

  return payload;
}

/** Trigger a Maestro build and return the BrowserStack build id. */
export async function startBuild(options: {
  auth: BsAuth;
  platform: Platform;
  payload: BuildPayload;
}): Promise<StartBuildResult> {
  return bsRequest<StartBuildResult>({
    path: buildPath(options.platform),
    method: "POST",
    auth: options.auth,
    jsonBody: options.payload,
  });
}
