# @itslil/remark-rehype

Official [`remark-rehype@11.1.2`](https://github.com/remarkjs/remark-rehype) algorithms rewritten in LilScript. Upstream-derived and package tests 19/19. Not affiliated with upstream.

**Site:** [yeargun.github.io/remark-rehypelil/](https://yeargun.github.io/remark-rehypelil/)

```sh
npm install @itslil/remark-rehype
```

Two compiles ship from the same `.lil` source:

The runtime is bundled, so `src/entry.lil` and `src/hast/` group the upstream plugin and conversion graph for whole-program optimization. The declaration file likewise merges upstream's root and public `lib` types into one artifact while retaining the exact public API.

| Lane | Config | Meaning |
| --- | --- | --- |
| **library** (npm) | `lilscript.toml` · `--target js-module` | reusable ESM. Export names and `extern class` keys stay. |
| **closed** | `lilscript.closed.toml` · `--target js-module` | the same program at a lower effort level (12, no candidate search). This compiler renames no properties, so it no longer differs from the library lane in what it mangles. |

You publish the library lane. `dist/remark-rehype.closed.js` is diagnostic only.

## Size

Built by the one LilScript compiler, revision `24968659` (binary SHA-256 `47048e41…3041`), measured with `lilscript-codec` (gzip-9, Brotli-11). The bar is the official `remark-rehype@11.1.2` runtime graph bundled by esbuild (`site/official.js`), then Terser 5.51.2 (module, compress passes 3, mangle), the strongest of Terser, Oxc and esbuild on every codec.

| File | Raw | gzip-9 | Brotli-11 |
| --- | ---: | ---: | ---: |
| Official graph · Terser mangle (bar) | 16,855 | 5,443 | 4,908 |
| Official graph · Oxc mangle (Vite 8.2.1) | 16,875 | 5,563 | 5,056 |
| Official graph · esbuild minify | 17,438 | 5,824 | 5,287 |
| Official, built from its Git source (b5a2e5b) · Terser mangle | 17,051 | 5,529 | 5,000 |
| **`dist/remark-rehype.esm.js`** (npm) | **16,264** | **5,152** | **4,610** |
| Previous release (b5ae9f7, LilScript aa2052f0) | 16,701 | 5,170 | 4,632 |

The npm ESM is 298 B (6.1%) under Terser in Brotli, 291 B in gzip and 591 B raw. It is 22 B Brotli (0.5%) smaller than the previous release, which LilScript aa2052f0 built. The earlier releases showed a Terser bar of 4,910; Terser 5.43.1 reproduces it byte for byte, and Terser 5.51.2 gives 4,908.

Every delivered file is compiler-written: the ESM is the compiler's output with a license banner, and `dist/remark-rehype.cjs` (require) and `dist/remark-rehype.umd.js` (browser script, sets `globalThis.remarkRehype`) wrap the same program, with its export clause replaced by `module.exports` or the global. No minifier runs after the compiler; the esbuild reprints of the CommonJS and browser files went away in the 2026-09-24 release (now CommonJS 4,638 Brotli, browser script 4,632).

## Compile time

The site shows the compiler's wall time over three clean builds (`npm run record:release`, which also records sizes and throughput into `site/results.json`). On 2026-09-27, on a shared Azure Standard_B8als_v2 (8 vCPUs, 1-minute load average 4.75 before and 4.75 after), the shipped ESM compiled in 555.8 / 679.3 / 547.6 ms, and both compiles of a build took 655.8 / 748.6 / 677.0 ms. The previous release's ESM compile took 201.6 / 199.4 / 199.8 ms on Azure Standard_B8als_v2, 8 vCPUs (the 2026-09-24 release record, 1-minute load average 5.4).

The paired source builds (`comparison/source-build/`, `site/source-build.json`) time each repository's own package build on the same host: the LilScript package build takes 1.12 s median, upstream's `npm run build` 6.57 s median (1-minute load average 10.3 at the start, 14.8 at the end). The two builds produce different outputs, so this is context, not a speedup claim.

```sh
LILSCRIPT_COMPILER=… LILSCRIPT_CODEC=… npm run record:release -- --revision 24968659 --previous b5ae9f7
```

The LilScript compiler lives next door at `../lilscript`.
