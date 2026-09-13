import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startServer } from "../src/server";

test("prints the selected port and serves the page without bundler logs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "localmd-cli-"));
  const occupied = startServer(directory, 0);
  await Bun.write(join(directory, "localmd.toml"), "[server]\nopen_browser = false\n");
  const child = Bun.spawn(
    ["bun", "run", "src/index.ts", directory, "--port", String(occupied.port)],
    {
      cwd: new URL("..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...Bun.env, NO_COLOR: "1", NODE_ENV: "production" },
    },
  );
  const reader = child.stdout.getReader();
  let output = "";

  try {
    while (!output.includes("Press Ctrl+C to stop")) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`CLI exited before startup: ${output}`);
      output += new TextDecoder().decode(value);
    }
    const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    expect(url).toBeDefined();
    expect(Number(new URL(url!).port)).toBeGreaterThan(occupied.port!);
    expect(output).toContain(`Port ${occupied.port} is in use; switched to`);
    expect(output).toContain(directory);
    expect(output).not.toContain("\u001b[");
    const response = await fetch(url!);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<!DOCTYPE html>");
  } finally {
    child.kill();
    await child.exited;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output += new TextDecoder().decode(value);
    }
    occupied.stop(true);
    await rm(directory, { recursive: true, force: true });
  }

  expect(output).not.toContain("Bundled page");
  expect(await new Response(child.stderr).text()).toBe("");
});

test("passes an explicit config path to the loader", async () => {
  const configPath = join(tmpdir(), `localmd-missing-${crypto.randomUUID()}.toml`);
  const process = Bun.spawn(["bun", "run", "src/index.ts", "--config", configPath], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "ignore",
    stderr: "pipe",
  });
  const error = await new Response(process.stderr).text();

  expect(await process.exited).toBe(1);
  expect(error).toContain(`Config file "${configPath}" does not exist`);
});
