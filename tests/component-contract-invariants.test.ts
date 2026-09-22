import { describe, expect, test } from "vitest"

import { assertComponentFamilyInvariants, validateComponentContractSetInvariants, validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import "./helpers/component-contract-model-extension"

function validFamily(): ComponentFamilyContract {
  return {
    schemaVersion: 1, id: "example", source: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "example" },
    evidence: { source: { kind: "canonical-source", source: "src/example.tsx" } },
    exports: [{ name: "Example", kind: "component", authorableJsx: true, component: { localProps: [{ name: "tone", required: false, type: { kind: "enum", values: ["quiet"] }, evidenceRefs: ["source"] }], inherits: ["html.example"], slots: [], inheritedPropDefaults: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [{ tokenId: "color.primary", evidenceRefs: ["source"] }], rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] }, accessibility: [] }, evidenceRefs: ["source"] }], unresolved: [],
  }
}

function changed(change: (family: ComponentFamilyContract) => void) {
  const family = structuredClone(validFamily())
  change(family)
  return family
}

function withPortalBoundary(): ComponentFamilyContract {
  const family = validFamily() as any
  family.exports[0].component.rendering = {
    rootNodeId: "root", publicPropsTargetNodeId: "content",
    nodes: [
      { id: "root", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "portal", evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
      { id: "portal", host: { kind: "fragment" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "content", evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
      { id: "content", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] },
    ],
    portalBoundaries: [{ nodeId: "portal", evidenceRefs: ["source"] }],
  }
  return family
}

function withConditionalChild(): ComponentFamilyContract {
  const family = validFamily() as any
  family.exports[0].component.rendering = {
    rootNodeId: "root", publicPropsTargetNodeId: "child",
    nodes: [
      { id: "root", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "child", when: { propName: "tone", equals: "quiet" }, evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
      { id: "child", host: { kind: "intrinsic", tag: "span" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] },
    ],
    portalBoundaries: [],
  }
  return family
}

const htmlExample: InheritedInterfaceContract = {
  schemaVersion: 1, id: "html.example",
  source: { kind: "react-intrinsic", package: "@types/react", version: "18.3.3", declarationPath: "node_modules/@types/react/index.d.ts", declarationSha256: "a".repeat(64), symbol: "React.JSX.IntrinsicElements[\"example\"]" },
  evidence: { declaration: { kind: "inherited-interface", source: "node_modules/@types/react/index.d.ts" } },
  props: [{ name: "inheritedState", required: false, type: { kind: "boolean" }, typeText: "boolean", evidenceRefs: ["declaration"] }],
  events: [{ propName: "onClick", required: false, payload: { kind: "boolean" }, payloadTypeText: "boolean", evidenceRefs: ["declaration"] }],
  unresolved: [],
}
const authority = { interfaceIds: new Set(["html.example"]), interfacePropNames: new Map([["html.example", new Set(["onClick", "inheritedState"])]]), interfaceContracts: new Map([[htmlExample.id, htmlExample]]), tokenIds: new Set(["color.primary"]), derivedTokenRuleIds: new Set(["spacing.multiplier"]), capabilityIds: new Set<string>(), componentExportIds: new Set(["button.Button"]), sourceIdentity: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40) } }

describe("component contract semantic invariants", () => {
  test("rejects a contract set whose declared family count exceeds its manifest", () => {
    const contractSet: ComponentContractSet = {
      schemaVersion: 1, id: "example", status: "candidate", designSystemId: "example", sourceBaselineCommit: "a".repeat(40), tokenContractId: "example-tokens",
      familyCount: 2, familyFiles: ["contracts/components/families/example.json"], interfaceFiles: [],
    }

    expect(validateComponentContractSetInvariants(contractSet)).toEqual(["Contract set familyCount must equal familyFiles length."])
  })

  test("accepts a valid generic family", () => {
    expect(validateComponentFamilyInvariants(validFamily(), authority)).toEqual([])
    expect(() => assertComponentFamilyInvariants(validFamily(), authority)).not.toThrow()
  })

  test("accepts a portal boundary targeting a reachable render node", () => {
    expect(validateComponentFamilyInvariants(withPortalBoundary(), authority)).toEqual([])
  })

  test("accepts a conditional render child reference", () => {
    expect(validateComponentFamilyInvariants(withConditionalChild(), authority)).toEqual([])
  })

  test.each([
    ["contradictory", [{ propName: "enabled", equals: true }, { propName: "enabled", equals: false }], "Component Example render alternative 0 condition contains contradictory predicates."],
    ["duplicate", [{ propName: "enabled", equals: true }, { propName: "enabled", equals: true }], "Component Example render alternative 0 condition contains duplicate predicates."],
  ])("rejects %s authored conjunctions", (_name, all, expected) => {
    const family = validFamily() as any
    family.exports[0].component.localProps.push({ name: "enabled", required: false, type: { kind: "boolean" }, evidenceRefs: ["source"] })
    const rendering = structuredClone(family.exports[0].component.rendering)
    family.exports[0].component.rendering = {
      alternatives: [
        { when: { all }, rendering, evidenceRefs: ["source"] },
        { otherwise: true, rendering: structuredClone(rendering), evidenceRefs: ["source"] },
      ],
    }

    expect(validateComponentFamilyInvariants(family, authority)).toContain(expected)
  })

  test.each([
    ["wrong boolean condition type", (f: any) => { f.exports[0].component.localProps[0].type = { kind: "boolean" } }, "Component Example render child condition for root->child has boolean prop tone but equals is not boolean."],
    ["illegal enum condition literal", (f: any) => { f.exports[0].component.rendering.nodes[0].children[0].when.equals = "loud" }, "Component Example render child condition for root->child has enum prop tone without value: loud."],
    ["missing child edge evidence", (f: any) => { f.exports[0].component.rendering.nodes[0].children[0].evidenceRefs = [] }, "Render child Example.root->child is missing evidence references."],
    ["unknown condition prop", (f: any) => { f.exports[0].component.rendering.nodes[0].children[0].when.propName = "missing" }, "Component Example render child condition references unknown prop: missing."],
  ])("rejects %s", (_description, mutate, expected) => {
    const family = withConditionalChild()
    mutate(family)
    expect(validateComponentFamilyInvariants(family, authority)).toContain(expected)
  })

  test("accepts a component-export render host when the export is JSX-authorable", () => {
    const family = changed((f: any) => { f.exports[0].component.rendering.nodes[0].host = { kind: "component-export", exportName: "Example" } })
    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])
  })

  test("rejects a component-export render host when the export is not JSX-authorable", () => {
    const family = changed((f: any) => {
      f.exports.push({ name: "Helper", kind: "helper", authorableJsx: false, evidenceRefs: ["source"] })
      f.exports[0].component.rendering.nodes[0].host = { kind: "component-export", exportName: "Helper" }
    })
    expect(validateComponentFamilyInvariants(family, authority)).toContain("Component Example render host references non-JSX-authorable export: Helper.")
  })

  test("rejects a hook render host", () => {
    const family = changed((f: any) => {
      f.exports.push({ name: "Hook", kind: "hook", authorableJsx: false, evidenceRefs: ["source"] })
      f.exports[0].component.rendering.nodes[0].host = { kind: "component-export", exportName: "Hook" }
    })
    expect(validateComponentFamilyInvariants(family, authority)).toContain("Component Example render host references non-JSX-authorable export: Hook.")
  })

  test("accepts a cross-family render host only when the target component export is authoritative", () => {
    const family = changed((f: any) => {
      f.exports[0].component.rendering.nodes[0].host = { kind: "cross-family-export", familyId: "button", exportName: "Button" }
    })
    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])

    const rendering = family.exports[0].component!.rendering
    if (!("nodes" in rendering)) throw new Error("Expected a rendering tree fixture")
    rendering.nodes[0].host = { kind: "cross-family-export", familyId: "button", exportName: "Missing" }
    expect(validateComponentFamilyInvariants(family, authority)).toContain("Component Example render host references unknown cross-family component export: button.Missing.")
  })

  test.each([
    ["unknown portal node", (f: any) => { f.exports[0].component.rendering.portalBoundaries[0].nodeId = "missing" }, "Component Example portal boundary references unknown render node: missing."],
    ["disconnected portal node", (f: any) => { f.exports[0].component.rendering.nodes.push({ id: "orphan", host: { kind: "intrinsic", tag: "span" }, receivesPublicProps: false, dataAttributes: [], children: [], evidenceRefs: ["source"] }); f.exports[0].component.rendering.portalBoundaries[0].nodeId = "orphan" }, "Component Example portal boundary references unreachable render node: orphan."],
    ["duplicate portal node", (f: any) => { f.exports[0].component.rendering.portalBoundaries.push({ nodeId: "portal", evidenceRefs: ["source"] }) }, "Component Example has duplicate portal boundary for render node: portal."],
    ["missing portal evidence", (f: any) => { f.exports[0].component.rendering.portalBoundaries[0].evidenceRefs = [] }, "Portal boundary Example.portal is missing evidence references."],
  ])("rejects %s", (_description, mutate, expected) => {
    const family = withPortalBoundary()
    mutate(family)
    expect(validateComponentFamilyInvariants(family, authority)).toContain(expected)
  })

  test.each([
    ["missing root", (f: any) => { f.exports[0].component.rendering.rootNodeId = "missing" }, "Component Example rendering root node is missing: missing."],
    ["missing public-props target", (f: any) => { f.exports[0].component.rendering.publicPropsTargetNodeId = "missing" }, "Component Example rendering public-props target node is missing: missing."],
    ["duplicate render-node ID", (f: any) => { f.exports[0].component.rendering.nodes.push({ ...f.exports[0].component.rendering.nodes[0] }) }, "Component Example has duplicate render-node ID: host."],
    ["disconnected render node", (f: any) => { f.exports[0].component.rendering.nodes.push({ id: "orphan", host: { kind: "intrinsic", tag: "span" }, receivesPublicProps: false, dataAttributes: [], children: [], evidenceRefs: ["source"] }) }, "Component Example rendering contains disconnected nodes."],
    ["render cycle", (f: any) => { f.exports[0].component.rendering.nodes[0].children.push({ nodeId: "host", evidenceRefs: ["source"] }) }, "Component Example rendering contains a cycle at node: host."],
    ["non-target public props", (f: any) => { f.exports[0].component.rendering.nodes[0].receivesPublicProps = false }, "Component Example rendering public-props target must receive public props."],
    ["unknown component render host", (f: any) => { f.exports[0].component.rendering.nodes[0].host = { kind: "component-export", exportName: "Missing" } }, "Component Example render host references unknown export: Missing."],
    ["unknown inherited render host", (f: any) => { f.exports[0].component.rendering.nodes[0].host = { kind: "inherited-interface", interfaceId: "html.missing" } }, "Component Example render host references unknown interface: html.missing."],
  ])("rejects %s render tree", (_description, mutate, expected) => {
    expect(validateComponentFamilyInvariants(changed(mutate), authority)).toContain(expected)
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
    ["bad state-channel prop reference", (f: ComponentFamilyContract) => f.exports[0].component!.stateChannels.push({ name: "open", controlledProp: "missing", evidenceRefs: ["source"] }), "State channel Example.open references unknown controlled prop: missing."],
    ["bad event prop reference", (f: ComponentFamilyContract) => f.exports[0].component!.events.push({ propName: "onMissing", evidenceRefs: ["source"] }), "Component Example event references unknown prop: onMissing."],
    ["bad render child reference", (f: any) => f.exports[0].component!.rendering.nodes[0].children.push({ nodeId: "Missing", evidenceRefs: ["source"] }), "Component Example render node host references unknown child: Missing."],
    ["slot maximum below minimum", (f: ComponentFamilyContract) => f.exports[0].component!.slots.push({ propName: "items", default: false, replacesHost: false, childCardinality: { min: 2, max: 1 }, forwardsProps: false, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] }), "Slot Example.items has max 1 below min 2."],
    ["source identity mismatch", (f: ComponentFamilyContract) => { f.source.canonicalBlobSha = "b".repeat(40) }, "Family source canonicalBlobSha does not match approved source identity."],
    ["missing conditional API evidence", (f: ComponentFamilyContract) => f.exports[0].component!.conditionalApi.push({ when: { propName: "tone", equals: "quiet" }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["missing"] }), "Conditional API Example.tone references missing evidence: missing."],
    ["missing unresolved evidence", (f: ComponentFamilyContract) => f.unresolved.push({ topic: "unknown", scope: "example", reason: "unknown", evidenceAttempted: [], evidenceRefs: ["missing"] }), "Unresolved fact unknown references missing evidence: missing."],
  ])("rejects %s", (_description, mutate, expected) => {
    expect(validateComponentFamilyInvariants(changed(mutate), authority)).toContain(expected)
  })

  test.each([
    ["unknown inherited default", (f: any) => f.exports[0].component.inheritedPropDefaults.push({ propName: "missing", value: true, evidenceRefs: ["source"] }), "Component Example inherited prop default references unknown inherited prop: missing."],
    ["duplicate inherited defaults", (f: any) => { f.exports[0].component.inheritedPropDefaults.push({ propName: "inheritedState", value: true, evidenceRefs: ["source"] }); f.exports[0].component.inheritedPropDefaults.push({ propName: "inheritedState", value: false, evidenceRefs: ["source"] }) }, "Component Example has duplicate inherited prop default: inheritedState."],
    ["default collides with local prop", (f: any) => f.exports[0].component.inheritedPropDefaults.push({ propName: "tone", value: "quiet", evidenceRefs: ["source"] }), "Component Example inherited prop default references unknown inherited prop: tone."],
  ])("rejects %s inherited default", (_description, mutate, expected) => {
    expect(validateComponentFamilyInvariants(changed(mutate), authority)).toContain(expected)
  })

  test("permits inherited state and event prop references", () => {
    const family = validFamily()
    family.exports[0].component!.stateChannels.push({ name: "state", controlledProp: "inheritedState", changeEventProp: "onClick", evidenceRefs: ["source"] })
    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])
  })
})
