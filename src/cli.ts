import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { packageCommand } from "./commands/package.js";
import { runCommand } from "./commands/run.js";
import { uploadAppCommand } from "./commands/uploadApp.js";
import { uploadSuiteCommand } from "./commands/uploadSuite.js";
import { validateCommand } from "./commands/validate.js";
import { isMaestroStackError } from "./utils/errors.js";
import { logger, setDebug } from "./utils/logger.js";

/** Injected at build time by tsup from package.json (see tsup.config.ts). */
declare const __MS_VERSION__: string;
const VERSION = typeof __MS_VERSION__ === "string" ? __MS_VERSION__ : "0.0.0";

const program = new Command();

/** Accumulate repeated CLI options (e.g. --device a --device b) into an array. */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Wrap a command action: merge program-level (global) options, apply debug mode,
 * and turn expected errors into a clean message with exit code 1 instead of an
 * unhandled rejection / stack dump.
 */
function action<T extends object>(
  fn: (opts: T & { config?: string; debug?: boolean }) => Promise<void>,
): (opts: T) => Promise<void> {
  return async (rawOpts: T) => {
    const opts = { ...program.opts(), ...rawOpts };
    if (opts.debug) setDebug(true);
    try {
      await fn(opts);
    } catch (err) {
      if (isMaestroStackError(err)) {
        logger.error(err.message);
        for (const line of err.details ?? []) {
          logger.error(`  ${line}`);
        }
      } else {
        logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      }
      process.exitCode = 1;
    }
  };
}

program
  .name("maestrostack")
  .description("Config-driven CLI for running Maestro tests on BrowserStack App Automate.")
  .version(VERSION)
  .option("-c, --config <path>", "path to the config file")
  .option("--debug", "enable debug logging");

program
  .command("init")
  .description("Create a starter maestrostack.yml")
  .option("--android", "scaffold an Android config")
  .option("--ios", "scaffold an iOS config")
  .option("--force", "overwrite an existing config")
  .action(action(initCommand));

program
  .command("validate")
  .description("Validate the config, suite structure and devices")
  .action(action(validateCommand));

program
  .command("package")
  .description("Discover flows and create the suite zip without uploading")
  .action(action(packageCommand));

program
  .command("upload-app")
  .description("Upload only the app and print its BrowserStack app_url")
  .action(action(uploadAppCommand));

program
  .command("upload-suite")
  .description("Package and upload only the Maestro suite")
  .action(action(uploadSuiteCommand));

program
  .command("run")
  .description("Package, upload and trigger a BrowserStack Maestro build")
  .option("--dry-run", "validate and print the payload without making API calls")
  .option("--device <name>", "override run.devices (repeatable)", collect, [])
  .option("--execute <path>", "override run.execute (repeatable)", collect, [])
  .option("--max-parallel <n>", "run at most N listed devices at once (sequential batches)", (v) => parseInt(v, 10))
  .action(action(runCommand));

program.parseAsync(process.argv).catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
