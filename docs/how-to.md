# How-to guides

[Back to README](../README.md)

## Edit a documentation folder

```sh
localmd ./docs
```

Select a `.md` file from the sidebar. Use the toolbar to switch between editor,
split, and preview views. Changes save automatically after two seconds without
typing by default. The Save button or `Cmd+S` / `Ctrl+S` saves immediately.

## Run two folders at once

Start each command in a separate terminal:

```sh
localmd ./docs
localmd ./notes
```

The first instance tries port 3000. The next skips occupied ports and prints its
own address. You can also choose a starting port with `localmd ./notes -p 8080`.
Use the address printed by each process to open the corresponding folder.
Each browser tab shows its folder name, such as `docs · localMD`.

## Start without opening a browser

Create `localmd.toml` in the served folder:

```toml
[server]
open_browser = false
```

Start localMD and open the printed address when needed.

## Save manually

```toml
[editor]
autosave = false
```

Use the Save button or `Cmd+S` / `Ctrl+S`. The status beside the button shows
whether the file is saved, saving, unsaved, or failed to save.

## Choose a theme and layout

```toml
[ui]
theme = "system"
view = "preview"
```

The toolbar lets you change the theme and layout. Saved browser choices override
the config defaults. Reloading restores the open file, expanded folders, cursor,
and editor scroll position. Preferences are separate for each host and port;
clear the site's browser storage to return to the config defaults.

## Work offline

The editor's JavaScript, styles, and syntax highlighter are bundled and served
locally after installation. Git author avatars and remote images linked from
Markdown may still need internet access. Git history is shown when the file is
tracked and Git is available.

See the [configuration reference](configuration.md) for all settings and the
[CLI reference](cli.md) for startup options.
