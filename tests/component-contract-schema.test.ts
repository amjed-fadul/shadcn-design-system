import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import contractSetSchema from "../contracts/components/component-contract-set.schema.json"
import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import button from "../contracts/components/families/button.json"
import htmlButton from "../contracts/components/interfaces/html.button.json"
import accordionRoot from "../contracts/components/interfaces/radix.accordion.root.json"

function evidence() {
  return { source: { kind: "canonical-source", source: "src/example.tsx" } }
}

function validFamily(): any {
  return {
    schemaVersion: 1,
    id: "example",
    source: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "example" },
    evidence: evidence(),
    exports: [{ name: "Example", kind: "component", authorableJsx: true, component: { localProps: [], inherits: [], slots: [], inheritedPropDefaults: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [], rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] }, accessibility: [] }, evidenceRefs: ["source"] }],
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
    expect(validate(interfaceSchema, accordionRoot)).toBe(true)
    const derivedAttribute = validFamily()
    derivedAttribute.exports[0].component.rendering.nodes[0].dataAttributes.push({ name: "data-match", source: "derived-condition", condition: { propName: "mode", equals: "a" }, evidenceRefs: ["source"] })
    expect(validate(familySchema, derivedAttribute)).toBe(true)
    const malformedDerivedAttribute = structuredClone(derivedAttribute)
    malformedDerivedAttribute.exports[0].component.rendering.nodes[0].dataAttributes[0].source = "literal"
    expect(validate(familySchema, malformedDerivedAttribute)).toBe(false)
    for (const status of ["candidate", "approved"]) {
      expect(validate(contractSetSchema, { schemaVersion: 1, id: "contracts", status, designSystemId: "example", sourceBaselineCommit: "a".repeat(40), tokenContractId: "tokens", familyCount: 2, familyFiles: ["contracts/components/families/example.json"], interfaceFiles: ["contracts/components/interfaces/html.example.json"] })).toBe(true)
    }
  })

  test("accepts an evidence-backed node-targeted portal boundary", () => {
    const family = validFamily()
    family.exports[0].component.rendering = {
      rootNodeId: "root", publicPropsTargetNodeId: "content",
      nodes: [
        { id: "root", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "portal", evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
        { id: "portal", host: { kind: "fragment" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "content", evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
        { id: "content", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] },
      ],
      portalBoundaries: [{ nodeId: "portal", evidenceRefs: ["source"] }],
    }
    expect(validate(familySchema, family)).toBe(true)
  })

  test("accepts an evidence-backed conditional child reference and component host", () => {
    const family = validFamily()
    family.exports[0].component.rendering = {
      rootNodeId: "root", publicPropsTargetNodeId: "content",
      nodes: [
        { id: "root", host: { kind: "component-export", exportName: "Example" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "content", when: { propName: "tone", equals: "quiet" }, evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
        { id: "content", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] },
      ],
      portalBoundaries: [],
    }
    expect(validate(familySchema, family)).toBe(true)
  })

  test("accepts an exact conjunction for a stacked conditional token utility", () => {
    const family = validFamily()
    family.exports[0].component.tokenDependencies.push({
      tokenId: "spacing.unit",
      when: { all: [{ propName: "orientation", equals: "vertical" }, { propName: "spacing", equals: 0 }] },
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 },
      evidenceRefs: ["source"],
    })
    expect(validate(familySchema, family)).toBe(true)

    const malformed = structuredClone(family)
    malformed.exports[0].component.tokenDependencies[0].when.all = [{ propName: "spacing", equals: 0 }]
    expect(validate(familySchema, malformed)).toBe(false)
  })

  test("accepts an evidence-backed cross-family component host", () => {
    const family = validFamily()
    family.exports[0].component.rendering.nodes[0].host = {
      kind: "cross-family-export",
      familyId: "button",
      exportName: "Button",
    }
    expect(validate(familySchema, family)).toBe(true)
  })

  test("accepts factual render alternatives, conditional values, and derived spreads", () => {
    const family = validFamily()
    const branch = (id: string) => ({ rootNodeId: id, publicPropsTargetNodeId: id, nodes: [{ id, host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] })
    family.exports[0].component.rendering = {
      alternatives: [
        { when: { propName: "mode", equals: "plain" }, rendering: branch("plain"), evidenceRefs: ["source"] },
        { when: { source: "state", name: "isMobile", truthiness: "truthy" }, rendering: branch("mobile"), evidenceRefs: ["source"] },
        { otherwise: true, rendering: branch("desktop"), evidenceRefs: ["source"] },
      ],
    }
    family.exports[0].component.rendering.alternatives[2].rendering.nodes[0].dataAttributes.push({ name: "data-value", source: "conditional-value", condition: { source: "state", name: "state", equals: "open" }, whenTrue: { source: "prop", name: "mode" }, whenFalse: { source: "literal", value: "" }, evidenceRefs: ["source"] })
    family.exports[0].component.rendering.alternatives[2].rendering.nodes[0].derivedSpreads.push({ source: "prop", name: "mode", evidenceRefs: ["source"] })
    expect(validate(familySchema, family)).toBe(true)

    const malformed = structuredClone(family)
    malformed.exports[0].component.rendering.alternatives[2] = { otherwise: false, rendering: branch("bad"), evidenceRefs: ["source"] }
    expect(validate(familySchema, malformed)).toBe(false)
  })

  test("accepts exact nullish and compound render conditions", () => {
    const family = validFamily()
    const branch = (id: string) => ({ rootNodeId: id, publicPropsTargetNodeId: id, nodes: [{ id, host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] })
    family.exports[0].component.rendering = {
      alternatives: [
        { when: { propName: "children", nullishness: "non-nullish" }, rendering: branch("present"), evidenceRefs: ["source"] },
        { when: { all: [{ propName: "enabled", equals: true }, { propName: "children", nullishness: "nullish" }] }, rendering: branch("fallback"), evidenceRefs: ["source"] },
      ],
    }

    expect(validate(familySchema, family)).toBe(true)
  })

  test.each([
    ["unknown structured property", (value: any) => ({ ...value, unknown: true })],
    ["invalid export kind", (value: any) => ({ ...value, exports: [{ ...value.exports[0], kind: "widget" }] })],
    ["malformed evidence kind", (value: any) => ({ ...value, evidence: { source: { kind: "memory", source: "x" } } })],
    ["invalid structured prop type", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, localProps: [{ name: "tone", required: false, type: { kind: "unknown" }, evidenceRefs: ["source"] }] } }] })],
    ["malformed slot cardinality", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, slots: [{ propName: "asChild", default: false, replacesHost: true, childCardinality: { min: -1, max: 0 }, forwardsProps: true, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] }] } }] })],
    ["malformed rendering host", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, rendering: { ...value.exports[0].component.rendering, nodes: [{ ...value.exports[0].component.rendering.nodes[0], host: { kind: "intrinsic" } }] } } }] })],
    ["malformed portal boundary", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, rendering: { ...value.exports[0].component.rendering, portalBoundaries: [{ nodeId: "host" }] } } }] })],
    ["malformed render child reference", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, rendering: { ...value.exports[0].component.rendering, nodes: [{ ...value.exports[0].component.rendering.nodes[0], children: [{ nodeId: "host" }] }] } } }] })],
    ["malformed accessibility owner", (value: any) => ({ ...value, exports: [{ ...value.exports[0], component: { ...value.exports[0].component, accessibility: [{ feature: "name", owner: "browser", mechanism: "author", evidenceRefs: ["source"] }] } }] })],
  ])("rejects a family with %s", (_description, mutate) => {
    expect(validate(familySchema, mutate(validFamily()))).toBe(false)
  })
})
