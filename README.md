# localmd

[![Latest Version on NPM][ico-version]][link-npm]
[![CI][ico-ci]][link-ci]
[![Software License][ico-license]](LICENSE)
[![Total Downloads][ico-downloads]][link-downloads]

A Bun-powered local Markdown editor with live preview and automatic saving.

## Installation

Install the command globally:

```bash
bun add --global @tamtamchik/localmd
```

LocalMD requires Bun 1.3 or newer.

## Usage

Run it without installing:

```bash
bunx --bun @tamtamchik/localmd [directory]
```

Or use the globally installed command:

```bash
localmd [directory]
```

The directory defaults to the current working directory. LocalMD opens a browser at
`http://localhost:3000` and lists every Markdown file below that directory.

Options:

```text
-p, --port   Port to listen on (default: 3000)
-h, --help   Show help
```

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

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss
what you would like to change.

## License

MIT

[![Buy Me A Coffee][ico-coffee]][link-coffee]

[ico-coffee]: https://img.shields.io/badge/Buy%20Me%20A-Coffee-%236F4E37.svg?style=flat-square
[ico-version]: https://img.shields.io/npm/v/@tamtamchik/localmd.svg?style=flat-square
[ico-ci]: https://img.shields.io/github/actions/workflow/status/tamtamchik/localmd/ci.yml?branch=main&style=flat-square&label=CI
[ico-license]: https://img.shields.io/npm/l/@tamtamchik/localmd.svg?style=flat-square
[ico-downloads]: https://img.shields.io/npm/dt/@tamtamchik/localmd.svg?style=flat-square

[link-coffee]: https://www.buymeacoffee.com/tamtamchik
[link-npm]: https://www.npmjs.com/package/@tamtamchik/localmd
[link-ci]: https://github.com/tamtamchik/localmd/actions/workflows/ci.yml
[link-downloads]: https://www.npmjs.com/package/@tamtamchik/localmd
