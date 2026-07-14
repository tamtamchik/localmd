import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPathSafe, isPathSafeOnDisk } from "../src/server";

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

describe("isPathSafeOnDisk", () => {
  test("rejects paths that escape through a symlink", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "localmd-"));
    const basePath = join(tempDirectory, "notes");
    const outsidePath = join(tempDirectory, "outside");

    try {
      await mkdir(basePath);
      await mkdir(outsidePath);
      await Bun.write(join(outsidePath, "secret.md"), "secret");
      await symlink(outsidePath, join(basePath, "linked"), "junction");

      expect(await isPathSafeOnDisk(basePath, "linked/secret.md")).toBe(false);
      expect(await isPathSafeOnDisk(basePath, "linked/new.md")).toBe(false);
      expect(await isPathSafeOnDisk(basePath, "new.md")).toBe(true);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
