#!/usr/bin/env bun

import { parseArgs } from "util";
import { stat } from "fs/promises";
import { resolve } from "path";
import { isPort, loadConfig, type LocalmdConfig } from "./config";
import { startServer } from "./server";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: "string",
      short: "p",
    },
    config: {
      type: "string",
      short: "c",
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
localmd - Local Markdown Editor

Usage: localmd [directory] [options]

Arguments:
  directory    Directory to serve (default: current directory)

Options:
  -p, --port   Port to listen on (overrides localmd.toml)
  -c, --config Path to localmd.toml
  -h, --help   Show this help message

Examples:
  localmd                    # Serve current directory on port 3000
  localmd ./docs             # Serve ./docs directory
  localmd -p 8080            # Serve on port 8080
  localmd -c ./localmd.toml  # Use an explicit config file
  localmd ./notes -p 4000    # Serve ./notes on port 4000
`);
  process.exit(0);
}

const directory = resolve(positionals[0] || ".");
try {
  const info = await stat(directory);
  if (!info.isDirectory()) {
    throw new Error("Not a directory");
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;

  if (code === "ENOENT") {
    console.error(`Error: Directory "${directory}" does not exist`);
  } else if (code === "EACCES" || code === "EPERM") {
    console.error(`Error: Cannot access directory "${directory}"`);
  } else {
    console.error(`Error: "${directory}" is not a directory`);
  }
  process.exit(1);
}

let config: LocalmdConfig;
try {
  const configPath = values.config ? resolve(values.config) : undefined;
  config = await loadConfig(directory, configPath);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const port = values.port === undefined ? config.server.port : Number(values.port);
if (!isPort(port)) {
  console.error(`Error: Invalid port "${values.port}"`);
  process.exit(1);
}

console.log(`
  LocalMD - Local Markdown Editor

  Serving: ${directory}
  URL:     http://localhost:${port}

  Press Ctrl+C to stop
`);

const server = startServer(directory, port, config);

let stopping = false;
const stopServer = async () => {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log("\nStopping LocalMD...");
  await server.stop(true);
  console.log("LocalMD stopped.");
};

process.once("SIGINT", stopServer);
process.once("SIGTERM", stopServer);

if (config.server.openBrowser) {
  const url = `http://localhost:${port}`;
  const openCommand =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const browser = Bun.spawn(openCommand, {
      stdout: "ignore",
      stderr: "ignore",
    });
    browser.unref();
  } catch {
    // Opening the browser is best-effort; the server remains available at the printed URL.
  }
}
