import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPathSafe } from "../src/server";

describe("isPathSafe", () => {
  const basePath = join(tmpdir(), "notes");

  test("accepts paths inside the served directory", () => {
    expect(isPathSafe(basePath, "README.md")).toBe(true);
    expect(isPathSafe(basePath, "guides/getting-started.md")).toBe(true);
    expect(isPathSafe(basePath, join(basePath, "README.md"))).toBe(true);
  });

  test("rejects paths outside the served directory", () => {
    expect(isPathSafe(basePath, "../notes-private/secret.md")).toBe(false);
    expect(isPathSafe(basePath, "../../etc/passwd")).toBe(false);
    expect(isPathSafe(basePath, join(tmpdir(), "notes-private", "secret.md"))).toBe(false);
  });

  test("rejects the served directory itself", () => {
    expect(isPathSafe(basePath, "")).toBe(false);
    expect(isPathSafe(basePath, ".")).toBe(false);
    expect(isPathSafe(basePath, basePath)).toBe(false);
  });
});
