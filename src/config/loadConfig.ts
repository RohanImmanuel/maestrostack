import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { parse as parseYaml } from "yaml";
import { MaestroStackError } from "../utils/errors.js";
import { isFile } from "../utils/fs.js";
import { logger } from "../utils/logger.js";
import { resolveEnv } from "./resolveEnv.js";
import { configSchema, type Config } from "./schema.js";

const DEFAULT_CONFIG_NAMES = ["maestrostack.yml", "maestrostack.yaml"];

export interface LoadedConfig {
  config: Config;
  /** Absolute path to the resolved config file. */
  configPath: string;
}

/**
 * Resolve which config file to use. An explicit `-c` path must exist; otherwise
 * we look for maestrostack.yml then maestrostack.yaml in the working directory.
 */
export async function resolveConfigPath(
  explicit: string | undefined,
  cwd: string = process.cwd(),
): Promise<string> {
  if (explicit) {
    const resolved = path.resolve(cwd, explicit);
    if (!(await isFile(resolved))) {
      throw new MaestroStackError(`Config file not found: ${explicit}`);
    }
    return resolved;
  }

  for (const name of DEFAULT_CONFIG_NAMES) {
    const candidate = path.resolve(cwd, name);
    if (await isFile(candidate)) {
      return candidate;
    }
  }

  throw new MaestroStackError("maestrostack.yml not found.", [
    "Run `maestrostack init` to create one, or pass --config <path>.",
  ]);
}

/**
 * Load, env-substitute, parse and validate a config file. The `.env` in the
 * working directory is loaded first so `${VAR}` tokens can resolve against it.
 */
export async function loadConfig(
  explicit: string | undefined,
  cwd: string = process.cwd(),
): Promise<LoadedConfig> {
  // Load .env (does not override already-set process.env values).
  dotenv.config({ path: path.resolve(cwd, ".env") });

  const configPath = await resolveConfigPath(explicit, cwd);
  logger.debug(`Using config: ${configPath}`);

  const raw = await readFile(configPath, "utf8");
  const substituted = resolveEnv(raw);

  let parsed: unknown;
  try {
    parsed = parseYaml(substituted);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new MaestroStackError(`Invalid YAML in ${path.basename(configPath)}.`, [reason]);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `- ${where}${issue.message}`;
    });
    throw new MaestroStackError("Invalid configuration:", details);
  }

  return { config: result.data, configPath };
}
