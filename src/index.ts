#!/usr/bin/env bun

import { parseArgs } from "util";
import { stat } from "fs/promises";
import { resolve } from "path";
import { startServer } from "./server";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: "string",
      short: "p",
      default: "3000",
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
  -p, --port   Port to listen on (default: 3000)
  -h, --help   Show this help message

Examples:
  localmd                    # Serve current directory on port 3000
  localmd ./docs             # Serve ./docs directory
  localmd -p 8080            # Serve on port 8080
  localmd ./notes -p 4000    # Serve ./notes on port 4000
`);
  process.exit(0);
}

const directory = resolve(positionals[0] || ".");
const port = parseInt(values.port!, 10);

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

console.log(`
  LocalMD - Local Markdown Editor

  Serving: ${directory}
  URL:     http://localhost:${port}

  Press Ctrl+C to stop
`);

startServer(directory, port);

// Open browser
const openCommand =
  process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";

Bun.$`${openCommand} http://localhost:${port}`.quiet();
