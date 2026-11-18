VaultBranch 1.0.10 — padded dates, resizable history columns and commit hash copying.

- Standardize graph dates as YYYY/MM/DD, with padded month/day. File history uses YYYY/MM/DD HH:mm:ss in local time.
- Resize Commit message, Date, Author and Commit columns by dragging header separators. Remember widths; support arrow keys, double-click/Home reset and horizontal scrolling in narrow panes.
- Click a short commit ID to copy its full hash without selecting or opening that commit. Preserve keyboard row selection and avoid nested buttons or duplicate hints.
- Update CSS during drags, then save once on release. Four native drag checks confirm no Git history/detail reads, no row replacements and no settings writes during pointer movement.

Local Windows / Obsidian 1.15.1; ms, median:

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 12.2 | 5 |
| Click → Staged / Changed page ready | 214.8 / 159.2 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 4.8 / 8.5 / 1.1 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 6.5 / 5.1 / 6.4 | 5 each |

First sidebar: 204.9 ms; first diff: 140.0 ms, separately from plugin loading. Warm caches. CPU sampling/logging on for switching and off for typing; highlighting, autosave and table compatibility off. No speedup or physical-paint claim.

Validated in one full release-check run: 160 automated tests, 1012 UI assertions and both builds' three performance probes. Final sessions, pending reads, runtime and console errors: zero.

Version/tag: [1.0.10](https://github.com/li-cr/VaultBranch/tree/1.0.10). Baseline: [1.0.9 / f7c46a4437368afb36754177ef87dba8be160af0](https://github.com/li-cr/VaultBranch/tree/1.0.9). Tested source: [84b6f394273b28ab07a58ff44be8cd793610485d](https://github.com/li-cr/VaultBranch/commit/84b6f394273b28ab07a58ff44be8cd793610485d). [Compare 1.0.9...1.0.10](https://github.com/li-cr/VaultBranch/compare/1.0.9...1.0.10).

[Performance report and reproduction](https://github.com/li-cr/VaultBranch/blob/1.0.10/docs/performance/1.0.10.md) · [Raw samples](https://github.com/li-cr/VaultBranch/blob/1.0.10/docs/performance/1.0.10-samples.json). The tag workflow appends the exact release commit.

Release assets retain GitHub provenance attestations. Desktop only; requires Git installed separately.
