VaultBranch 1.0.11 — repository migration and review fixes.

- Point current README, package metadata and build banner to crli-idea/VaultBranch. Keep author/license attribution and historical release reports.
- Add BRAT/manual installation, basic usage and accurate filesystem/Git/clipboard capability disclosures. No clipboard reads.
- Replace the SVG description-row :has selector with an explicit scoped class; preserve icon layout and row height. Add a validation guard against relational selectors.
- Generate and verify provenance for all three assets under the current repository and release workflow. Older releases are retained unchanged.

Local Windows / Obsidian 1.15.1; ms, median:

| Measurement | ms | Samples |
| --- | ---: | --- |
| Plugin reload (warm cache) | 7.8 | 5 |
| Click → Staged / Changed page ready | 190.6 / 136.4 | 20 each |
| Changed 1.6 MB JSON: type / Enter / Backspace | 5.1 / 4.2 / 1.1 | 5 each |
| Changed 1.28 MB Markdown: type / Enter / Backspace | 4.6 / 5.1 / 6.4 | 5 each |

First sidebar: 163.5 ms; first diff: 113.8 ms, separately from plugin loading. Warm caches. CPU sampling/logging on for switching and off for typing; highlighting, autosave and table compatibility off. No speedup or physical-paint claim. Switching differences changed direction in a reverse-order follow-up with substantially higher Git subprocess times for both builds; both runs are retained in the report.

Validated in one full release-check run: 160 automated tests, 1012 UI assertions and both builds' three performance probes. Final sessions, pending reads, runtime and console errors: zero.

Version/tag: [1.0.11](https://github.com/crli-idea/VaultBranch/tree/1.0.11). Baseline: [1.0.10 / f06938d46e6bdda766dfd03de66b9a5aca5a719a](https://github.com/crli-idea/VaultBranch/tree/1.0.10). Tested source: [63a2904e94d13b70fc903b74676d4c0033fabf78](https://github.com/crli-idea/VaultBranch/commit/63a2904e94d13b70fc903b74676d4c0033fabf78). [Compare 1.0.10...1.0.11](https://github.com/crli-idea/VaultBranch/compare/1.0.10...1.0.11).

[Performance report and reproduction](https://github.com/crli-idea/VaultBranch/blob/1.0.11/docs/performance/1.0.11.md) · [Raw samples](https://github.com/crli-idea/VaultBranch/blob/1.0.11/docs/performance/1.0.11-samples.json). The tag workflow appends the exact release commit.

Release assets retain GitHub provenance attestations. Desktop only; requires Git installed separately.
