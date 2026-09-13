# Changelog

## 1.3.0

- Automatically try higher ports when the preferred port is occupied, allowing
  multiple instances to run alongside one another.
- Print the selected address after startup and open that address in the browser.
- Identify each browser tab by its folder name, for example `docs · localMD`.
- Use a compact, colored startup display with a port-change notice and suppress
  normal-mode bundler logs. Development output remains available with `bun run dev`.
- Bind explicitly to `127.0.0.1` with port sharing disabled. Browser preferences
  previously stored under `localhost` remain at that origin; choose them again at
  the new address if needed.
- Add Biome formatting, lint, and import checks to `bun run check` and CI.
- Refresh the README with a light paper banner, `localMD` branding, and dedicated
  usage, CLI, and configuration guides.

Earlier releases are listed on [GitHub Releases](https://github.com/tamtamchik/localmd/releases).
