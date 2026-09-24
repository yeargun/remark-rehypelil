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

Built by the one LilScript compiler, revision `aa2052f0` (binary SHA-256 `13cb49a9…18f9`), measured with `lilscript-codec` (gzip-9, Brotli-11). The bar is the official `remark-rehype@11.1.2` runtime graph bundled by esbuild (`site/official.js`), then Terser 5.51.2 (module, compress passes 3, mangle), the strongest of Terser, Oxc and esbuild on every codec.

| File | Raw | gzip-9 | Brotli-11 |
| --- | ---: | ---: | ---: |
| Official graph · Terser mangle (bar) | 16,855 | 5,443 | 4,908 |
| Official graph · Oxc mangle (Vite 8.2.1) | 16,875 | 5,563 | 5,056 |
| Official graph · esbuild minify | 17,438 | 5,824 | 5,287 |
| Official, built from its Git source (b5a2e5b) · Terser mangle | 17,051 | 5,529 | 5,000 |
| **`dist/remark-rehype.esm.js`** (npm) | **16,701** | **5,170** | **4,632** |
| Previous release (81580d7, old compiler route 4dc4e33) | 14,290 | 4,823 | 4,333 |

The npm ESM is 276 B (5.6%) under Terser in Brotli, 273 B in gzip and 154 B raw. It is 299 B Brotli (6.9%) larger than the previous release, which the deleted old compiler route built. The earlier releases showed a Terser bar of 4,910; Terser 5.43.1 reproduces it byte for byte, and Terser 5.51.2 gives 4,908.

Every delivered file is compiler-written: the ESM is the compiler's output with a license banner, and `dist/remark-rehype.cjs` (require) and `dist/remark-rehype.umd.js` (browser script, sets `globalThis.remarkRehype`) wrap the same program, with its export clause replaced by `module.exports` or the global. No minifier runs after the compiler; the earlier esbuild reprints of the CommonJS and browser files are gone (CommonJS 4,769 → 4,670 Brotli, browser script 4,802 → 4,633).

## Compile time

The site shows the compiler's wall time over three clean builds (`npm run record:release`, which also records sizes and throughput into `site/results.json`). On 2026-09-24, on a shared Azure Standard_B8als_v2 (8 vCPUs), the shipped ESM compiled in 201.6 / 199.4 / 199.8 ms, and both compiles of a build took 261.6 / 265.7 / 260.0 ms. The previous release's ESM compile took 18.8 s (18,781 / 18,792 / 18,804 ms on a Standard_D16als_v7, the 2026-09-10 source-build record).

The paired source builds (`comparison/source-build/`, `site/source-build.json`) time each repository's own package build on the same host: the LilScript package build takes 0.41 s median, upstream's `npm run build` 3.02 s median. The two builds produce different outputs, so this is context, not a speedup claim.

```sh
LILSCRIPT_COMPILER=… LILSCRIPT_CODEC=… npm run record:release -- --revision aa2052f0 --previous 81580d7
```

The LilScript compiler lives next door at `../lilscript`.
