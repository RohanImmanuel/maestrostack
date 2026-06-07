/* eslint-disable no-console */

let debugEnabled = false;

/** Enable or disable debug-level output (wired to the global --debug flag). */
export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export const logger = {
  /** Primary user-facing output. */
  info(message = ""): void {
    console.log(message);
  },
  warn(message: string): void {
    console.warn(`warning: ${message}`);
  },
  error(message: string): void {
    console.error(message);
  },
  /** Only printed when --debug is set. Prefixed so it is visually distinct. */
  debug(message: string): void {
    if (debugEnabled) {
      console.error(`[debug] ${message}`);
    }
  },
};

/**
 * Mask a secret for display, keeping only the last few characters so logs are
 * still useful for debugging without exposing the value. Empty/short values are
 * fully masked.
 */
export function redact(secret: string | undefined): string {
  if (!secret) return "";
  if (secret.length <= 4) return "****";
  return `****${secret.slice(-4)}`;
}
