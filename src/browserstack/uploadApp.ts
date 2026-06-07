import { openAsBlob } from "node:fs";
import path from "node:path";
import { FormData } from "undici";
import { MaestroStackError } from "../utils/errors.js";
import { isFile } from "../utils/fs.js";
import { bsRequest, type BsAuth } from "./client.js";

export interface UploadAppResult {
  app_url: string;
  custom_id?: string;
  expiry?: string;
  app_name?: string;
}

/**
 * Upload a local app binary (.apk / .ipa) to BrowserStack.
 * POST /app-automate/maestro/v2/app  (multipart: file, optional custom_id)
 */
export async function uploadApp(options: {
  auth: BsAuth;
  filePath: string;
  customId?: string;
}): Promise<UploadAppResult> {
  if (!(await isFile(options.filePath))) {
    throw new MaestroStackError(`app.path does not exist: ${options.filePath}`);
  }

  const form = new FormData();
  const blob = await openAsBlob(options.filePath);
  form.set("file", blob, path.basename(options.filePath));
  if (options.customId) {
    form.set("custom_id", options.customId);
  }

  return bsRequest<UploadAppResult>({
    path: "/app-automate/maestro/v2/app",
    method: "POST",
    auth: options.auth,
    rawBody: form,
  });
}
