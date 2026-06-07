import { openAsBlob } from "node:fs";
import path from "node:path";
import { FormData } from "undici";
import { MaestroStackError } from "../utils/errors.js";
import { isFile } from "../utils/fs.js";
import { bsRequest, type BsAuth } from "./client.js";

export interface UploadSuiteResult {
  test_suite_url: string;
  custom_id?: string;
  expiry?: string;
  test_suite_name?: string;
  framework?: string;
}

/**
 * Upload a zipped Maestro test suite to BrowserStack.
 * POST /app-automate/maestro/v2/test-suite  (multipart: file, optional custom_id)
 */
export async function uploadSuite(options: {
  auth: BsAuth;
  zipPath: string;
  customId?: string;
}): Promise<UploadSuiteResult> {
  if (!(await isFile(options.zipPath))) {
    throw new MaestroStackError(`Suite zip does not exist: ${options.zipPath}`);
  }

  const form = new FormData();
  const blob = await openAsBlob(options.zipPath);
  form.set("file", blob, path.basename(options.zipPath));
  if (options.customId) {
    form.set("custom_id", options.customId);
  }

  return bsRequest<UploadSuiteResult>({
    path: "/app-automate/maestro/v2/test-suite",
    method: "POST",
    auth: options.auth,
    rawBody: form,
  });
}
