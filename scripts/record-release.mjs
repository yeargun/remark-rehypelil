// Records a release build for the site: the compiler's wall time, the sizes of
// every delivered file, the test suites and a throughput sample.
//
//   LILSCRIPT_COMPILER=... LILSCRIPT_CODEC=... \
//     node scripts/record-release.mjs --revision <compiler source revision> --previous <port commit>
//
// It builds `--samples` times (default 3) with a clean compile each time, checks
// that every build wrote the same bytes, and rewrites the measured fields of
// site/results.json. Fields it does not measure (the official bars and the
// playground) are kept as they are. `--previous` names the port commit of the
// last release; its delivered files are measured from Git with the same codec.
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { cpus, loadavg, tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { execFileSync, spawnSync } from "node:child_process"
import { performance } from "node:perf_hooks"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const resultsPath = resolve(root, "site", "results.json")

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const compiler = process.env.LILSCRIPT_COMPILER
const codec = process.env.LILSCRIPT_CODEC
const revision = argument("revision")
const previousCommit = argument("previous")
const samples = Number(argument("samples", "3"))
if (!compiler || !codec) throw new Error("set LILSCRIPT_COMPILER and LILSCRIPT_CODEC to the pinned binaries")
if (!revision) throw new Error("pass --revision: the compiler's source revision")

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

// Every file a consumer can load, with the export condition that selects it.
const delivered = [
  { path: "dist/remark-rehype.esm.js", condition: "import", wrapper: "license banner" },
  { path: "dist/remark-rehype.cjs", condition: "require", wrapper: "license banner, CommonJS export object" },
  {
    path: "dist/remark-rehype.umd.js",
    condition: "browser script (unpkg, jsdelivr)",
    wrapper: "license banner, function scope, global remarkRehype",
  },
  { path: "dist/remark-rehype.closed.js", condition: "./closed", wrapper: "none" },
]

function measure(paths) {
  const measured = JSON.parse(execFileSync(codec, ["--json", ...paths], { encoding: "utf8" }))
  return measured.artifacts.map(({ raw, gzip9, brotli11 }) => ({ raw, gzip9, brotli11 }))
}

// Other work on the host slows the compiler; the load average is recorded with the samples.
const loadAtStart = loadavg()
const scratch = mkdtempSync(join(tmpdir(), "remark-rehypelil-record-"))
const builds = []
let previous = null
try {
  for (let sample = 0; sample < samples; sample++) {
    const log = join(scratch, `compile-${sample}.jsonl`)
    const built = spawnSync(process.execPath, [resolve(root, "scripts", "build.mjs"), "--compile"], {
      cwd: root,
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, LILSCRIPT_COMPILE_LOG: log },
    })
    if (built.status !== 0) throw new Error(`build ${sample + 1} failed`)
    const invocations = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    const hashes = delivered.map(({ path }) => sha256(readFileSync(resolve(root, path))))
    builds.push({ invocations, hashes })
  }
  if (previousCommit) {
    const files = {}
    const paths = delivered.map(({ path }, index) => {
      const copy = join(scratch, `previous-${index}.js`)
      writeFileSync(copy, execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root }))
      return copy
    })
    measure(paths).forEach((size, index) => {
      files[delivered[index].path] = size
    })
    const date = execFileSync("git", ["show", "-s", "--format=%cs", previousCommit], { cwd: root, encoding: "utf8" }).trim()
    const short = execFileSync("git", ["rev-parse", "--short=7", previousCommit], { cwd: root, encoding: "utf8" }).trim()
    previous = { commit: short, date, files }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
const loadAtEnd = loadavg()
for (const build of builds) {
  if (build.hashes.join() !== builds[0].hashes.join()) {
    throw new Error("the builds wrote different bytes; compile output is not deterministic")
  }
}

const shippedCompile = (build) =>
  build.invocations.find((entry) => entry.source === "src/entry.lil" && entry.config === "lilscript.toml")
const round = (value) => Math.round(value * 10) / 10

const sizes = measure(delivered.map(({ path }) => resolve(root, path)))

// The upstream-derived suite and the package's own checks. The site's receipt
// test reads this file, so it runs after it is written, under `npm test`.
function runTests(files) {
  const suite = spawnSync(process.execPath, ["--test", ...files], { cwd: root, encoding: "utf8" })
  const count = (label) => Number(new RegExp(`^(?:ℹ|#) ${label} (\\d+)$`, "m").exec(suite.stdout)?.[1])
  const result = { total: count("tests"), pass: count("pass") }
  if (suite.status !== 0 || result.pass !== result.total) {
    throw new Error(`node --test ${files.join(" ")}: ${result.pass}/${result.total}`)
  }
  return result
}
const official = runTests(["test/official/test.js"])
const checks = runTests(["test/api.test.mjs", "test/closed.test.mjs"])
const spec = {
  total: official.total + checks.total,
  pass: official.pass + checks.pass,
  label: "upstream and package suites",
  official,
  checks,
}

// Throughput: mdast-util-to-hast's readme (CommonMark) as one mdast tree, turned
// into hast by the shipped ESM's transformer and by upstream's graph
// (site/official.js), alternating.
const { fromMarkdown } = await import("mdast-util-from-markdown")
const documentPath = resolve(root, "node_modules", "mdast-util-to-hast", "readme.md")
const documentText = readFileSync(documentPath, "utf8")
const tree = fromMarkdown(documentText)
const lilPlugin = (await import(pathToFileURL(resolve(root, "dist", "remark-rehype.esm.js")).href)).default
const officialPlugin = (await import(pathToFileURL(resolve(root, "site", "official.js")).href)).default
const lil = lilPlugin.call({})
const upstream = officialPlugin.call({})
if (JSON.stringify(lil(tree)) !== JSON.stringify(upstream(tree))) {
  throw new Error("the lanes disagree on the throughput document")
}
// The order alternates every round so neither lane always runs after the other.
const warmup = 10
const rounds = 200
const timings = { lil: [], official: [] }
for (let index = 0; index < warmup + rounds; index++) {
  const lanes = [["lil", lil], ["official", upstream]]
  if (index % 2) lanes.reverse()
  for (const [lane, run] of lanes) {
    const started = performance.now()
    run(tree)
    if (index >= warmup) timings[lane].push(performance.now() - started)
  }
}
const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]

const data = JSON.parse(readFileSync(resultsPath, "utf8"))
const byPath = Object.fromEntries(delivered.map(({ path }, index) => [path, sizes[index]]))
const measuredAt = new Date().toISOString().replace(/\.\d+Z$/, "Z")
const ownLanes = {
  itslil: ["dist/remark-rehype.esm.js", `The npm ESM: LilScript ${revision} output with a license banner.`],
  "itslil-closed": [
    "dist/remark-rehype.closed.js",
    `LilScript ${revision} under lilscript.closed.toml (level 12, no candidate search); diagnostic only.`,
  ],
}
for (const lane of data.size) {
  const own = ownLanes[lane.id]
  if (!own) continue
  const [path, note] = own
  Object.assign(lane, byPath[path], { note, measuredAt, artifactSha256: sha256(readFileSync(resolve(root, path))) })
}
data.delivered = delivered.map(({ path, condition, wrapper }, index) => ({
  path,
  condition,
  writtenBy: "compiler",
  wrapper,
  ...sizes[index],
}))
if (previous) {
  data.previousRelease = {
    ...(data.previousRelease ?? {}),
    ...previous,
  }
}
data.spec = spec
data.node = process.version
data.runtime = `Node ${process.version}`
data.throughput = [
  { id: "official", name: data.pin, documentMs: Math.round(median(timings.official) * 1000) / 1000 },
  { id: "itslil", name: data.package, documentMs: Math.round(median(timings.lil) * 1000) / 1000 },
]
data.throughputDocument = `mdast-util-to-hast's readme.md (${documentText.length} characters, CommonMark) as one mdast tree, ${rounds} alternating runs`
data.warmupDiscard = warmup
data.sizeMeasuredAt = measuredAt
data.compiler = {
  revision,
  binarySha256: sha256(readFileSync(compiler)),
  codecSha256: sha256(readFileSync(codec)),
  compileWallMs: builds.map((build) => round(shippedCompile(build).wallMs)),
  buildCompileWallMs: builds.map((build) => round(build.invocations.reduce((sum, entry) => sum + entry.wallMs, 0))),
  invocations: builds[0].invocations.map(({ source, config, output }) => ({ source, config, output })),
  compileScope: "wall time of the compiler process for src/entry.lil with lilscript.toml, the shipped ESM",
  buildScope: `wall time of all ${builds[0].invocations.length} compiler processes of one clean build`,
  host: `${process.env.RELEASE_HOST ?? "this host"}, ${cpus().length} vCPUs, Node ${process.version}`,
  loadAverage: {
    start: loadAtStart.map((value) => Math.round(value * 100) / 100),
    end: loadAtEnd.map((value) => Math.round(value * 100) / 100),
  },
  date: new Date().toISOString().slice(0, 10),
}
writeFileSync(resultsPath, `${JSON.stringify(data, null, 2)}\n`)
console.log(
  `recorded: esm ${byPath["dist/remark-rehype.esm.js"].brotli11} Brotli, compile ${data.compiler.compileWallMs.join("/")} ms, build ${data.compiler.buildCompileWallMs.join("/")} ms, official ${official.pass}/${official.total}, checks ${checks.pass}/${checks.total}, throughput ${data.throughput[1].documentMs} vs ${data.throughput[0].documentMs} ms`,
)
