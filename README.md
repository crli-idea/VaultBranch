# VaultBranch

[English](README.md) | [简体中文](README_zh.md)

Git source control inside Obsidian. Desktop only; requires Git and a vault initialized as a Git repository.

## Features

- **Git sidebar**: browse changes, stage files or folders, commit, pull and push; choose a remote/upstream on first Push.
- **Editable diffs**: compare versions side by side, edit changes and restore individual blocks; manual save or optional autosave.
- **Image comparisons**: compare images in Changes, Staged and file history; zoom and pan. SVG defaults to preview with a source switch.
- **Commit graph and file history**: explore branches, merges and past changes, including file renames.
- **Branches and Stash**: create or switch branches, save changes, Apply or Pop a selected stash, and confirm before Drop.
- **Conflict resolution**: native two-pane comparison with an editable local result; accept either side or both per conflict, undo choices and swap pane order, then save and stage explicitly.
- **Editor options**: diff folding and navigation, optional JSON/Markdown syntax highlighting, date insertion and Chinese/English UI.
- **Note tables**: optionally render tables without a preceding blank line in Reading view and Live Preview, with native table source styles.

## Current performance · 1.0.9

Local Windows / Obsidian 1.15.1, compared with 1.0.8. Medians in ms; this action/tooltip release makes no speedup claim.

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 12.1 | 5 |
| Click → Staged / Changed page ready | 195.7 / 138.6 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 6.6 / 5.5 / 2.1 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 7.9 / 6.8 / 6.1 | 5 each |

Table compatibility defaults off. Switching includes CPU sampling; typing measures native input to document update. [Environment, ranges, comparison and reproduction](https://github.com/li-cr/VaultBranch/blob/1.0.9/docs/performance/1.0.9.md) · [Tag 1.0.9](https://github.com/li-cr/VaultBranch/releases/tag/1.0.9).

## Feedback

Bug reports and feature requests are welcome! [Open an issue](https://github.com/li-cr/VaultBranch/issues/new/choose).
