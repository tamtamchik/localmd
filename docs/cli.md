# CLI reference

[Back to README](../README.md)

```text
localmd [directory] [options]
```

| Argument or option | Description |
| --- | --- |
| `directory` | Folder to serve; defaults to the current directory. |
| `-p, --port <number>` | Preferred port, 1–65535. Overrides `server.port`; the default is 3000. |
| `-c, --config <path>` | Explicit TOML config file. |
| `-h, --help` | Print help and exit. |

```sh
localmd
localmd ./docs
localmd ./notes --port 8080
localmd ./docs --config ./configs/docs.toml
```

## Ports and output

The server listens on `127.0.0.1`. If the preferred port is occupied, it tries
higher ports up to 65535. This applies to the default, config, and CLI port alike.
Other startup errors are not retried.

When port 3000 is occupied and 3001 is free, startup looks like this:

```text
  localMD • Local Markdown Editor

  Local    http://127.0.0.1:3001
  Folder   /path/to/docs

  Port 3000 is in use; switched to 3001.

  Press Ctrl+C to stop
```

The address is printed after the server starts. The browser opens that same
address unless `server.open_browser = false`. If opening the browser fails, you
can open the printed address yourself. Terminal colors follow terminal support
and respect `NO_COLOR=1`.

## Stopping and errors

Press `Ctrl+C` to stop. `SIGTERM` also stops the server. Invalid directories,
config files, port values, and server startup failures exit with a non-zero code.

## Development mode

`bun run dev` enables `NODE_ENV=development` and Bun's source watcher.
Development mode includes Bun's development output. Normal launches keep this
output disabled.
