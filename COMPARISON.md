# Current comparison with the original

Portable main-entry ESM with matching shared named exports and external imports. The original uses production/default package conditions. Package Node, browser and development variants are tested separately.

Each compression row uses a separate LilScript compilation targeting that objective. Original results are the smallest of Terser, esbuild and Oxc for the named codec.

| Objective | LilScript bytes | Original minified bytes | Original minifier | LilScript build (s) | Original bundle + minify (s) |
|---|---:|---:|---|---:|---:|
| raw | 17,535 | 17,050 | Terser | 61.756 | 0.503 |
| gzip | 5,998 | 5,527 | Terser | 58.284 | 0.503 |
| brotli | 5,446 | 4,998 | Terser | 142.947 | 0.503 |

Original version: `remark-rehype@11.1.2`. gzip level 9; Brotli quality 11/window 22. Each time is one sequential fresh-output build on the recorded shared machine. Original timing starts from installed ESM and does not include the original repository’s TypeScript compilation. Dependency installation, tests and final file compression are excluded.

Validation: 30 checks across raw, gzip and Brotli main entries. This does not cover every package format or establish complete upstream API equivalence.

[Artifacts, hashes and settings](site/comparison.json) · [Commands, source identities and timings](site/comparison-builds.json) · [Exact checked source inputs](site/comparison-artifacts/sources.tar.gz).
