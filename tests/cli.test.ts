import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("passes an explicit config path to the loader", async () => {
  const configPath = join(tmpdir(), `localmd-missing-${crypto.randomUUID()}.toml`);
  const process = Bun.spawn(
    ["bun", "run", "src/index.ts", "--config", configPath],
    {
      cwd: new URL("..", import.meta.url).pathname,
      stdout: "ignore",
      stderr: "pipe",
    },
  );
  const error = await new Response(process.stderr).text();

  expect(await process.exited).toBe(1);
  expect(error).toContain(`Config file "${configPath}" does not exist`);
});
