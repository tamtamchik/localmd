# localmd

A Bun-powered local Markdown editor with live preview and automatic saving.

## Usage

Run it without installing:

```bash
bunx --bun localmd [directory]
```

The directory defaults to the current working directory. LocalMD opens a browser at
`http://localhost:3000` and lists every Markdown file below that directory.

Options:

```text
-p, --port   Port to listen on (default: 3000)
-h, --help   Show help
```

To install the command globally:

```bash
bun add --global localmd
localmd ./docs
```

LocalMD requires Bun 1.3 or newer.

## Development

```bash
bun install
bun run check
```

Dependency resolution excludes package versions published within the last 10 days.

Start the development server:

```bash
bun run dev
```

## License

MIT
