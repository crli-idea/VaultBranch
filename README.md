# VaultBranch

[English](README.md) | [简体中文](README_zh.md)

Git source control inside Obsidian. Desktop only; requires Git and a vault initialized as a Git repository.

## Features

- **Git sidebar**: browse changes, stage files or folders, commit, pull and push; choose a remote/upstream on first Push.
- **Editable diffs**: compare versions side by side, edit changes and restore individual blocks; manual save or optional autosave.
- **Image comparisons**: compare images in Changes, Staged and file history; zoom and pan. SVG defaults to preview with a source switch.
- **Commit graph and file history**: explore branches, merges and past changes, including file renames; resize graph columns and click commit IDs to copy. Dates use YYYY/MM/DD.
- **Branches and Stash**: create or switch branches, save changes, Apply or Pop a selected stash, and confirm before Drop.
- **Conflict resolution**: native two-pane comparison with an editable local result; accept either side or both per conflict, undo choices and swap pane order, then save and stage explicitly.
- **Editor options**: diff folding and navigation, optional JSON/Markdown syntax highlighting, date insertion and Chinese/English UI.
- **Note tables**: optionally render tables without a preceding blank line in Reading view and Live Preview, with native table source styles.

## Installation

Install Git and initialize your vault as a Git repository (`git init` in the vault folder). Git authentication and commit identity use your local Git configuration.

- **BRAT**: add `crli-idea/VaultBranch` in BRAT, then enable VaultBranch under Settings → Community plugins.
- **Manual**: download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/crli-idea/VaultBranch/releases/latest). Put all three in `<vault>/.obsidian/plugins/vaultbranch/`, reload Obsidian, and enable VaultBranch.

## Basic usage

Open **VaultBranch: Open Source Control sidebar** from the command palette. Click a Changed file to compare and edit it; save with Ctrl/Cmd+S. Use **+** to stage a file or folder, enter a commit message, and commit the staged changes. Pull/Push synchronize with your configured remote; first Push lets you choose the remote and upstream. Open Git Graph to browse commits, or right-click a file for File history.

## Capabilities

Desktop only. The plugin uses Node.js filesystem access for repository files and Git metadata, including linked-worktree metadata outside the vault. It runs your installed Git through `execFile` with argument arrays and `shell: false`; Git hooks and credential helpers follow your local Git configuration. These capabilities run with Obsidian's OS permissions. It writes commit hashes or diagnostic logs to the clipboard only when you request Copy; it does not read the clipboard. Release assets receive GitHub provenance attestations, which verify build origin rather than remove these capability warnings.

## Current performance · 1.0.11

Local Windows / Obsidian 1.15.1, compared with 1.0.10. Medians in ms; this repository/review fix makes no speedup claim.

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 7.8 | 5 |
| Click → Staged / Changed page ready | 190.6 / 136.4 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 5.1 / 4.2 / 1.1 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 4.6 / 5.1 / 6.4 | 5 each |

Table compatibility defaults off. Switching includes CPU sampling; typing measures native input to document update. [Environment, ranges, comparison and reproduction](https://github.com/crli-idea/VaultBranch/blob/1.0.11/docs/performance/1.0.11.md) · [Tag 1.0.11](https://github.com/crli-idea/VaultBranch/releases/tag/1.0.11).

## Feedback

Bug reports and feature requests are welcome! [Open an issue](https://github.com/crli-idea/VaultBranch/issues/new/choose).
