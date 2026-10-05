import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import baseline from "./fixtures/release008-semantic-identities.json"

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

type RenderNode = { id: string; children?: Array<{ nodeId: string }> }
type Alternative = { when?: { propName?: string; equals?: string }; rendering: { nodes: RenderNode[] } }
type Family = {
  source?: unknown
  evidence: { source?: unknown; tokens?: unknown }
  exports: Array<{ name: string; component?: { tokenDependencies?: unknown; rendering: { alternatives?: Alternative[] } } }>
}

function loadFamily(id: string): Family {
  return JSON.parse(readFileSync(new URL(`../contracts/components/families/${id}.json`, import.meta.url), "utf8")) as Family
}

function semanticIdentity(family: Family): string {
  // Styling dependencies and source hashes change; all semantic facts stay exact.
  delete family.source
  delete family.evidence.source
  delete family.evidence.tokens
  for (const entry of family.exports) if (entry.component) delete entry.component.tokenDependencies
  return hash(JSON.stringify(family))
}

const collapsibleNone = (family: Family) => family.exports.find((entry) => entry.name === "Sidebar")!.component!.rendering.alternatives!
  .find((alternative) => alternative.when?.propName === "collapsible" && alternative.when.equals === "none")!.rendering

describe("Release 014 component delta", () => {
  // DS6: a collapsible="none" sidebar wraps its children in the same inner panel as the collapsible
  // paths. That node is the only semantic change; Accordion (DS1) and Card (DS10) change styling only.
  test("Sidebar's collapsible=\"none\" branch gains only the inner panel", () => {
    const sidebar = loadFamily("sidebar")
    const plain = collapsibleNone(sidebar)
    const inner = plain.nodes.find((node) => node.id === "plain-inner")!
    expect(inner).toMatchObject({ host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: false })
    expect(plain.nodes.find((node) => node.id === "plain")!.children).toEqual([{ nodeId: "plain-inner", evidenceRefs: ["source"] }])
    // Without the inner panel the family is exactly Release 008's.
    plain.nodes.splice(plain.nodes.indexOf(inner), 1)
    plain.nodes.find((node) => node.id === "plain")!.children = []
    expect(semanticIdentity(sidebar)).toBe(baseline.families.sidebar)
  })

  test.each(["accordion", "card"])("%s keeps its exact Release 008 semantic identity", (id) => {
    expect(semanticIdentity(loadFamily(id))).toBe(baseline.families[id as keyof typeof baseline.families])
  })
})
