import { describe, expect, it } from "vitest";
import { MaestroStackError } from "../utils/errors.js";
import { resolveEnv } from "./resolveEnv.js";

describe("resolveEnv", () => {
  it("substitutes ${VAR} tokens from the provided env", () => {
    const out = resolveEnv("user: ${U}\nkey: ${K}", { U: "alice", K: "secret" });
    expect(out).toBe("user: alice\nkey: secret");
  });

  it("leaves text without tokens untouched", () => {
    expect(resolveEnv("platform: android", {})).toBe("platform: android");
  });

  it("aggregates all missing variables into one error", () => {
    try {
      resolveEnv("${A}-${B}-${A}", {});
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MaestroStackError);
      expect((err as MaestroStackError).message).toContain("A, B");
    }
  });

  it("treats empty-string env values as missing", () => {
    expect(() => resolveEnv("${A}", { A: "" })).toThrow(MaestroStackError);
  });
});
