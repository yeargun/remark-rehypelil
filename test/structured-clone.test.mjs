// remark-rehype's mdast-util-to-hast copies a node's `data.hProperties` with
// @ungap/structured-clone: the runtime's structuredClone where there is one, its own
// serialize/deserialize otherwise. A child process runs upstream remark-rehype and this package in
// the same unified pipeline on the same values, with and without a native structuredClone, and
// compares the copies and the errors.
import assert from "node:assert/strict"
import {execFileSync} from "node:child_process"
import test from "node:test"
import {fileURLToPath, pathToFileURL} from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

const script = (withoutNative) => `
${withoutNative ? "delete globalThis.structuredClone" : ""}
const {isDeepStrictEqual} = await import("node:util")
const {unified} = await import("unified")
const {default: upstream} = await import("remark-rehype")
const {default: port} = await import(${JSON.stringify(pathToFileURL(root + "dist/remark-rehype.esm.js").href)})

function cloneThrough(remarkRehype, hProperties) {
  const tree = {type: "root", children: [{type: "paragraph", data: {hProperties}, children: [{type: "text", value: "a"}]}]}
  try {
    return {properties: unified().use(remarkRehype).runSync(tree).children[0].properties}
  } catch (error) {
    return {error: error.constructor.name + " " + error.name + ": " + error.message}
  }
}

const shared = {x: 1}
const buffer = new Uint8Array([3, 4]).buffer
const cases = {
  plain: () => ({className: ["a", "b"], id: "x", dataCount: 3, hidden: true, nested: {deep: [1, "two", null, undefined, true]}}),
  exotic: () => ({
    date: new Date(0), invalidDate: new Date(Number.NaN), regex: /a+/giu, map: new Map([["k", {v: 1}], [shared, "object key"]]),
    set: new Set([1, "s", shared]), error: new TypeError("boom"), rangeError: new RangeError("r"), bigint: 10n,
    boxedBigint: Object(10n), boxedNumber: Object(1), boxedString: Object("s"), boxedBoolean: Object(false),
    typed: new Uint16Array([1, 2]), float: new Float64Array([0.5]), view: new DataView(new Uint8Array([4, 5]).buffer),
    buffer, bufferAgain: buffer, sparse: [1, , 3], sharedA: shared, sharedB: shared,
  }),
  "negative zero": () => ({alone: -0, afterZero: [0, -0], beforeZero: [-0, 0], nested: {z: -0}}),
  "own __proto__ key": () => JSON.parse('{"__proto__": {"polluted": true}, "x": {"__proto__": [1]}}'),
  cycle: () => {
    const node = {name: "loop"}
    node.self = node
    return {node}
  },
  function: () => ({onClick() {}}),
  symbol: () => ({tag: Symbol("t")}),
  "error named after a guarded global": () => ({error: Object.assign(new Error("m"), {name: "setTimeout"})}),
}

// isDeepStrictEqual finds two invalid dates unequal (NaN time values), so they compare as text.
const comparable = (value) => value instanceof Date && Number.isNaN(value.getTime()) ? "Invalid Date" : value
const shape = (properties) => Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, comparable(value)]))
const report = {}
for (const [name, make] of Object.entries(cases)) {
  const a = cloneThrough(upstream, make())
  const b = cloneThrough(port, make())
  const same = a.error || b.error ? a.error === b.error : isDeepStrictEqual(shape(a.properties), shape(b.properties))
  const facts = (p) => p && [p.sharedA === p.sharedB, p.buffer === p.bufferAgain, p.node?.self === p.node,
    Object.is(p.alone, -0), p.afterZero?.map((z) => Object.is(z, -0)), p.beforeZero?.map((z) => Object.is(z, -0)),
    Object.getPrototypeOf(p.x ?? {}) === Object.prototype, Object.hasOwn(p, "__proto__") || Object.hasOwn(p.x ?? {}, "__proto__")]
  report[name] = {same, upstream: a.error ?? "cloned", port: b.error ?? "cloned", facts: isDeepStrictEqual(facts(a.properties), facts(b.properties))}
}
console.log(JSON.stringify({native: typeof globalThis.structuredClone, ungap: (await import("@ungap/structured-clone/package.json", {with: {type: "json"}})).default.version, report}))
`

for (const withoutNative of [true, false]) {
  test(`hProperties copy as upstream's, ${withoutNative ? "without a native structuredClone (the polyfill)" : "with the native structuredClone"}`, () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script(withoutNative)], {cwd: root, encoding: "utf8"})
    const {native, ungap, report} = JSON.parse(output)
    assert.equal(native, withoutNative ? "undefined" : "function")
    assert.equal(ungap, "1.4.0")
    for (const [name, result] of Object.entries(report)) {
      assert.equal(result.port, result.upstream, name)
      assert.ok(result.same, `${name}: the copy differs from upstream's`)
      assert.ok(result.facts, `${name}: shared references, -0 or own __proto__ keys differ`)
    }
    if (withoutNative) {
      assert.equal(report.function.upstream, "TypeError TypeError: unable to serialize function")
      assert.equal(report["error named after a guarded global"].upstream, "TypeError TypeError: unable to deserialize setTimeout")
    }
  })
}
