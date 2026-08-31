import { describe, expect, test } from "vitest"

import { assertComponentFamilyInvariants, validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import type { ComponentFamilyContract } from "../src/contracts/components/types"

function validFamily(): ComponentFamilyContract {
  return {
    schemaVersion: 1, id: "example", source: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "example" },
    evidence: { source: { kind: "canonical-source", source: "src/example.tsx" } },
    exports: [{ name: "Example", kind: "component", authorableJsx: true, component: { localProps: [{ name: "tone", required: false, type: { kind: "enum", values: ["quiet"] }, evidenceRefs: ["source"] }], inherits: ["html.example"], slots: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [{ tokenId: "color.primary", evidenceRefs: ["source"] }], rendering: { defaultHost: { kind: "intrinsic", name: "div", evidenceRefs: ["source"] }, dataAttributes: [], portals: { value: false, evidenceRefs: ["source"] }, automaticStructure: [] }, accessibility: [] }, evidenceRefs: ["source"] }], unresolved: [],
  }
}

function changed(change: (family: ComponentFamilyContract) => void) {
  const family = structuredClone(validFamily())
  change(family)
  return family
}

const authority = { interfaceIds: new Set(["html.example"]), interfacePropNames: new Map([["html.example", new Set(["onClick", "inheritedState"])]]), tokenIds: new Set(["color.primary"]), derivedTokenRuleIds: new Set(["spacing.multiplier"]), sourceIdentity: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40) } }

describe("component contract semantic invariants", () => {
  test("accepts a valid generic family", () => {
    expect(validateComponentFamilyInvariants(validFamily(), authority)).toEqual([])
    expect(() => assertComponentFamilyInvariants(validFamily(), authority)).not.toThrow()
  })

  test.each([
    ["duplicate exports", (f: ComponentFamilyContract) => f.exports.push({ ...f.exports[0] }), "Duplicate export name: Example."],
    ["bad JSX classification", (f: ComponentFamilyContract) => { f.exports[0].authorableJsx = false }, "Component export Example must be JSX-authorable."],
    ["missing evidence reference", (f: ComponentFamilyContract) => { f.exports[0].evidenceRefs = ["missing"] }, "Export Example references missing evidence: missing."],
    ["missing inherited interface", (f: ComponentFamilyContract) => { f.exports[0].component!.inherits = ["html.missing"] }, "Component Example inherits unknown interface: html.missing."],
    ["duplicate local props", (f: ComponentFamilyContract) => f.exports[0].component!.localProps.push({ ...f.exports[0].component!.localProps[0] }), "Component Example has duplicate local prop: tone."],
    ["local and inherited prop collision", (f: ComponentFamilyContract) => f.exports[0].component!.localProps.push({ ...f.exports[0].component!.localProps[0], name: "onClick" }), "Component Example local prop collides with inherited prop: onClick."],
    ["unknown token dependency", (f: ComponentFamilyContract) => { f.exports[0].component!.tokenDependencies[0].tokenId = "color.missing" }, "Component Example references unknown token: color.missing."],
    ["unknown derived token rule", (f: ComponentFamilyContract) => { f.exports[0].component!.tokenDependencies[0].viaDerivedRule = { id: "spacing.unknown", multiplier: 2 } }, "Component Example references unknown derived token rule: spacing.unknown."],
    ["bad state-channel prop reference", (f: ComponentFamilyContract) => f.exports[0].component!.stateChannels.push({ name: "open", propName: "missing", evidenceRefs: ["source"] }), "Component Example state channel open references unknown prop: missing."],
    ["bad event prop reference", (f: ComponentFamilyContract) => f.exports[0].component!.events.push({ propName: "onMissing", evidenceRefs: ["source"] }), "Component Example event references unknown prop: onMissing."],
    ["bad automatic export reference", (f: ComponentFamilyContract) => f.exports[0].component!.rendering.automaticStructure.push({ exportName: "Missing", evidenceRefs: ["source"] }), "Component Example automatic structure references unknown export: Missing."],
    ["slot maximum below minimum", (f: ComponentFamilyContract) => f.exports[0].component!.slots.push({ propName: "items", default: false, replacesHost: false, childCardinality: { min: 2, max: 1 }, forwardsProps: false, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] }), "Slot Example.items has max 1 below min 2."],
    ["source identity mismatch", (f: ComponentFamilyContract) => { f.source.canonicalBlobSha = "b".repeat(40) }, "Family source canonicalBlobSha does not match approved source identity."],
    ["missing conditional API evidence", (f: ComponentFamilyContract) => f.exports[0].component!.conditionalApi.push({ propName: "tone", equals: "quiet", effects: [], evidenceRefs: ["missing"] }), "Conditional API Example.tone references missing evidence: missing."],
    ["missing unresolved evidence", (f: ComponentFamilyContract) => f.unresolved.push({ topic: "unknown", scope: "example", reason: "unknown", evidenceAttempted: [], evidenceRefs: ["missing"] }), "Unresolved fact unknown references missing evidence: missing."],
  ])("rejects %s", (_description, mutate, expected) => {
    expect(validateComponentFamilyInvariants(changed(mutate), authority)).toContain(expected)
  })

  test("permits inherited state and event prop references and resolves automatic exports independent of declaration order", () => {
    const family = validFamily()
    family.exports[0].component!.stateChannels.push({ name: "state", propName: "inheritedState", evidenceRefs: ["source"] })
    family.exports[0].component!.events.push({ propName: "onClick", evidenceRefs: ["source"] })
    family.exports[0].component!.rendering.automaticStructure.push({ exportName: "Later", evidenceRefs: ["source"] })
    family.exports.push({ name: "Later", kind: "helper", authorableJsx: false, evidenceRefs: ["source"] })
    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])
  })
})
