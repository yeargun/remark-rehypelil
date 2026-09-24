import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"))

describe("site", () => {
  it("has a markedlil-style lab with receipts", async () => {
    assert.equal(existsSync(resolve(root, "site/index.html")), true)
    assert.equal(existsSync(resolve(root, "site/app.js")), true)
    assert.equal(existsSync(resolve(root, "site/results.json")), true)
    const html = readFileSync(resolve(root, "site/index.html"), "utf8")
    assert.match(html, /scoreboard/)
    assert.match(html, /#evidence/)
    assert.match(html, /#lab/)
    assert.match(html, /id="compiler"/)
    const results = readJson("site/results.json")
    const library = await import(`../dist/${results.file}.esm.js`)
    assert.equal(typeof library[results.lilExport], "function")
  })

  it("records the compiler run it shows", () => {
    const data = readJson("site/results.json")
    assert.match(data.compiler.revision, /^[0-9a-f]{7,40}$/)
    assert.match(data.compiler.binarySha256, /^[0-9a-f]{64}$/)
    assert.equal(data.compiler.compileWallMs.length >= 3, true)
    for (const sample of [...data.compiler.compileWallMs, ...data.compiler.buildCompileWallMs]) {
      assert.equal(Number.isFinite(sample) && sample > 0, true)
    }
  })

  it("shows the sizes of the files that ship", () => {
    const data = readJson("site/results.json")
    const manifest = readJson("package.json")
    const shipped = manifest.files.filter((path) => /^dist\/.*\.(c?js)$/.test(path)).sort()
    assert.deepEqual(data.delivered.map((file) => file.path).sort(), shipped)
    for (const file of data.delivered) {
      assert.equal(file.writtenBy, "compiler", file.path)
      // The recorded sizes are of the committed files, not of an earlier build.
      assert.equal(statSync(resolve(root, file.path)).size, file.raw, file.path)
    }
    const lanes = [
      ["itslil", "dist/remark-rehype.esm.js"],
      ["itslil-closed", "dist/remark-rehype.closed.js"],
    ]
    for (const [id, path] of lanes) {
      const file = data.delivered.find((entry) => entry.path === path)
      const lane = data.size.find((row) => row.id === id)
      assert.deepEqual([lane.raw, lane.gzip9, lane.brotli11], [file.raw, file.gzip9, file.brotli11], id)
    }
  })

  it("compares against the strongest recorded bar", () => {
    const data = readJson("site/results.json")
    const official = data.size.filter((row) => row.id.startsWith("official") && row.id !== "official")
    const baseline = data.size.find((row) => row.baseline)
    for (const metric of ["brotli11", "gzip9", "raw"]) {
      assert.equal(baseline[metric], Math.min(...official.map((row) => row[metric])), metric)
    }
  })
})
