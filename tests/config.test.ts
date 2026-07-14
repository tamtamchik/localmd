import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig, loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("uses defaults when localmd.toml is absent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-config-"));

    try {
      expect(await loadConfig(directory)).toEqual(defaultConfig);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("loads every supported option from localmd.toml", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-config-"));

    try {
      await Bun.write(
        join(directory, "localmd.toml"),
        `
[server]
port = 4321
open_browser = false

[ui]
theme = "dark"
view = "preview"

[editor]
autosave = false
autosave_delay_ms = 750
line_numbers = false
line_wrapping = false

[preview]
gfm = false
breaks = false
syntax_highlighting = false

[files]
open_readme = false
`,
      );

      expect(await loadConfig(directory)).toEqual({
        server: { port: 4321, openBrowser: false },
        ui: { theme: "dark", view: "preview" },
        editor: {
          autosave: false,
          autosaveDelayMs: 750,
          lineNumbers: false,
          lineWrapping: false,
        },
        preview: { gfm: false, breaks: false, syntaxHighlighting: false },
        files: { openReadme: false },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("loads an explicitly selected config outside the served directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-config-"));
    const configDirectory = await mkdtemp(join(tmpdir(), "localmd-config-file-"));
    const configPath = join(configDirectory, "docs.toml");

    try {
      await Bun.write(configPath, '[server]\nport = 4567\n');

      expect((await loadConfig(directory, configPath)).server.port).toBe(4567);
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(configDirectory, { recursive: true, force: true });
    }
  });

  test("rejects a missing explicitly selected config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-config-"));
    const configPath = join(directory, "missing.toml");

    try {
      await expect(loadConfig(directory, configPath)).rejects.toThrow(
        `Config file "${configPath}" does not exist`,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("reports invalid values with their TOML path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "localmd-config-"));

    try {
      await Bun.write(join(directory, "localmd.toml"), '[ui]\ntheme = "sepia"\n');

      await expect(loadConfig(directory)).rejects.toThrow(
        'Invalid localmd.toml value for "ui.theme"',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
