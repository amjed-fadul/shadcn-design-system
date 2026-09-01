import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import Ajv2020 from "ajv/dist/2020.js"
import { describe, expect, test } from "vitest"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import { validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import { createComponentContractLoader, type ComponentContractArtifactSource, type ComponentContractIndex } from "../src/contracts/components/loader"
import { createComponentContractQuery } from "../src/contracts/components/query"
import { compareJsxRenderTree } from "../src/contracts/components/render-source-analysis"
import { createTokenSourceAnalyzer } from "../src/contracts/components/token-source-analysis"
import type { ComponentContractSet, ComponentFamilyContract, ComponentInvariantAuthority, InheritedInterfaceContract } from "../src/contracts/components/types"

const evidence = {
  source: { kind: "canonical-source" as const, source: "packages/starboard/review-panel.tsx" },
  declaration: { kind: "inherited-interface" as const, source: "fixtures/starboard.d.ts" },
}
const source = { canonicalPath: "packages/starboard/review-panel.tsx", canonicalBlobSha: "a".repeat(40), implementationKind: "fictional" }

function surfaceInterface(): InheritedInterfaceContract {
  return {
    schemaVersion: 1,
    id: "starboard.surface",
    source: { kind: "package-declaration", package: "@starboard/surface", version: "7.2.0", declarationPath: "fixtures/starboard.d.ts", declarationSha256: "b".repeat(64), symbol: "Surface" },
    evidence: { declaration: { kind: "inherited-interface", source: "fixtures/starboard.d.ts" } },
    props: [
      { name: "open", required: false, type: { kind: "boolean" }, typeText: "boolean", evidenceRefs: ["declaration"] },
      { name: "initialOpen", required: false, type: { kind: "boolean" }, typeText: "boolean", evidenceRefs: ["declaration"] },
    ],
    events: [{ propName: "onOpenChange", required: false, payload: { kind: "boolean" }, payloadTypeText: "boolean", evidenceRefs: ["declaration"] }],
    unresolved: [],
  }
}

function neutralFamily(): ComponentFamilyContract {
  return {
    schemaVersion: 1,
    id: "review-panel",
    source,
    evidence,
    exports: [
      {
        name: "ReviewPanel", kind: "component", authorableJsx: true, evidenceRefs: ["source"],
        component: {
          localProps: [
            { name: "presentation", required: false, type: { kind: "enum", values: ["inline", "overlay"] }, default: "inline", evidenceRefs: ["source"] },
            { name: "tone", required: false, type: { kind: "enum", values: ["calm", "urgent"] }, default: "calm", evidenceRefs: ["source"] },
            { name: "children", required: false, type: { kind: "typescript", typeText: "ReactNode" }, evidenceRefs: ["source"] },
          ],
          inherits: ["starboard.surface"],
          inheritedPropDefaults: [],
          slots: [{ propName: "children", default: true, replacesHost: false, childCardinality: { min: 0, max: 1 }, forwardsProps: false, childRequires: [], refForwarding: "unresolved", evidenceRefs: ["source"] }],
          composition: { requires: ["review-session"], provides: ["review-panel.context"], hardConstraints: ["review-session"] },
          stateChannels: [{ name: "open", controlledProp: "open", defaultProp: "initialOpen", changeEventProp: "onOpenChange", evidenceRefs: ["source", "declaration"] }],
          conditionalApi: [],
          events: [],
          tokenDependencies: [
            { tokenId: "color.notice", evidenceRefs: ["source"] },
            { tokenId: "space.unit", viaDerivedRule: { id: "space.scale", multiplier: 3 }, evidenceRefs: ["source"] },
          ],
          rendering: {
            alternatives: [
              {
                when: { propName: "presentation", equals: "inline" }, evidenceRefs: ["source"],
                rendering: { rootNodeId: "surface", publicPropsTargetNodeId: "surface", nodes: [{ id: "surface", host: { kind: "inherited-interface", interfaceId: "starboard.surface" }, receivesPublicProps: true, dataAttributes: [{ name: "data-tone", source: "prop", prop: "tone", evidenceRefs: ["source"] }], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] },
              },
              {
                otherwise: true, evidenceRefs: ["source"],
                rendering: { rootNodeId: "portal", publicPropsTargetNodeId: "surface", nodes: [
                  { id: "portal", host: { kind: "fragment" }, receivesPublicProps: false, dataAttributes: [], children: [{ nodeId: "surface", evidenceRefs: ["source"] }], evidenceRefs: ["source"] },
                  { id: "surface", host: { kind: "inherited-interface", interfaceId: "starboard.surface" }, receivesPublicProps: true, dataAttributes: [{ name: "data-open", source: "derived-condition", condition: { source: "state", name: "open", truthiness: "truthy" }, evidenceRefs: ["source"] }], children: [], evidenceRefs: ["source"] },
                ], portalBoundaries: [{ nodeId: "portal", evidenceRefs: ["source"] }] },
              },
            ],
          },
          accessibility: [{ feature: "review status", owner: "component", mechanism: "state marker", evidenceRefs: ["source"] }],
        },
      },
      {
        name: "ReviewPanelActions", kind: "component", authorableJsx: true, evidenceRefs: ["source"],
        component: {
          localProps: [], inherits: [], inheritedPropDefaults: [], slots: [], composition: { requires: ["review-panel.context"], provides: [], hardConstraints: ["review-panel.context"] }, stateChannels: [], conditionalApi: [], events: [], tokenDependencies: [],
          rendering: { rootNodeId: "actions", publicPropsTargetNodeId: "actions", nodes: [{ id: "actions", host: { kind: "component-export", exportName: "ReviewPanel" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }], portalBoundaries: [] }, accessibility: [],
        },
      },
      { name: "useReviewSession", kind: "hook", authorableJsx: false, evidenceRefs: ["source"] },
      { name: "reviewPanelRecipe", kind: "helper", authorableJsx: false, evidenceRefs: ["source"] },
    ],
    unresolved: [],
  }
}

function authority(): ComponentInvariantAuthority {
  const inherited = surfaceInterface()
  return {
    interfaceIds: new Set([inherited.id]),
    interfacePropNames: new Map([[inherited.id, new Set([...inherited.props.map((prop) => prop.name), ...(inherited.events ?? []).map((event) => event.propName)])]]),
    interfaceContracts: new Map([[inherited.id, inherited]]),
    tokenIds: new Set(["color.notice", "space.unit"]),
    derivedTokenRuleIds: new Set(["space.scale"]),
    capabilityIds: new Set(["review-session", "review-panel.context"]),
    sourceIdentity: source,
  }
}

function neutralArtifacts(): ComponentContractArtifactSource {
  const family = neutralFamily()
  const inherited = surfaceInterface()
  const contractSet: ComponentContractSet = {
    schemaVersion: 1,
    id: "starboard-contracts",
    status: "candidate",
    designSystemId: "starboard",
    sourceBaselineCommit: "c".repeat(40),
    tokenContractId: "starboard-tokens",
    familyCount: 1,
    familyFiles: ["contracts/components/families/review-panel.json"],
    interfaceFiles: ["contracts/components/interfaces/starboard.surface.json"],
  }
  const index: ComponentContractIndex = {
    schemaVersion: 1,
    contractSetId: contractSet.id,
    familyCount: 1,
    families: [{ familyId: family.id, components: ["ReviewPanel", "ReviewPanelActions"], hooks: ["useReviewSession"], helpers: ["reviewPanelRecipe"] }],
  }
  const artifacts = new Map<string, unknown>([
    ["contracts/components/component-contract-set.json", contractSet],
    ["contracts/components/index.json", index],
    [contractSet.familyFiles[0], family],
    [contractSet.interfaceFiles[0], inherited],
  ])
  return { readJson(path) { return structuredClone(artifacts.get(path)) } }
}

describe("design-system-neutral component contracts", () => {
  test("reconciles arbitrary configured token utilities from a fictional source", () => {
    const analyzer = createTokenSourceAnalyzer({
      classMergeFunctionNames: ["assemble"],
      recipeFunctionNames: ["recipe"],
      resolveUtility: (utility) => ({
        "bg-alert": { tokenId: "color.notice" },
        "text-alert": { tokenId: "color.notice" },
        "border-alert": { tokenId: "color.notice" },
        "pad-3": { tokenId: "space.unit", viaDerivedRule: { id: "space.scale", multiplier: 3 } },
      })[utility],
    })
    const sourcePath = resolve(process.cwd(), "tests/fixtures/starboard-token-fixture.tsx")
    const valid = [
      { tokenId: "color.notice" },
      { tokenId: "space.unit", viaDerivedRule: { id: "space.scale", multiplier: 3 } },
      { tokenId: "color.notice", when: { propName: "tone", equals: "urgent" } },
    ]

    expect(analyzer.analyzeComponentTokenSourceForExport(sourcePath, "ReviewPanel").unresolved).toEqual([])
    expect(analyzer.compareComponentTokenDependenciesForExport(sourcePath, "ReviewPanel", valid)).toEqual([])
    expect(analyzer.compareComponentTokenDependenciesForExport(sourcePath, "ReviewPanel", valid.slice(1))).toContain("Missing source token dependency for ReviewPanel: {\"tokenId\":\"color.notice\"}")
  })
  test("accepts a fictional component, hook, helper, inheritance, state, alternatives, portal, host delegation, and tokens", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const inherited = surfaceInterface()
    const family = neutralFamily()

    expect(ajv.compile(interfaceSchema)(inherited)).toBe(true)
    expect(ajv.compile(familySchema)(family)).toBe(true)
    expect(validateInheritedInterfaceInvariants(inherited)).toEqual([])
    expect(validateComponentFamilyInvariants(family, authority())).toEqual([])
  })

  test("keeps generic schema and invariant core free of design-system or component-family special cases", () => {
    const core = [
      "src/contracts/components/types.ts",
      "src/contracts/components/invariants.ts",
      "src/contracts/components/loader.ts",
      "src/contracts/components/query.ts",
      "src/contracts/components/token-source-analysis.ts",
      "src/contracts/components/render-source-analysis.ts",
      "contracts/components/component-family.schema.json",
      "contracts/components/inherited-interface.schema.json",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n")

    expect(core).not.toMatch(/shadcn|radix|accordion|button|dialog|tooltip|sidebar/i)
    expect(core).not.toMatch(/color\.(?:background|foreground|primary)|spacing\.(?:unit|multiplier)/i)
    expect(core).not.toMatch(/canonical-loader|canonical-query/i)
    expect(JSON.stringify(neutralFamily())).not.toMatch(/asChild|Radix|CVA|shadcn|variant|size/)
  })

  test("generic render analysis accepts caller-supplied neutral host conventions", () => {
    const rendering: Parameters<typeof compareJsxRenderTree>[0] = {
      rootNodeId: "host", publicPropsTargetNodeId: "host", portalBoundaries: [],
      nodes: [{ id: "host", host: { kind: "component-export", exportName: "Panel" }, receivesPublicProps: true, dataAttributes: [], children: [] }],
    }
    const source: Parameters<typeof compareJsxRenderTree>[1] = {
      root: { tag: "Vendor.Panel", kind: "member", portal: false, receivesPublicProps: true, dataAttributes: [], derivedSpreads: [], children: [] }, unresolved: [], unresolvedFindings: [],
    }

    expect(compareJsxRenderTree(rendering, source)).toContain("Render host mismatch at Vendor.Panel: Vendor.Panel.")
    expect(compareJsxRenderTree(rendering, source, { normalizeRenderName: (name) => name.replace(/^Vendor\./, "").toLowerCase() })).toEqual([])
  })

  test("rejects a malformed fictional hook through the production invariant boundary", () => {
    const family = neutralFamily()
    family.exports.find((entry) => entry.name === "useReviewSession")!.authorableJsx = true

    expect(validateComponentFamilyInvariants(family, authority())).toContain("Hook export useReviewSession must not be JSX-authorable.")
  })

  test("rejects fictional inheritance, state, conditional, capability, render, portal, and token drift", () => {
    const expectError = (mutate: (family: ComponentFamilyContract) => void, error: string) => {
      const family = neutralFamily()
      mutate(family)
      expect(validateComponentFamilyInvariants(family, authority())).toContain(error)
    }
    expectError((family) => { family.exports[0].component!.inherits = ["starboard.missing"] }, "Component ReviewPanel inherits unknown interface: starboard.missing.")
    expectError((family) => { family.exports[0].component!.stateChannels[0].controlledProp = "missingOpen" }, "State channel ReviewPanel.open references unknown controlled prop: missingOpen.")
    expectError((family) => { family.exports[0].component!.conditionalApi.push({ when: { propName: "missing", equals: true }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] }) }, "Conditional API ReviewPanel references unknown discriminant prop: missing.")
    expectError((family) => { family.exports[0].component!.composition.requires.push("missing-capability") }, "Component ReviewPanel required capability references unknown capability: missing-capability.")
    expectError((family) => { (family.exports[0].component!.rendering as { alternatives: Array<{ rendering: { portalBoundaries: Array<{ nodeId: string; evidenceRefs: string[] }> } }> }).alternatives[0].rendering.portalBoundaries.push({ nodeId: "missing", evidenceRefs: ["source"] }) }, "Component ReviewPanel alternative 0 portal boundary references unknown render node: missing.")
    expectError((family) => { family.exports[0].component!.tokenDependencies.push({ tokenId: "color.unknown", evidenceRefs: ["source"] }) }, "Component ReviewPanel references unknown token: color.unknown.")
  })

  test("loads and queries the fictional contract through generic immutable production boundaries", () => {
    const load = createComponentContractLoader({
      source: neutralArtifacts(),
      tokenIds: new Set(["color.notice", "space.unit"]),
      derivedTokenRuleIds: new Set(["space.scale"]),
      capabilityIds: new Set(["review-session", "review-panel.context"]),
      sourceReconciler: () => [],
    })
    const query = createComponentContractQuery(load)

    expect(query.getComponentFamily("review-panel").id).toBe("review-panel")
    expect(query.lookupComponentExport("review-panel", "useReviewSession").kind).toBe("hook")
    expect(query.queryComponentCapabilities("review-panel.context")).toEqual([
      { familyId: "review-panel", exportName: "ReviewPanel", relation: "provides" },
      { familyId: "review-panel", exportName: "ReviewPanelActions", relation: "requires" },
    ])
    expect(query.queryComponentTokenDependencies("color.notice")[0].dependency.tokenId).toBe("color.notice")
    expect(() => { ;(query.listComponentFamilies() as ComponentFamilyContract[]).push(neutralFamily()) }).toThrow()
    expect(() => { ;(query.getComponentFamily("review-panel") as ComponentFamilyContract).id = "forged" }).toThrow()
  })

  test("runs a configured source reconciler before exposing a generic contract", () => {
    const load = createComponentContractLoader({
      source: neutralArtifacts(),
      tokenIds: new Set(["color.notice", "space.unit"]),
      derivedTokenRuleIds: new Set(["space.scale"]),
      capabilityIds: new Set(["review-session", "review-panel.context"]),
      sourceReconciler: () => ["fictional source drift"],
    })

    expect(load).toThrow("fictional source drift")
  })

  test("generic production loading rejects a forged family count larger than its manifest", () => {
    const artifacts = neutralArtifacts()
    const source: ComponentContractArtifactSource = {
      readJson(path) {
        const document = artifacts.readJson(path)
        if (path.endsWith("component-contract-set.json")) (document as ComponentContractSet).familyCount = 2
        return document
      },
    }
    const load = createComponentContractLoader({
      source,
      tokenIds: new Set(["color.notice", "space.unit"]),
      derivedTokenRuleIds: new Set(["space.scale"]),
      capabilityIds: new Set(["review-session", "review-panel.context"]),
      sourceReconciler: () => [],
    })

    expect(load).toThrow("Contract set familyCount must equal familyFiles length.")
  })

  test("does not inherit a canonical token authority when generic token authority is omitted", () => {
    const artifacts = neutralArtifacts()
    const source: ComponentContractArtifactSource = {
      readJson(path) {
        const document = artifacts.readJson(path)
        if (!path.endsWith("review-panel.json")) return document
        const family = document as ComponentFamilyContract
        family.exports[0].component!.composition = { requires: [], provides: [], hardConstraints: [] }
        family.exports[0].component!.tokenDependencies = [{ tokenId: "color.primary", evidenceRefs: ["source"] }]
        family.exports[1].component!.composition = { requires: [], provides: [], hardConstraints: [] }
        return family
      },
    }
    const load = createComponentContractLoader({ source, sourceReconciler: () => [] })

    expect(load).toThrow("Component ReviewPanel references unknown token: color.primary.")
  })

  test("rejects fixture source facts through the configured production reconciliation boundary", () => {
    const load = createComponentContractLoader({
      source: neutralArtifacts(),
      tokenIds: new Set(["color.notice", "space.unit"]),
      derivedTokenRuleIds: new Set(["space.scale"]),
      capabilityIds: new Set(["review-session", "review-panel.context"]),
      sourceReconciler: ({ families }) => families[0].exports.some((entry) => entry.name === "ReviewPanel") ? ["review-panel fixture source export drift"] : [],
    })

    expect(load).toThrow("review-panel fixture source export drift")
  })
})
