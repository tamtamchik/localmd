# Configuration reference

[Back to README](../README.md)

localMD reads `localmd.toml` from the directory being served. Every setting is
optional; omitted settings use the defaults below. Unknown keys are ignored.
Invalid values stop startup with an error identifying the setting.

```toml
[server]
port = 3000
open_browser = true

[ui]
theme = "light" # light, dark, or system
view = "split"  # editor, split, or preview

[editor]
autosave = true
autosave_delay_ms = 2000
line_numbers = true
line_wrapping = true

[preview]
gfm = true
breaks = false # render soft line breaks as <br>
syntax_highlighting = true

[files]
open_readme = true
```

| Setting | Accepted values | Behavior |
| --- | --- | --- |
| `server.port` | Integer, 1–65535 | Preferred port; busy ports are skipped until an available higher port is found. |
| `server.open_browser` | Boolean | Open the selected URL in your default browser at startup. |
| `ui.theme` | `light`, `dark`, `system` | Initial theme; a saved browser choice takes precedence. |
| `ui.view` | `editor`, `split`, `preview` | Initial layout; a saved browser view takes precedence. |
| `editor.autosave` | Boolean | Save after you stop typing. |
| `editor.autosave_delay_ms` | Non-negative integer | Wait time in milliseconds before autosave. |
| `editor.line_numbers` | Boolean | Display editor line numbers. |
| `editor.line_wrapping` | Boolean | Wrap long lines in the editor. |
| `preview.gfm` | Boolean | Enable GitHub-flavored Markdown features. |
| `preview.breaks` | Boolean | Treat a single newline as a visible line break. |
| `preview.syntax_highlighting` | Boolean | Highlight fenced code blocks in the preview. |
| `files.open_readme` | Boolean | Open a README when there is no saved file to restore. |

## Precedence and paths

`--port` overrides `server.port`. Both specify the first port to try, not a fixed
port. localMD tries through 65535 and fails if none is available. It prints and
opens the port it actually bound.

Use `--config` to select a file outside the served directory:

```sh
localmd ./docs --config ./configs/docs.toml
```

The directory and explicit config path are resolved from the current working
directory. An explicit config replaces the automatically discovered file; the two
files are not merged. A missing explicit file is an error, while an absent
`localmd.toml` in the served directory uses the defaults.

The browser remembers the selected theme, file, view, expanded folders, cursor,
and editor scroll position. A remembered file takes precedence over
`files.open_readme`. Browser storage belongs to the URL's origin, so another port
or hostname has separate saved preferences.
