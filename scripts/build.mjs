import {
  accessSync,
  appendFileSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const lilscriptRoot = process.env.LILSCRIPT_ROOT ?? resolve(root, "..", "lilscript")
const dist = resolve(root, "dist")
const file = "remark-rehype"
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
const banner = `/*! @itslil/remark-rehype ${version} | LilScript reimplementation of remark-rehype | MIT */\n`
const publicApi = ["default", "defaultHandlers", "defaultFootnoteBackContent", "defaultFootnoteBackLabel"]

function compilerPath() {
  // A pinned compiler is used or the build fails; it never falls back to another binary.
  if (process.env.LILSCRIPT_COMPILER) {
    accessSync(process.env.LILSCRIPT_COMPILER, constants.X_OK)
    return process.env.LILSCRIPT_COMPILER
  }
  const candidates = [
    resolve(lilscriptRoot, "target", "release", "lilscript"),
    resolve(lilscriptRoot, "target", "debug", "lilscript"),
  ]
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {}
  }
  return null
}

function run(cmd, args) {
  const started = process.hrtime.bigint()
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return Number(process.hrtime.bigint() - started) / 1e6
}

// LILSCRIPT_COMPILE_LOG names a file that receives one JSON line per compiler
// invocation with its wall time; scripts/record-release.mjs reads it for the site.
function compileLil(compiler, configName, outputName) {
  const sourceName = "src/entry.lil"
  const wallMs = run(compiler, [
    resolve(root, sourceName),
    "--target",
    "js-module",
    "--config",
    resolve(root, configName),
    "-o",
    resolve(dist, outputName),
  ])
  if (process.env.LILSCRIPT_COMPILE_LOG) {
    appendFileSync(
      process.env.LILSCRIPT_COMPILE_LOG,
      `${JSON.stringify({ source: sourceName, config: configName, output: outputName, wallMs })}\n`,
    )
  }
}

function compileIfRequested() {
  const generated = [`${file}.raw.js`, `${file}.closed.js`]
  if (!process.argv.includes("--compile") && generated.every((name) => existsSync(resolve(dist, name)))) {
    return
  }
  const compiler = compilerPath()
  if (!compiler) {
    throw new Error("LilScript compiler not found. Set LILSCRIPT_COMPILER or build lilscript.")
  }
  mkdirSync(dist, { recursive: true })
  compileLil(compiler, "lilscript.toml", `${file}.raw.js`)
  compileLil(compiler, "lilscript.closed.toml", `${file}.closed.js`)
}

// The compiler writes an ES module whose last statement is its export clause.
// Every delivered file is that text: the ESM as written, and the CommonJS and
// browser builds with the clause replaced by a module wrapper. No minifier runs
// over the compiler's output.
function splitExports(text, expected, label) {
  const match = /;?export\s*\{([^}]*)\}\s*;?\s*$/.exec(text)
  if (!match) throw new Error(`${label}: the compiler's artifact has no trailing export clause`)
  const bindings = match[1].split(",").map((entry) => {
    const [local, exported = local] = entry.trim().split(/\s+as\s+/)
    return { local, exported }
  })
  const names = bindings.map(({ exported }) => exported).sort()
  if (names.join(",") !== [...expected].sort().join(",")) {
    throw new Error(`${label}: exports ${names.join(",")}, expected ${[...expected].sort().join(",")}`)
  }
  if (/\bimport\s*[{*\s"']|\bimport\.meta\b|\bexport\s/.test(text.slice(0, match.index))) {
    throw new Error(`${label}: module syntax outside the trailing export clause`)
  }
  return { body: `${text.slice(0, match.index)};`, bindings }
}

function objectOf(bindings) {
  return `{${bindings
    .map(({ local, exported }) => (local === exported ? local : `${exported}:${local}`))
    .join(",")}}`
}

function readCompiled(name) {
  const path = resolve(dist, name)
  if (!existsSync(path)) {
    throw new Error(`dist/${name} is missing. Run with --compile after building LilScript.`)
  }
  return readFileSync(path, "utf8").trimEnd()
}

compileIfRequested()
mkdirSync(dist, { recursive: true })

const raw = readCompiled(`${file}.raw.js`)
const main = splitExports(raw, publicApi, `${file}.raw.js`)
splitExports(readCompiled(`${file}.closed.js`), publicApi, `${file}.closed.js`)
writeFileSync(resolve(dist, `${file}.esm.js`), `${banner}${raw}\n`)
// CommonJS keeps the shape the earlier esbuild CJS build had: the named exports
// plus `default`, with a non-enumerable `__esModule` marker for interop.
writeFileSync(
  resolve(dist, `${file}.cjs`),
  `${banner}"use strict";${main.body}module.exports=Object.defineProperty(${objectOf(main.bindings)},"__esModule",{value:!0});\n`,
)
// The browser build is a classic script: one function scope around the
// compiler's program, and the plugin on the global object as `remarkRehype`,
// as the previous UMD build set it.
const pluginLocal = main.bindings.find(({ exported }) => exported === "default").local
writeFileSync(
  resolve(dist, `${file}.umd.js`),
  `${banner}(function(){"use strict";${main.body}globalThis.remarkRehype=${pluginLocal}})();\n`,
)

copyFileSync(resolve(root, "types", `${file}.d.ts`), resolve(dist, `${file}.d.ts`))
console.log(`wrote dist/${file}.esm.js, dist/${file}.cjs, dist/${file}.umd.js, dist/${file}.closed.js`)
