import { z } from "zod";

/**
 * Zod schema for maestrostack.yml. Parsing yields a fully-typed {@link Config}.
 * Validation messages here are intentionally human-readable since they surface
 * directly in the CLI.
 */

const nonEmpty = (label: string) =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} must not be empty`);

const authSchema = z.object({
  username: nonEmpty("BrowserStack username (auth.username)"),
  accessKey: nonEmpty("BrowserStack access key (auth.accessKey)"),
});

const appUploadSchema = z.object({
  source: z.literal("upload"),
  path: nonEmpty("app.path"),
  customId: z.string().trim().min(1).optional(),
});

const appUrlSchema = z.object({
  source: z.literal("app_url"),
  appUrl: nonEmpty("app.appUrl").refine((v) => v.startsWith("bs://"), {
    message: "app.appUrl must start with bs://",
  }),
  customId: z.string().trim().min(1).optional(),
});

const appCustomIdSchema = z.object({
  // Present in the schema so configs validate, but resolution is deferred (see validate.ts).
  source: z.literal("custom_id"),
  customId: nonEmpty("app.customId"),
});

const appSchema = z.discriminatedUnion("source", [
  appUploadSchema,
  appUrlSchema,
  appCustomIdSchema,
]);

const suiteSchema = z.object({
  root: z.string().trim().min(1).default("."),
  packageName: z.string().trim().min(1).default("Flows.zip"),
  customId: z.string().trim().min(1).optional(),
  include: z.array(nonEmpty("suite.include entry")).default(["**/*.yml", "**/*.yaml"]),
  exclude: z.array(z.string()).default([]),
});

const optionsSchema = z
  .object({
    networkLogs: z.boolean().optional(),
    deviceLogs: z.boolean().optional(),
  })
  .default({});

const runSchema = z.object({
  project: nonEmpty("run.project"),
  devices: z
    .array(nonEmpty("device"))
    .min(1, "run.devices must contain at least one device"),
  executeMode: z.enum(["explicit", "main"]).default("explicit"),
  execute: z.array(nonEmpty("run.execute entry")).optional(),
  maxParallel: z
    .number({ invalid_type_error: "run.maxParallel must be a number" })
    .int("run.maxParallel must be an integer")
    .positive("run.maxParallel must be a positive integer")
    .optional(),
  options: optionsSchema,
});

export const configSchema = z.object({
  version: z.literal(1, {
    errorMap: () => ({ message: "Unsupported config version. Expected version: 1" }),
  }),
  auth: authSchema,
  platform: z.enum(["android", "ios"], {
    errorMap: () => ({ message: "Unsupported platform. Expected android or ios" }),
  }),
  app: appSchema,
  suite: suiteSchema.default({}),
  run: runSchema,
});

export type Config = z.infer<typeof configSchema>;
export type AppConfig = Config["app"];
export type Platform = Config["platform"];
