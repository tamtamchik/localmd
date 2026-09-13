#!/usr/bin/env bun

import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs, styleText } from "node:util";

import type { LocalmdConfig } from "./config";
import { isPort, loadConfig } from "./config";
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
localMD - Local Markdown Editor

Usage: localmd [directory] [options]

Arguments:
  directory    Directory to serve (default: current directory)

Options:
  -p, --port   Preferred port (overrides localmd.toml; default: 3000)
  -c, --config Path to localmd.toml
  -h, --help   Show this help message

Examples:
  localmd                    # Serve current directory, starting at port 3000
  localmd ./docs             # Serve ./docs directory
  localmd -p 8080            # Start looking for a free port at 8080
  localmd -c ./localmd.toml  # Use an explicit config file
  localmd ./notes -p 4000    # Serve ./notes, starting at port 4000

If the preferred port is in use, localMD tries higher ports up to 65535.
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

const color = (format: Parameters<typeof styleText>[0], text: string) =>
  process.stdout.isTTY && !("NO_COLOR" in process.env) ? styleText(format, text) : text;

const server = startServer(directory, port, config);
const url = server.url.origin;
const portNotice =
  server.port !== port
    ? `\n  ${color("yellow", `Port ${port} is in use; switched to ${server.port}.`)}\n`
    : "";

console.log(`
  ${color(["bold", "green"], "localMD")} ${color("dim", "• Local Markdown Editor")}

  ${color("dim", "Local")}    ${color(["bold", "cyan"], url)}
  ${color("dim", "Folder")}   ${directory}
${portNotice}
  ${color("dim", "Press Ctrl+C to stop")}
`);

let stopping = false;
const stopServer = async () => {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log("\nStopping localMD...");
  await server.stop(true);
  console.log("localMD stopped.");
};

process.once("SIGINT", stopServer);
process.once("SIGTERM", stopServer);

if (config.server.openBrowser) {
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
