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
| Official graph · Terser mangle (bar) | 17,050 | 5,527 | 4,998 |
| Official graph · Oxc mangle (Vite 8.2.1) | 17,073 | 5,658 | 5,149 |
| Official graph · esbuild minify | 17,638 | 5,921 | 5,386 |
| Official, built from its Git source (b5a2e5b) · Terser mangle | 17,051 | 5,529 | 5,000 |
| **`dist/remark-rehype.esm.js`** (npm) | **19,722** | **6,188** | **5,528** |

The npm ESM is 530 B (10.6%) larger than Terser in Brotli, 661 B larger in gzip and 2,672 B larger raw. Both carry @ungap/structured-clone's polyfill for runtimes without structuredClone, which upstream ships and this port matches since 11.1.6; the bars are measured on the graph a fresh install resolves (@ungap/structured-clone 1.4.0).

Every delivered file is compiler-written: the ESM is the compiler's output with a license banner, and `dist/remark-rehype.cjs` (require) and `dist/remark-rehype.umd.js` (browser script, sets `globalThis.remarkRehype`) wrap the same program, with its export clause replaced by `module.exports` or the global. No minifier runs after the compiler; the esbuild reprints of the CommonJS and browser files went away in the 2026-09-24 release (now CommonJS 4,621 Brotli, browser script 4,581).

## Compile time

The site shows the compiler's wall time over three clean builds (`npm run record:release`, which also records sizes and throughput into `site/results.json`). On 2026-09-28, on a shared Azure Standard_B8als_v2 (8 vCPUs, 1-minute load average 1.61 before and 1.61 after), the shipped ESM compiled in 531.4 / 514.9 / 516.8 ms, and both compiles of a build took 591.0 / 580.4 / 582.0 ms.

The paired source builds (`comparison/source-build/`, `site/source-build.json`) time each repository's own package build on the same host: the LilScript package build takes 0.72 s median, upstream's `npm run build` 2.97 s median (1-minute load average 1.6 at the start, 1.8 at the end). The two builds produce different outputs, so this is context, not a speedup claim.

```sh
LILSCRIPT_COMPILER=… LILSCRIPT_CODEC=… npm run record:release -- --revision 24968659
```

The LilScript compiler lives next door at `../lilscript`.
