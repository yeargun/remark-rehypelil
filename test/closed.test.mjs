import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import remarkRehype, { remarkRehype as named } from "../dist/remark-rehype.closed.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

describe("remark-rehype closed", () => {
  it("ships a closed artifact with named exports", () => {
    assert.equal(existsSync(resolve(root, "dist/remark-rehype.closed.js")), true)
    assert.equal(typeof named, "function")
    assert.equal(typeof remarkRehype, "function")
    assert.equal(named, remarkRehype)
  })
})
