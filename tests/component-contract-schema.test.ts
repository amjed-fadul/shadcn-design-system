import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import contractSetSchema from "../contracts/components/component-contract-set.schema.json"
import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import button from "../contracts/components/families/button.json"
import htmlButton from "../contracts/components/interfaces/html.button.json"

function evidence() {
  return { source: { kind: "canonical-source", source: "src/example.tsx" } }
}

function validFamily(): any {
  return {
    schemaVersion: 1,
    id: "example",
    source: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "example" },
    evidence: evidence(),
    exports: [{ name: "Example", kind: "component", authorableJsx: true, component: { localProps: [], inherits: [], slots: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [], rendering: { defaultHost: { kind: "intrinsic", name: "div", evidenceRefs: ["source"] }, dataAttributes: [], portals: { value: false, evidenceRefs: ["source"] }, automaticStructure: [] }, accessibility: [] }, evidenceRefs: ["source"] }],
    unresolved: [],
  }
}

function validInterface() {
  return {
    schemaVersion: 1,
    id: "html.example",
    source: { kind: "react-intrinsic", package: "@types/react", version: "18.3.3", declarationPath: "node_modules/@types/react/index.d.ts", declarationSha256: "a".repeat(64), symbol: "React.JSX.IntrinsicElements[\"example\"]" },
    evidence: { declaration: { kind: "inherited-interface", source: "node_modules/@types/react/index.d.ts" } },
    props: [{ name: "title", required: false, type: { kind: "typescript", typeText: "string | undefined" }, typeText: "string | undefined", evidenceRefs: ["declaration"] }],
    unresolved: [],
  }
}

function validate(schema: object, document: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(document)
}

describe("component contract JSON Schemas", () => {
  test("accept generic component family and inherited interface artifacts", () => {
    expect(validate(familySchema, validFamily())).toBe(true)
    const twoChildFamily = validFamily()
    twoChildFamily.exports[0].component.slots.push({ propName: "items", default: false, replacesHost: false, childCardinality: { min: 2, max: 2 }, forwardsProps: false, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] })
    expect(validate(familySchema, twoChildFamily)).toBe(true)
    expect(validate(interfaceSchema, validInterface())).toBe(true)
    expect(validate(familySchema, button)).toBe(true)
    expect(validate(interfaceSchema, htmlButton)).toBe(true)
    expect(validate(contractSetSchema, { schemaVersion: 1, id: "contracts", status: "candidate", designSystemId: "example", sourceBaselineCommit: "a".repeat(40), tokenContractId: "tokens", familyCount: 2, familyFiles: ["contracts/components/families/example.json"], interfaceFiles: ["contracts/components/interfaces/html.example.json"] })).toBe(true)
  })

  test.each([
    ["unknown structured property", (value: any) => ({ ...value, unknown: true })],
    ["invalid export kind", (value: any) => ({ ...value, exports: [{ ...value.exports[0], kind: "widget" }] })],
    ["malformed evidence kind", (value: any) => ({ ...value, evidence: { source: { kind: "memory", source: "x" } } })],
    ["invalid structured prop type", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, localProps: [{ name: "tone", required: false, type: { kind: "unknown" }, evidenceRefs: ["source"] }] } }] })],
    ["malformed slot cardinality", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, slots: [{ propName: "asChild", default: false, replacesHost: true, childCardinality: { min: -1, max: 0 }, forwardsProps: true, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] }] } }] })],
    ["malformed rendering default host", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, rendering: { ...value.exports[0].component.rendering, defaultHost: { kind: "intrinsic" } } } }] })],
    ["malformed accessibility owner", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, accessibility: [{ feature: "name", owner: "browser", mechanism: "author", evidenceRefs: ["source"] }] } }] })],
  ])("rejects a family with %s", (_description, mutate) => {
    expect(validate(familySchema, mutate(validFamily()))).toBe(false)
  })
})
