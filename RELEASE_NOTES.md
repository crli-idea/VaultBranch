VaultBranch 1.0.9 — folder staging, first Push, Stash Drop and tooltip bug fix.

- Add folder + / − actions, including collapsed/nested descendants, scoped to the selected Changed or Staged group.
- Enable first Push without an upstream: select a configured remote (origin by default) and destination branch, then push and set upstream. Preserve validation and reject non-fast-forward pushes; never force push.
- Add confirmed Drop beside Apply and Pop in Graph Stash details/right-click actions. Resolve the selected hash again before deletion, preserving worktree/index and other stashes when numbers shift. Make the sidebar latest-Stash Pop label explicit.
- Fix oversized overlapping graph tooltips caused by simultaneous title and aria-label hints. Keep one compact native hint and accessible metadata.

Local Windows / Obsidian 1.15.1; ms, median:

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 12.1 | 5 |
| Click → Staged / Changed page ready | 195.7 / 138.6 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 6.6 / 5.5 / 2.1 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 7.9 / 6.8 / 6.1 | 5 each |

First sidebar: 224.1 ms; first diff: 150.2 ms, separately from plugin loading. Warm caches. CPU sampling/logging on for switching and off for typing; highlighting, autosave and table compatibility off. No speedup or physical-paint claim.

Validated in one full release-check run: 157 automated tests, 969 UI assertions and both builds' three performance probes. Final sessions, pending reads, runtime and console errors: zero.

Version/tag: [1.0.9](https://github.com/li-cr/VaultBranch/tree/1.0.9). Baseline: [1.0.8 / 9e22aae94f1ced631b88b9a9820b2b2015667714](https://github.com/li-cr/VaultBranch/tree/1.0.8). Tested source: [e7b02413d81d1f7a5232bf8cda1a2ab2f8310efa](https://github.com/li-cr/VaultBranch/commit/e7b02413d81d1f7a5232bf8cda1a2ab2f8310efa). [Compare 1.0.8...1.0.9](https://github.com/li-cr/VaultBranch/compare/1.0.8...1.0.9).

[Performance report and reproduction](https://github.com/li-cr/VaultBranch/blob/1.0.9/docs/performance/1.0.9.md) · [Raw samples](https://github.com/li-cr/VaultBranch/blob/1.0.9/docs/performance/1.0.9-samples.json). The tag workflow appends the exact release commit.

Release assets retain GitHub provenance attestations. Desktop only; requires Git installed separately.
