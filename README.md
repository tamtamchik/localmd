<h1 align="center">
  <img src="assets/banner.webp" alt="localMD" width="100%" />
</h1>

<p align="center">
  Edit your Markdown files locally, with a live preview.
</p>

<p align="center">
  <a href="https://github.com/tamtamchik/localmd/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/tamtamchik/localmd/ci.yml?branch=main&style=flat-square&label=CI" /></a>
  <a href="https://www.npmjs.com/package/@tamtamchik/localmd"><img alt="npm version" src="https://img.shields.io/npm/v/@tamtamchik/localmd?style=flat-square" /></a>
  <a href="https://bun.com"><img alt="Bun 1.3 or newer" src="https://img.shields.io/badge/Bun-1.3%2B-fbf0df?style=flat-square&logo=bun&logoColor=white" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/tamtamchik/localmd?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@tamtamchik/localmd"><img alt="npm downloads" src="https://img.shields.io/npm/dt/@tamtamchik/localmd?style=flat-square" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="docs/how-to.md">How-To Guides</a> ·
  <a href="docs/configuration.md">Configuration Reference</a> ·
  <a href="docs/cli.md">CLI Reference</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

localMD opens a folder of Markdown files in your browser. Browse the file tree,
edit with syntax highlighting, and see the rendered result as you type. Changes
save directly to disk, so your notes stay in the folders and Git repositories you
already use.

## Quick start

Requirements: [Bun 1.3 or newer](https://bun.com).

Run it without a global install:

```sh
bunx --bun @tamtamchik/localmd ./docs
```

Or install the command:

```sh
bun add --global @tamtamchik/localmd
localmd ./docs
```

Omit `./docs` to serve the current directory. localMD opens your browser and prints
the address:

```text
  localMD • Local Markdown Editor

  Local    http://127.0.0.1:3000
  Folder   /path/to/docs

  Press Ctrl+C to stop
```

If port 3000 is busy, it selects the next available port. Run another command in a
second terminal to edit a different folder alongside the first.

## What it does

- Browse Markdown files in a nested folder tree.
- Switch between editor, split, and preview views with synchronized scrolling.
- Render GitHub-flavored Markdown, tables, task lists, and highlighted code blocks.
- Save automatically, or use the Save button and `Cmd+S` / `Ctrl+S`.
- Choose a light, dark, or system theme and restore your editor session on reload.
- Show the last Git change and authors for tracked files.
- Run multiple instances on separate local ports, with bundled editor assets.

Set defaults in [`localmd.toml`](docs/configuration.md), or start with the
[how-to guides](docs/how-to.md) for common workflows.

## Development

```sh
bun install
bun run dev
```

Run the same checks as CI:

```sh
bun run check     # Biome, TypeScript, and tests
bun run lint      # Lint, formatting, and import checks
bun run lint:fix  # Apply safe fixes
bun run format   # Format TypeScript, JavaScript, and JSON
```

Biome uses two-space indentation, separates built-in, package, and local imports
with blank lines, and uses separate `import type` declarations. Run
`bun run lint:fix` to apply formatting and import organization together.
Dependency resolution excludes versions
published within the last 10 days. `bun run dev` enables development mode and
restarts the server when source files change; ordinary launches keep bundler logs
out of the terminal.

Pull requests, bug reports, and feature requests are welcome.

## License

[MIT](LICENSE)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20A-Coffee-%236F4E37?style=flat-square)](https://www.buymeacoffee.com/tamtamchik)
