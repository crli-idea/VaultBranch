VaultBranch 1.0.12 — UI state and settings bug fixes.

- Restore displayed settings when a Git-busy guard rejects a change. Apply text preferences on Enter/blur, normalize numeric values visibly, and apply a completed Git path once.
- Disable unavailable graph toolbar/detail/menu actions while Git is busy or a merge/conflict is active; keep Fetch available during conflicts. Keep backend Git and draft guards.
- Add a zero-match graph search message without hiding graph rows, graph Up/Down/Home/End focus navigation, and sidebar tree navigation/expand/collapse keys.
- Synchronize conflict action tooltips/accessibility labels and add refresh to conflict error pages. Preserve result drafts and explicit save/stage behavior.
- Use a neutral Pull command name for both configured pull methods, translate diff autosave, and simplify settings descriptions.

Local Windows / Obsidian 1.15.1; ms, median:

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 9.3 | 5 |
| Click → Staged / Changed page ready | 148.5 / 110.4 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 4.8 / 5.5 / 1.4 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 5.2 / 4.6 / 4.5 | 5 each |

First sidebar: 162.6 ms; first diff: 115.3 ms, measured separately from plugin loading. Warm caches. CPU sampling/logging on for switching and off for typing; highlighting, autosave and table compatibility off. No general speedup or physical-paint claim.

Validated in one full release-check run: 160 automated tests, 1077 UI assertions and both builds' three performance probes. Final sessions, pending reads, runtime and console errors: zero.

Version/tag: [1.0.12](https://github.com/crli-idea/VaultBranch/tree/1.0.12). Baseline: [1.0.11 / 9b811f4572fa62de70975fb3dbaefd155a579302](https://github.com/crli-idea/VaultBranch/tree/1.0.11). Tested source: [c906a5d22c332c0717c26c49aa3b286a2308a1ec](https://github.com/crli-idea/VaultBranch/commit/c906a5d22c332c0717c26c49aa3b286a2308a1ec). [Compare 1.0.11...1.0.12](https://github.com/crli-idea/VaultBranch/compare/1.0.11...1.0.12).

[Performance report and reproduction](https://github.com/crli-idea/VaultBranch/blob/1.0.12/docs/performance/1.0.12.md) · [Raw samples](https://github.com/crli-idea/VaultBranch/blob/1.0.12/docs/performance/1.0.12-samples.json). The tag workflow appends the exact release commit.

Release assets retain GitHub provenance attestations. Desktop only; requires Git installed separately.
