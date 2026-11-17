VaultBranch 1.0.8 — native two-pane conflict resolution and bug fixes.

- Show the incoming/upstream version beside an editable **Local · Merge result**; switch pane order under Other. No third result pane.
- Navigate real conflicts, accept either displayed side or both, undo choices and mark each conflict resolved. Preserve automatic Git merges and common context when combining both sides.
- Fix consecutive acceptance losing the original local candidate and distinct conflicts appearing as one highlighted change. Keep native CodeMirror light/dark colors and unchanged lines aligned.
- Keep drafts until explicit completion; reject stale working-file or index changes before saving and staging. Preserve existing Changed/Staged/history workflows.
- Prevent background status queries from taking optional index-refresh locks that can compete with explicit staging/resolution. Keep live status reads and normal mutation locks.

Local Windows / Obsidian 1.15.0; ms, median:

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 27.8 | 5 |
| Click → Staged / Changed page ready | 312.4 / 222.1 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 9.2 / 9.7 / 2.7 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 13.5 / 11.6 / 16.2 | 5 each |

First sidebar: 796.5 ms; first diff: 788.5 ms, measured separately from plugin load. Warm caches; switching includes CPU sampling, editing uses trusted native input to document update. Autosave, syntax highlighting and table compatibility are off. No speedup or physical-paint claim. Baseline comparisons, ranges and any follow-up probes are retained in the report.

Validated in one complete release-check run: 153 automated tests, 938 UI assertions (523 conflict assertions), both builds' three performance probes; final sessions, pending reads, runtime and console errors: zero.

Version/tag: [1.0.8](https://github.com/li-cr/VaultBranch/tree/1.0.8). Baseline: [1.0.7 / e7b50357f9aeb3189c3b330466e3af290e2ce7a9](https://github.com/li-cr/VaultBranch/tree/1.0.7). Tested source: [d14121591feb4cfc095a9b1125983167d5a30fab](https://github.com/li-cr/VaultBranch/commit/d14121591feb4cfc095a9b1125983167d5a30fab). [Compare 1.0.7...1.0.8](https://github.com/li-cr/VaultBranch/compare/1.0.7...1.0.8).

[Performance report and reproduction](https://github.com/li-cr/VaultBranch/blob/1.0.8/docs/performance/1.0.8.md) · [Raw samples](https://github.com/li-cr/VaultBranch/blob/1.0.8/docs/performance/1.0.8-samples.json). The tag workflow appends the exact release commit.

Release assets retain GitHub provenance attestations. Desktop only; requires Git installed separately.
