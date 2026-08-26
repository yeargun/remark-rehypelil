import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import remarkRehype, { remarkRehype as named } from "../dist/remark-rehype.esm.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const paragraph = {
  type: "root",
  children: [
    {
      type: "paragraph",
      children: [{ type: "text", value: "hi" }],
    },
  ],
}

describe("remark-rehype", () => {
  it("exports the plugin as default and named", () => {
    assert.equal(typeof remarkRehype, "function")
    assert.equal(named, remarkRehype)
  })

  it("transforms a paragraph fixture into a p element", () => {
    const transform = named.call({})
    const hast = transform(paragraph)
    assert.equal(hast.type, "root")
    assert.equal(hast.children[0].type, "element")
    assert.equal(hast.children[0].tagName, "p")
    assert.equal(hast.children[0].children[0].value, "hi")
  })

  it("maps math and task lists", () => {
    const transform = named.call({})
    const hast = transform({
      type: "root",
      children: [
        { type: "inlineMath", value: "x" },
        {
          type: "list",
          ordered: false,
          spread: false,
          children: [
            {
              type: "listItem",
              spread: false,
              checked: true,
              children: [{ type: "paragraph", children: [{ type: "text", value: "done" }] }],
            },
          ],
        },
      ],
    })
    const tags = JSON.stringify(hast)
    assert.match(tags, /math/)
    assert.match(tags, /checkbox/)
    assert.match(tags, /contains-task-list/)
  })

  it("keeps pinned keys in the library artifact", () => {
    const src = readFileSync(resolve(root, "dist/remark-rehype.esm.js"), "utf8")
    assert.match(src, /allowDangerousHtml/)
    assert.match(src, /tagName/)
    assert.match(src, /className/)
    assert.match(src, /type/)
  })
})
