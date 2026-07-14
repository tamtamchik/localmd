import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../src/config";
import { isPathSafe, isPathSafeOnDisk, startServer } from "../src/server";

async function runGit(directory: string, args: string[], env?: Record<string, string>) {
  const process = Bun.spawn(["git", "-C", directory, ...args], {
    stdout: "ignore",
    stderr: "pipe",
    env: { ...Bun.env, ...env },
  });

  if ((await process.exited) !== 0) {
    throw new Error(await new Response(process.stderr).text());
  }
}

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

describe("startServer", () => {
  test("serves the browser configuration", async () => {
    const config = {
      ...defaultConfig,
      ui: { theme: "dark" as const, view: "preview" as const },
    };
    const server = startServer(tmpdir(), 0, config);

    try {
      const response = await fetch(new URL("/api/config", server.url));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(config);
    } finally {
      server.stop(true);
    }
  });

  test("returns current file authors ordered by attributed lines", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-"));
    const server = startServer(directory, 0);

    try {
      await Bun.write(
        join(directory, "README.md"),
        "Original one\nOriginal two\nOriginal three\n",
      );
      await runGit(directory, ["init", "-q"]);
      await runGit(directory, ["add", "README.md"]);
      await runGit(
        directory,
        [
          "-c",
          "user.name=Test Author",
          "-c",
          "user.email=test@example.com",
          "commit",
          "-qm",
          "Initial commit",
        ],
        {
          GIT_AUTHOR_DATE: "2026-01-02T03:04:05Z",
          GIT_COMMITTER_DATE: "2026-01-02T03:04:05Z",
        },
      );

      await Bun.write(
        join(directory, "README.md"),
        "Original one\nOriginal two\nOcto three\n",
      );
      await runGit(directory, ["add", "README.md"]);
      await runGit(
        directory,
        [
          "-c",
          "user.name=Octo Cat",
          "-c",
          "user.email=123+octocat@users.noreply.github.com",
          "commit",
          "-qm",
          "Edit README",
        ],
        {
          GIT_AUTHOR_DATE: "2026-02-02T03:04:05Z",
          GIT_COMMITTER_DATE: "2026-02-02T03:04:05Z",
        },
      );

      await Bun.write(
        join(directory, "README.md"),
        "Final one\nOriginal two\nOcto three\n",
      );
      await runGit(directory, ["add", "README.md"]);
      await runGit(
        directory,
        [
          "-c",
          "user.name=Test Author",
          "-c",
          "user.email=test@example.com",
          "commit",
          "-qm",
          "Finish README",
        ],
        {
          GIT_AUTHOR_DATE: "2026-03-02T03:04:05Z",
          GIT_COMMITTER_DATE: "2026-03-02T03:04:05Z",
        },
      );

      const response = await fetch(new URL("/api/file?path=README.md", server.url));
      const data = (await response.json()) as {
        history: {
          changedAt: string;
          authors: Array<{
            name: string;
            lines: number;
            avatarUrls: string[];
          }>;
        } | null;
      };

      expect(response.status).toBe(200);
      expect(data.history).toEqual({
        changedAt: "2026-03-02T03:04:05Z",
        authors: [
          {
            name: "Octo Cat",
            lines: 1,
            avatarUrls: [
              "https://github.com/octocat.png?size=48",
              "https://www.gravatar.com/avatar/3bcbf46426749c6fd119648feebe8eb7?d=404&s=48",
            ],
          },
          {
            name: "Test Author",
            lines: 2,
            avatarUrls: [
              "https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?d=404&s=48",
            ],
          },
        ],
      });

      await Bun.write(join(directory, "GITHUB.md"), "# GitHub");
      await runGit(directory, ["add", "GITHUB.md"]);
      await runGit(directory, [
        "-c",
        "user.name=Octo Cat",
        "-c",
        "user.email=123+octocat@users.noreply.github.com",
        "commit",
        "-qm",
        "Add GitHub file",
      ]);

      const githubResponse = await fetch(
        new URL("/api/file?path=GITHUB.md", server.url),
      );
      const githubData = (await githubResponse.json()) as {
        history: {
          authors: Array<{ avatarUrls: string[] }>;
        } | null;
      };

      expect(githubResponse.status).toBe(200);
      expect(githubData.history?.authors[0]?.avatarUrls).toEqual([
        "https://github.com/octocat.png?size=48",
        "https://www.gravatar.com/avatar/3bcbf46426749c6fd119648feebe8eb7?d=404&s=48",
      ]);
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("serves editor, split, and preview view modes", async () => {
    const server = startServer(tmpdir(), 0);

    try {
      const response = await fetch(server.url);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('data-view-mode="editor"');
      expect(html).toContain('data-view-mode="split"');
      expect(html).toContain('data-view-mode="preview"');
    } finally {
      server.stop(true);
    }
  });

  test("serves static files with Bun MIME types", async () => {
    const server = startServer(tmpdir(), 0);

    try {
      const response = await fetch(new URL("/app.js", server.url));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
    } finally {
      server.stop(true);
    }
  });

  test("returns a sorted tree of markdown files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-"));
    const server = startServer(directory, 0);

    try {
      await mkdir(join(directory, "zeta"));
      await Bun.write(join(directory, "zeta", "first.md"), "first");
      await Bun.write(join(directory, "beta.md"), "beta");
      await Bun.write(join(directory, "alpha.md"), "alpha");
      await Bun.write(join(directory, "ignored.txt"), "ignored");

      const response = await fetch(new URL("/api/files", server.url));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        {
          path: "zeta",
          name: "zeta",
          isDirectory: true,
          children: [
            {
              path: "zeta/first.md",
              name: "first.md",
              isDirectory: false,
            },
          ],
        },
        { path: "alpha.md", name: "alpha.md", isDirectory: false },
        { path: "beta.md", name: "beta.md", isDirectory: false },
      ]);
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });
});
