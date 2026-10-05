import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import baseline from "./fixtures/release008-semantic-identities.json"

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

type Prop = { name: string; type: { kind: string; values?: string[] } }
type DataAttribute = { name: string }
type RenderNode = { dataAttributes?: DataAttribute[]; children?: unknown[] }
type Family = {
  source?: unknown
  evidence: { source?: unknown; tokens?: unknown }
  exports: Array<{ name: string; component?: { localProps: Prop[]; tokenDependencies?: unknown; rendering: { nodes?: RenderNode[] } } }>
}

// Release 011 adds exactly these API facts; everything else must stay byte-identical to Release 008.
const additions = {
  badge: { export: "Badge", enumValues: { variant: ["primary", "success", "warning", "info"] } },
  alert: { export: "Alert", enumValues: { variant: ["success", "warning", "info"] } },
  icon: {
    export: "Icon",
    enumValues: {
      name: [
        "home", "users", "receipt", "credit-card", "chart-column", "settings", "download", "calendar",
        "trending-up", "trending-down", "arrow-up", "arrow-down", "clock", "star", "shield", "lock",
        "building", "quote", "bell",
      ],
      color: ["success", "warning", "info"],
    },
  },
  avatar: { export: "Avatar", newProps: ["shape"], newDataAttributes: ["data-shape"] },
} as const

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

describe("Release 011 component API delta", () => {
  test.each(Object.entries(additions))("%s adds only its listed options to the Release 008 facts", (id, delta) => {
    const family = loadFamily(id)
    const component = family.exports.find((entry) => entry.name === delta.export)!.component!

    if ("enumValues" in delta) {
      for (const [propName, added] of Object.entries(delta.enumValues)) {
        const prop = component.localProps.find((candidate) => candidate.name === propName)!
        expect(prop.type.kind).toBe("enum")
        for (const value of added) expect(prop.type.values).toContain(value)
        prop.type.values = prop.type.values!.filter((value) => !(added as readonly string[]).includes(value))
      }
    }
    if ("newProps" in delta) {
      for (const propName of delta.newProps) {
        const prop = component.localProps.find((candidate) => candidate.name === propName)
        expect(prop?.type).toEqual({ kind: "enum", values: ["circle", "rounded", "square"] })
      }
      component.localProps = component.localProps.filter((prop) => !(delta.newProps as readonly string[]).includes(prop.name))
      for (const node of component.rendering.nodes ?? []) {
        node.dataAttributes = node.dataAttributes?.filter((attribute) => !(delta.newDataAttributes as readonly string[]).includes(attribute.name))
      }
    }

    expect(semanticIdentity(family), id).toBe(baseline.families[id as keyof typeof baseline.families])
  })

  test("the Avatar shape defaults to circle", () => {
    const avatar = loadFamily("avatar").exports.find((entry) => entry.name === "Avatar")!.component!
    expect(avatar.localProps.find((prop) => prop.name === "shape")).toMatchObject({ required: false, default: "circle" })
  })

  test("every other family keeps its exact Release 008 semantic identity", () => {
    for (const [id, expected] of Object.entries(baseline.families)) {
      // Release 014 changes Sidebar; tests/release-014-delta.test.ts proves its only change.
      if (id in additions || id === "sidebar") continue
      expect(semanticIdentity(loadFamily(id)), id).toBe(expected)
    }
  })

  test("Image, Link and Toggle Group implementation bytes stay intact", () => {
    for (const [id, expected] of Object.entries(baseline.primitives)) {
      if (id === "icon") continue
      expect(hash(readFileSync(new URL(`../src/components/ui/${id}.tsx`, import.meta.url))), id).toBe(expected)
    }
  })
})
