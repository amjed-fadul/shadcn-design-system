import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import Ajv2020 from "ajv/dist/2020.js"
import { describe, expect, test } from "vitest"

import * as componentInvariants from "../../src/contracts/components/invariants"
import { isStructuredPropTypeAssignable, validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../../src/contracts/components/invariants"
import type { ComponentFamilyContract, InheritedInterfaceContract, StateChannel, StructuredPropType } from "../../src/contracts/components/types"
import accordionRoot from "../../contracts/components/interfaces/radix.accordion.root.json"
import { analyzePackageComponentInterface } from "./typescript-interface-analysis"

const familySchema = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/components/component-family.schema.json"), "utf8"))

const stringType: StructuredPropType = { kind: "string" }
const stringArrayType: StructuredPropType = { kind: "array", item: stringType }
const stringOrArrayType: StructuredPropType = { kind: "union", members: [stringType, stringArrayType] }
const checkboxStateType: StructuredPropType = { kind: "union", members: [{ kind: "boolean" }, { kind: "literal", value: "indeterminate" }] }

function accordionStyleFixture(): ComponentFamilyContract {
  return {
    schemaVersion: 1,
    id: "discriminated-example",
    source: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "example" },
    evidence: { source: { kind: "canonical-source", source: "src/example.tsx" } },
    exports: [{
      name: "DiscriminatedExample", kind: "component", authorableJsx: true, evidenceRefs: ["source"],
      component: {
        localProps: [
          { name: "type", required: true, type: { kind: "enum", values: ["single", "multiple"] }, evidenceRefs: ["source"] },
          { name: "value", required: false, type: stringOrArrayType, evidenceRefs: ["source"] },
          { name: "defaultValue", required: false, type: stringOrArrayType, evidenceRefs: ["source"] },
          { name: "collapsible", required: false, type: { kind: "boolean" }, evidenceRefs: ["source"] },
          { name: "onValueChange", required: false, type: { kind: "typescript", typeText: "(value: string | string[]) => void" }, evidenceRefs: ["source"] },
        ],
        inherits: [], slots: [], inheritedPropDefaults: [], composition: { requires: [], provides: [], hardConstraints: [] }, stateChannels: [],
        conditionalApi: [
          {
            when: { propName: "type", equals: "single" },
            propRefinements: [
              { propName: "value", availability: "available", required: false, type: stringType, evidenceRefs: ["source"] },
              { propName: "defaultValue", availability: "available", required: false, type: stringType, evidenceRefs: ["source"] },
            ],
            eventRefinements: [{ eventPropName: "onValueChange", payload: stringType, evidenceRefs: ["source"] }],
            stateChannels: [{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["source"] }],
            evidenceRefs: ["source"],
          },
          {
            when: { propName: "type", equals: "multiple" },
            propRefinements: [
              { propName: "value", availability: "available", required: false, type: stringArrayType, evidenceRefs: ["source"] },
              { propName: "defaultValue", availability: "available", required: false, type: stringArrayType, evidenceRefs: ["source"] },
              { propName: "collapsible", availability: "unavailable", evidenceRefs: ["source"] },
            ],
            eventRefinements: [{ eventPropName: "onValueChange", payload: stringArrayType, evidenceRefs: ["source"] }],
            stateChannels: [{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["source"] }],
            evidenceRefs: ["source"],
          },
        ],
        events: [{ propName: "onValueChange", payload: stringOrArrayType, evidenceRefs: ["source"] }],
        tokenDependencies: [],
        rendering: { rootNodeId: "host", publicPropsTargetNodeId: "host", nodes: [{ id: "host", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] },
        accessibility: [],
      },
    }],
    unresolved: [],
  }
}

const authority = { interfaceIds: new Set<string>(), interfacePropNames: new Map<string, Set<string>>(), interfaceContracts: new Map<string, InheritedInterfaceContract>(), tokenIds: new Set<string>(), derivedTokenRuleIds: new Set<string>(), sourceIdentity: { canonicalPath: "src/example.tsx", canonicalBlobSha: "a".repeat(40) } }
type TestAuthority = typeof authority

function accordionAuthority() {
  return {
    ...authority,
    interfaceIds: new Set([accordionRoot.id]),
    interfacePropNames: new Map([[accordionRoot.id, new Set([...accordionRoot.props.map((prop) => prop.name), ...accordionRoot.events.map((event) => event.propName)])]]),
    interfaceContracts: new Map([[accordionRoot.id, accordionRoot as InheritedInterfaceContract]]),
  }
}

function selectedShape(family: ComponentFamilyContract, value: "single" | "multiple", selectedAuthority = authority) {
  const resolver = (componentInvariants as typeof componentInvariants & { resolveConditionalApiShape: (component: NonNullable<ComponentFamilyContract["exports"][number]["component"]>, selection: { propName: string; equals: string }, authority: TestAuthority) => { props: Array<{ name: string; availability: string; required?: boolean; type?: StructuredPropType }>; events: Array<{ propName: string; payload?: StructuredPropType }> } }).resolveConditionalApiShape
  return resolver(family.exports[0].component!, { propName: "type", equals: value }, selectedAuthority)
}

describe("generic component-contract conditional refinements", () => {
  test("preserves arrays and literal unions as structured types", () => {
    expect(isStructuredPropTypeAssignable({ kind: "array", item: { kind: "string" } }, stringArrayType)).toBe(true)
    expect(isStructuredPropTypeAssignable({ kind: "string" }, stringArrayType)).toBe(false)
    expect(isStructuredPropTypeAssignable({ kind: "literal", value: true }, checkboxStateType)).toBe(true)
    expect(isStructuredPropTypeAssignable({ kind: "literal", value: false }, checkboxStateType)).toBe(true)
    expect(isStructuredPropTypeAssignable({ kind: "literal", value: "indeterminate" }, checkboxStateType)).toBe(true)
    expect(isStructuredPropTypeAssignable({ kind: "string" }, checkboxStateType)).toBe(false)
  })

  test("resolves a selected branch into the legal factual API shape", () => {
    const fixture = accordionStyleFixture()
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(familySchema)

    expect(validate(fixture)).toBe(true)
    expect(validateComponentFamilyInvariants(fixture, authority)).toEqual([])

    const single = selectedShape(fixture, "single")
    const multiple = selectedShape(fixture, "multiple")
    const singleValue = single.props.find((prop) => prop.name === "value")!
    const multipleValue = multiple.props.find((prop) => prop.name === "value")!
    const singleCollapsible = single.props.find((prop) => prop.name === "collapsible")!
    const multipleCollapsible = multiple.props.find((prop) => prop.name === "collapsible")!

    expect(singleValue.availability).toBe("available")
    expect(multipleValue.availability).toBe("available")
    if (singleValue.availability !== "available" || multipleValue.availability !== "available") throw new Error("Selected value props must remain available.")
    expect(isStructuredPropTypeAssignable(stringArrayType, singleValue.type!)).toBe(false)
    expect(isStructuredPropTypeAssignable(stringType, multipleValue.type!)).toBe(false)
    expect(singleCollapsible).toMatchObject({ availability: "available", required: false, type: { kind: "boolean" } })
    expect(multipleCollapsible).toEqual({ name: "collapsible", availability: "unavailable" })
    expect(isStructuredPropTypeAssignable(single.events[0].payload!, multiple.events[0].payload!)).toBe(false)
  })

  test("resolves selected inherited conditional facts without a component-owned base copy", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = []
    const inheritedAuthority = accordionAuthority()

    const single = selectedShape(fixture, "single", inheritedAuthority)
    const multiple = selectedShape(fixture, "multiple", inheritedAuthority)
    expect(single.props.find((prop) => prop.name === "value")).toMatchObject({ availability: "available", type: stringType })
    expect(multiple.props.find((prop) => prop.name === "value")).toMatchObject({ availability: "available", type: stringArrayType })
    expect(single.events.find((event) => event.propName === "onValueChange")?.payload).toEqual(stringType)
    expect(multiple.events.find((event) => event.propName === "onValueChange")?.payload).toEqual(stringArrayType)
    expect(single.props.find((prop) => prop.name === "collapsible")).toMatchObject({ availability: "available", required: false })
    expect(multiple.props.find((prop) => prop.name === "collapsible")).toEqual({ name: "collapsible", availability: "unavailable" })
  })

  test("applies a wrapper refinement after the selected inherited branch", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = [{
      when: { propName: "type", equals: "single" },
      propRefinements: [{ propName: "value", availability: "available", required: false, type: { kind: "literal", value: "fixed" }, evidenceRefs: ["source"] }],
      eventRefinements: [], stateChannels: [], evidenceRefs: ["source"],
    }]
    const inheritedAuthority = accordionAuthority()

    expect(selectedShape(fixture, "single", inheritedAuthority).props.find((prop) => prop.name === "value")).toMatchObject({ availability: "available", type: { kind: "literal", value: "fixed" } })
  })

  test("validates state channels against selected inherited facts", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = ["single", "multiple"].map((equals) => ({
      when: { propName: "type", equals }, propRefinements: [], eventRefinements: [],
      stateChannels: [{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["source"] }], evidenceRefs: ["source"],
    }))
    const inheritedAuthority = accordionAuthority()

    expect(validateComponentFamilyInvariants(fixture, inheritedAuthority)).toEqual([])
  })

  test("rejects inheritance when its complete authoritative interface contract is absent", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = []
    const namesOnlyAuthority = { ...accordionAuthority(), interfaceContracts: new Map<string, InheritedInterfaceContract>() }

    expect(validateComponentFamilyInvariants(fixture, namesOnlyAuthority)).toContain("Component DiscriminatedExample inherits interface without a resolved authoritative contract: radix.accordion.root.")
  })

  test("rejects a component-owned event copy when named-only inherited authority is supplied", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = [{ propName: "onValueChange", payload: { kind: "boolean" }, evidenceRefs: ["source"] }]
    component.conditionalApi = []
    const namesOnlyAuthority = { ...accordionAuthority(), interfaceContracts: new Map<string, InheritedInterfaceContract>() }

    expect(validateComponentFamilyInvariants(fixture, namesOnlyAuthority)).toContain("Component DiscriminatedExample inherits interface without a resolved authoritative contract: radix.accordion.root.")
  })

  test("rejects a wrapper prop widening the selected inherited single branch", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = [{ when: { propName: "type", equals: "single" }, propRefinements: [{ propName: "value", availability: "available", required: false, type: stringArrayType, evidenceRefs: ["source"] }], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] }]

    expect(validateComponentFamilyInvariants(fixture, accordionAuthority())).toContain("Conditional API DiscriminatedExample.type refines prop value with a type that does not narrow its selected branch.")
  })

  test("rejects a wrapper event widening the selected inherited single branch", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = [{ when: { propName: "type", equals: "single" }, propRefinements: [], eventRefinements: [{ eventPropName: "onValueChange", payload: stringArrayType, evidenceRefs: ["source"] }], stateChannels: [], evidenceRefs: ["source"] }]

    expect(validateComponentFamilyInvariants(fixture, accordionAuthority())).toContain("Conditional API DiscriminatedExample.type refines event onValueChange with a payload that does not narrow its selected branch.")
  })

  test("rejects a wrapper making an unavailable inherited multiple-branch prop available", () => {
    const fixture = accordionStyleFixture() as any
    const component = fixture.exports[0].component
    component.inherits = [accordionRoot.id]
    component.localProps = []
    component.events = []
    component.conditionalApi = [{ when: { propName: "type", equals: "multiple" }, propRefinements: [{ propName: "collapsible", availability: "available", required: false, type: { kind: "literal", value: true }, evidenceRefs: ["source"] }], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] }]

    expect(validateComponentFamilyInvariants(fixture, accordionAuthority())).toContain("Conditional API DiscriminatedExample.type cannot make selected-branch-unavailable prop available: collapsible.")
  })

  test("rejects the removed component-owned conditional API base", () => {
    const fixture = accordionStyleFixture() as any
    fixture.exports[0].component.conditionalApiBase = { props: fixture.exports[0].component.localProps, events: fixture.exports[0].component.events }
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(familySchema)

    expect(validate(fixture)).toBe(false)
  })

  test("derives every shared Accordion fact from the pinned declaration", () => {
    const artifact = accordionRoot as InheritedInterfaceContract
    const derived = analyzePackageComponentInterface(artifact.source, { props: ["type", "value", "defaultValue", "collapsible"], events: ["onValueChange"] })

    expect(createHash("sha256").update(readFileSync(artifact.source.declarationPath)).digest("hex")).toBe(artifact.source.declarationSha256)
    expect(JSON.parse(readFileSync("node_modules/@radix-ui/react-accordion/package.json", "utf8")).version).toBe(artifact.source.version)
    expect({ props: artifact.props, events: artifact.events, conditionalApi: artifact.conditionalApi }).toEqual(derived)

    const mutated = structuredClone(artifact)
    mutated.conditionalApi![0].eventRefinements[0].payload = { kind: "boolean" }
    expect({ props: mutated.props, events: mutated.events, conditionalApi: mutated.conditionalApi }).not.toEqual(derived)
  })

  test("rejects an inherited branch that does not narrow its union-wide fact", () => {
    const mutated = structuredClone(accordionRoot) as InheritedInterfaceContract
    mutated.conditionalApi![0].eventRefinements[0].payload = stringOrArrayType

    expect(validateInheritedInterfaceInvariants(mutated)).toContain("Inherited interface radix.accordion.root.type refines event onValueChange with a payload that does not narrow its base payload.")
  })

  test("rejects malformed structured types and undersized unions in the schema", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(familySchema)
    const malformedArray = accordionStyleFixture() as any
    malformedArray.exports[0].component.conditionalApi[1].propRefinements[0].type = { kind: "array" }
    const malformedUnion = accordionStyleFixture() as any
    malformedUnion.exports[0].component.localProps[1].type = { kind: "union", members: [stringType] }
    const malformedLiteral = accordionStyleFixture() as any
    malformedLiteral.exports[0].component.conditionalApi[1].propRefinements[0].type = { kind: "literal" }
    const missingStateRole = accordionStyleFixture() as any
    missingStateRole.exports[0].component.conditionalApi[0].stateChannels[0] = { name: "value", evidenceRefs: ["source"] }

    expect(validate(malformedArray)).toBe(false)
    expect(validate(malformedUnion)).toBe(false)
    expect(validate(malformedLiteral)).toBe(false)
    expect(validate(missingStateRole)).toBe(false)
  })

  test.each([
    ["unknown discriminator prop", (family: any) => { family.exports[0].component.conditionalApi[0].when.propName = "unknown" }, "Conditional API DiscriminatedExample references unknown discriminant prop: unknown."],
    ["invalid discriminator literal", (family: any) => { family.exports[0].component.conditionalApi[0].when.equals = "other" }, "Conditional API DiscriminatedExample.type has enum prop without value: other."],
    ["duplicate same-value cases", (family: any) => { family.exports[0].component.conditionalApi[1].when.equals = "single" }, "Component DiscriminatedExample has conflicting conditional API case for type=single."],
    ["unknown refined prop", (family: any) => { family.exports[0].component.conditionalApi[0].propRefinements[0].propName = "unknown" }, "Conditional API DiscriminatedExample.type refines unknown prop: unknown."],
    ["unknown refined event", (family: any) => { family.exports[0].component.conditionalApi[0].eventRefinements[0].eventPropName = "onUnknown" }, "Conditional API DiscriminatedExample.type refines unknown event: onUnknown."],
    ["non-narrowing prop", (family: any) => { family.exports[0].component.conditionalApi[0].propRefinements[0].type = { kind: "number" } }, "Conditional API DiscriminatedExample.type refines prop value with a type that does not narrow its base type."],
    ["non-narrowing event payload", (family: any) => { family.exports[0].component.conditionalApi[0].eventRefinements[0].payload = stringOrArrayType }, "Conditional API DiscriminatedExample.type refines event onValueChange with a payload that does not narrow its base payload."],
    ["required prop made unavailable", (family: any) => { family.exports[0].component.conditionalApi[0].propRefinements.push({ propName: "type", availability: "unavailable", evidenceRefs: ["source"] }) }, "Conditional API DiscriminatedExample.type cannot make required prop unavailable: type."],
    ["required prop made optional", (family: any) => { family.exports[0].component.conditionalApi[0].propRefinements.push({ propName: "type", availability: "available", required: false, type: { kind: "literal", value: "single" }, evidenceRefs: ["source"] }) }, "Conditional API DiscriminatedExample.type makes required prop optional: type."],
    ["value role pointing at an event", (family: any) => { family.exports[0].component.conditionalApi[0].stateChannels[0].controlledProp = "onValueChange" }, "State channel DiscriminatedExample.value controlled role references an event instead of a value prop: onValueChange."],
    ["change role pointing at a value", (family: any) => { family.exports[0].component.conditionalApi[0].stateChannels[0].changeEventProp = "value" }, "State channel DiscriminatedExample.value change role references a value prop instead of an event: value."],
    ["incompatible controlled/default types", (family: any) => { family.exports[0].component.conditionalApi[0].propRefinements[1].type = stringArrayType }, "State channel DiscriminatedExample.value has incompatible controlled and default value types."],
  ])("rejects %s", (_description, mutate, expected) => {
    const fixture = accordionStyleFixture()
    mutate(fixture)
    expect(validateComponentFamilyInvariants(fixture, authority)).toContain(expected)
  })
})

// @ts-expect-error Structured unions require at least two members, matching JSON Schema minItems.
const undersizedUnion: StructuredPropType = { kind: "union", members: [stringType] }
void undersizedUnion

// @ts-expect-error State channels require at least one controlled, default, or change-event role.
const rolelessStateChannel: StateChannel = { name: "value", evidenceRefs: ["source"] }
void rolelessStateChannel
