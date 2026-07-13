import { describe, expect, test } from "bun:test";
import { isPathSafe } from "../src/server";

describe("isPathSafe", () => {
  const basePath = "/tmp/notes";

  test("accepts paths inside the served directory", () => {
    expect(isPathSafe(basePath, "README.md")).toBe(true);
    expect(isPathSafe(basePath, "guides/getting-started.md")).toBe(true);
    expect(isPathSafe(basePath, `${basePath}/README.md`)).toBe(true);
  });

  test("rejects paths outside the served directory", () => {
    expect(isPathSafe(basePath, "../notes-private/secret.md")).toBe(false);
    expect(isPathSafe(basePath, "../../etc/passwd")).toBe(false);
    expect(isPathSafe(basePath, "/tmp/notes-private/secret.md")).toBe(false);
  });

  test("rejects the served directory itself", () => {
    expect(isPathSafe(basePath, "")).toBe(false);
    expect(isPathSafe(basePath, ".")).toBe(false);
    expect(isPathSafe(basePath, basePath)).toBe(false);
  });
});
