import { join } from "node:path";

export type Theme = "light" | "dark" | "system";
export type ViewMode = "editor" | "split" | "preview";

export interface LocalmdConfig {
  server: {
    port: number;
    openBrowser: boolean;
  };
  ui: {
    theme: Theme;
    view: ViewMode;
  };
  editor: {
    autosave: boolean;
    autosaveDelayMs: number;
    lineNumbers: boolean;
    lineWrapping: boolean;
  };
  preview: {
    gfm: boolean;
    breaks: boolean;
    syntaxHighlighting: boolean;
  };
  files: {
    openReadme: boolean;
  };
}

export const defaultConfig: LocalmdConfig = {
  server: { port: 3000, openBrowser: true },
  ui: { theme: "light", view: "split" },
  editor: {
    autosave: true,
    autosaveDelayMs: 2000,
    lineNumbers: true,
    lineWrapping: true,
  },
  preview: { gfm: true, breaks: true, syntaxHighlighting: true },
  files: { openReadme: true },
};

type TomlSection = Record<string, unknown>;
type Validator = (value: unknown) => boolean;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
export const isPort = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65535;
const isDelay = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";
const isViewMode = (value: unknown): value is ViewMode =>
  value === "editor" || value === "split" || value === "preview";

const configSchema = {
  server: { port: isPort, open_browser: isBoolean },
  ui: { theme: isTheme, view: isViewMode },
  editor: {
    autosave: isBoolean,
    autosave_delay_ms: isDelay,
    line_numbers: isBoolean,
    line_wrapping: isBoolean,
  },
  preview: {
    gfm: isBoolean,
    breaks: isBoolean,
    syntax_highlighting: isBoolean,
  },
  files: { open_readme: isBoolean },
} satisfies Record<keyof LocalmdConfig, Record<string, Validator>>;

function readSection(config: TomlSection, name: string): TomlSection {
  const value = config[name];

  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid localmd.toml value for "${name}"`);
  }

  return value as TomlSection;
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export async function loadConfig(
  directory: string,
  configPath?: string,
): Promise<LocalmdConfig> {
  const filePath = configPath ?? join(directory, "localmd.toml");
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    if (configPath) {
      throw new Error(`Config file "${configPath}" does not exist`);
    }
    return defaultConfig;
  }

  const parsed = Bun.TOML.parse(await file.text()) as TomlSection;
  const config = Object.fromEntries(
    Object.entries(defaultConfig).map(([section, values]) => [section, { ...values }]),
  ) as unknown as LocalmdConfig;

  for (const [sectionName, options] of Object.entries(configSchema)) {
    const source = readSection(parsed, sectionName);
    const target = config[sectionName as keyof LocalmdConfig] as unknown as TomlSection;

    for (const [key, isValid] of Object.entries(options)) {
      const value = source[key];
      if (value === undefined) continue;
      if (!isValid(value)) {
        throw new Error(`Invalid localmd.toml value for "${sectionName}.${key}"`);
      }
      target[camelCase(key)] = value;
    }
  }

  return config;
}
