/**
 * Error type for all expected, user-facing failures (bad config, missing files,
 * API errors, etc). The CLI entrypoint catches these and prints a clean message
 * with exit code 1, rather than dumping a stack trace.
 */
export class MaestroStackError extends Error {
  /** Optional extra lines shown beneath the main message (e.g. hints). */
  readonly details?: string[];

  constructor(message: string, details?: string[]) {
    super(message);
    this.name = "MaestroStackError";
    this.details = details;
  }
}

/** Type guard for {@link MaestroStackError}. */
export function isMaestroStackError(err: unknown): err is MaestroStackError {
  return err instanceof MaestroStackError;
}
