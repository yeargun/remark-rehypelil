# @itslil/remark-rehype

Official [`remark-rehype@11.1.2`](https://github.com/remarkjs/remark-rehype) algorithms rewritten in LilScript. Official test suite 16/16. Not affiliated with upstream.

**Site:** [yeargun.github.io/remark-rehypelil/](https://yeargun.github.io/remark-rehypelil/)

```sh
npm install @itslil/remark-rehype
```

Two compiles ship from the same `.lil` source:

| Lane | Config | Meaning |
| --- | --- | --- |
| **library** (npm) | `lilscript.toml` · `--target js-module` | reusable ESM. Export names and `extern class` keys stay. |
| **closed** | `lilscript.closed.toml` · `--target js-module` | closed LilScript world. `extern class` keys may mangle. ESM export names stay so the lane is testable. |

You publish the library lane. The closed artifact is `dist/remark-rehype.closed.js`.

The LilScript compiler lives next door at `../lilscript`.
