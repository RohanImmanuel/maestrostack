import { MaestroStackError } from "../utils/errors.js";

/** Matches ${VAR_NAME} tokens. Variable names follow shell-ish conventions. */
const ENV_TOKEN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Substitute `${VAR}` tokens in the raw config text using `env` (defaults to
 * process.env). All missing variables are collected and reported together so the
 * user fixes them in one pass - and crucially this happens before any upload.
 */
export function resolveEnv(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const missing = new Set<string>();

  const resolved = raw.replace(ENV_TOKEN, (_match, name: string) => {
    const value = env[name];
    if (value === undefined || value === "") {
      missing.add(name);
      return "";
    }
    return value;
  });

  if (missing.size > 0) {
    const names = [...missing].sort();
    throw new MaestroStackError(
      `Missing required environment variable(s): ${names.join(", ")}`,
      ["Set them in your shell or a .env file in the working directory."],
    );
  }

  return resolved;
}
