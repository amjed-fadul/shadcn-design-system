import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import { isRenderingTree, type ComponentFamilyContract, type InheritedInterfaceContract, type RenderingFact, type RenderingTree } from "../src/contracts/components/types"
import { analyzeJsxRenderTree, compareJsxRenderTree, extractCvaVariantLiterals, extractDataSlotLiterals, extractFunctionPropDefaults, listModuleExports, readCanonicalSourceBlobSha } from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependencies, analyzeTailwindTokenDependencies, auditComponentTokenCoverage } from "./helpers/component-token-analysis"
import { analyzeIntrinsicReactInterface } from "./helpers/typescript-interface-analysis"
import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

function renderingTrees(rendering: RenderingFact): RenderingTree[] {
  return isRenderingTree(rendering) ? [rendering] : rendering.alternatives.map((alternative) => alternative.rendering)
}

const root = fileURLToPath(new URL("../", import.meta.url))
const familyIds = ["badge", "input", "separator", "skeleton", "card", "textarea", "table", "label"]
const currentNineFamilyIds = ["badge", "button", ...familyIds]

function loadFamily(id: string): ComponentFamilyContract {
  return JSON.parse(readFileSync(join(root, `contracts/components/families/${id}.json`), "utf8")) as ComponentFamilyContract
}

function loadInterface(id: string): InheritedInterfaceContract {
  return JSON.parse(readFileSync(join(root, `contracts/components/interfaces/${id}.json`), "utf8")) as InheritedInterfaceContract
}

function sourcePath(id: string) { return join(root, `src/components/ui/${id}.tsx`) }
const interfaceContracts = contractSet.interfaceFiles.map((file) => loadInterface(file.replace(/^contracts\/components\/interfaces\//, "").replace(/\.json$/, "")))
const intrinsicProps = new Map(interfaceContracts.filter((item) => item.source.kind === "react-intrinsic").map((item) => [item.id, analyzeIntrinsicReactInterface(item.source.symbol.match(/\["([^\"]+)"\]/)?.[1] as keyof React.JSX.IntrinsicElements)]))

function authority(families: ComponentFamilyContract[], interfaces: InheritedInterfaceContract[]) {
  return {
    interfaceIds: new Set(interfaces.map((item) => item.id)),
    interfacePropNames: new Map(interfaces.map((item) => [item.id, new Set(item.props.map((prop) => prop.name))])),
    interfaceContracts: new Map(interfaces.map((item) => [item.id, item])),
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
    capabilityIds: new Set<string>(),
    sourceIdentity: undefined,
  }
}

describe("simple/native-oriented component contracts", () => {
  test("preserves the frozen Task 3 subset within the expanded family set", () => {
    expect(["candidate", "approved"]).toContain(contractSet.status)
    expect(contractSet.familyCount).toBe(canonicalFamilyIds.length)
    const frozenFiles = ["button", ...familyIds].map((id) => `contracts/components/families/${id}.json`).sort()
    expect(contractSet.familyFiles.filter((file) => frozenFiles.includes(file)).sort()).toEqual(frozenFiles)
    expect(contractSet.familyFiles).toHaveLength(canonicalFamilyIds.length)
  })

  test.each(familyIds)("reconciles %s identity and exact public exports", (id) => {
    const family = loadFamily(id)
    const source = sourcePath(id)
    const seed = JSON.parse(readFileSync(join(root, "provenance/seed-components.json"), "utf8")).components[id]
    expect(family.id).toBe(id)
    expect(family.source).toMatchObject({ canonicalPath: seed.canonicalPath, canonicalBlobSha: seed.canonicalBlobSha, implementationKind: seed.implementationKind, upstreamPath: seed.upstreamPath, upstreamBlobSha: seed.upstreamBlobSha })
    expect(family.source.canonicalBlobSha).toBe(readCanonicalSourceBlobSha(source))
    expect(family.exports.map(({ name, kind, authorableJsx }) => [name, kind, authorableJsx]).sort()).toEqual(listModuleExports(source).map(({ name, declarationKind }) => [name, declarationKind === "FunctionDeclaration" ? "component" : "helper", declarationKind === "FunctionDeclaration"]).sort())
    for (const entry of family.exports) expect(entry.evidenceRefs.every((ref) => ref in family.evidence)).toBe(true)
  })

  test.each(familyIds)("reconciles %s source-derived rendering, props, tokens, interfaces, and invariants", (id) => {
    const family = loadFamily(id)
    const source = sourcePath(id)
    const interfaces = interfaceContracts
    const names = new Set(family.exports.map((entry) => entry.name))
    const refs = family.exports.flatMap((entry) => entry.component?.inherits ?? [])
    expect(refs.every((ref) => interfaces.some((item) => item.id === ref))).toBe(true)
    for (const contract of interfaces) {
      expect(existsSync(join(root, contract.source.declarationPath))).toBe(true)
      expect(createHash("sha256").update(readFileSync(join(root, contract.source.declarationPath))).digest("hex")).toBe(contract.source.declarationSha256)
      expect(validateInheritedInterfaceInvariants(contract)).toEqual([])
      if (contract.source.kind === "react-intrinsic") expect(contract.props.map((prop) => [prop.name, prop.required, prop.typeText])).toEqual(intrinsicProps.get(contract.id)!.map((prop) => [prop.name, prop.required, prop.typeText]))
    }
    for (const entry of family.exports) {
      if (entry.kind === "component") {
        expect(entry.authorableJsx).toBe(true)
        expect(entry.component).toBeDefined()
        expect(renderingTrees(entry.component!.rendering).every((rendering) => rendering.nodes.length > 0)).toBe(true)
        expect(renderingTrees(entry.component!.rendering).flatMap((rendering) => rendering.nodes).flatMap((node) => node.dataAttributes).every(({ name, value, prop }) => name.startsWith("data-") && (prop || (value && extractDataSlotLiterals(source).includes(value))))).toBe(true)
        expect(renderingTrees(entry.component!.rendering).every((rendering) => rendering.nodes.filter((node) => node.receivesPublicProps).length === 1)).toBe(true)
      } else {
        expect(entry.authorableJsx).toBe(false)
        expect(entry.component).toBeUndefined()
      }
    }
    const normalizeTokens = (dependencies: Array<{ tokenId: string; when?: unknown; viaDerivedRule?: unknown }>) => dependencies.map(({ tokenId, when, viaDerivedRule }) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })).filter((dependency, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(dependency)) === index).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    const actualTokens = normalizeTokens(family.exports.flatMap((entry) => entry.component?.tokenDependencies ?? []))
    const expectedTokens = normalizeTokens(analyzeComponentTokenDependencies(source))
    expect(actualTokens).toEqual(expectedTokens)
    expect(family.unresolved).toEqual(expect.any(Array))
    expect(validateComponentFamilyInvariants(family, authority([], interfaces))).toEqual([])
  })

  test("reconciles Badge CVA, asChild Slot, and local defaults", () => {
    const family = loadFamily("badge")
    const source = sourcePath("badge")
    const badge = family.exports.find((entry) => entry.name === "Badge")!.component!
    const variants = extractCvaVariantLiterals(source, "badgeVariants")
    const defaults = extractFunctionPropDefaults(source, "Badge")
    expect(badge.localProps.map((prop) => prop.name)).toEqual(["variant", "asChild"])
    expect(badge.localProps[0].type).toEqual({ kind: "enum", values: variants.variants.variant })
    expect(badge.localProps[0].default).toBe(variants.defaults.variant)
    expect(badge.localProps[1].default).toBe(defaults.get("asChild"))
    expect(badge.slots).toHaveLength(1)
    expect(badge.slots[0]).toMatchObject({ propName: "asChild", default: false, replacesHost: true, childCardinality: { min: 0, max: 1 }, forwardsProps: true, childRequires: ["multiple children require a Radix Slottable that resolves to one React element"], refForwarding: "unresolved" })
    const sourceRendering = analyzeJsxRenderTree(source, "Badge")
    expect(compareJsxRenderTree(badge.rendering, sourceRendering)).toEqual([])
    const predicateMutation = structuredClone(badge.rendering)
    if (isRenderingTree(predicateMutation)) throw new Error("Badge must preserve its conditional host alternatives.")
    predicateMutation.alternatives[0].when = { propName: "asChild", equals: false }
    expect(compareJsxRenderTree(predicateMutation, sourceRendering)).toContain("Render alternative condition mismatch at 0.")
    const omittedBranch = structuredClone(badge.rendering)
    if (isRenderingTree(omittedBranch)) throw new Error("Badge must preserve its conditional host alternatives.")
    omittedBranch.alternatives.pop()
    expect(compareJsxRenderTree(omittedBranch, sourceRendering)).toContain("Render alternative count mismatch.")
  })

  test("reconciles CVA and local defaults for Card", () => {
    const family = loadFamily("card")
    const card = family.exports.find((entry) => entry.name === "Card")!.component!
    expect(card.localProps).toEqual([{ name: "size", required: false, type: { kind: "enum", values: ["default", "sm"] }, default: "default", evidenceRefs: ["source"] }])
    expect(family.exports.filter((entry) => entry.kind === "component")).toHaveLength(7)
  })

  test("captures Table's non-exported wrapper and public-props render target", () => {
    const table = loadFamily("table").exports.find((entry) => entry.name === "Table")!.component! as any
    expect(table.rendering.rootNodeId).toBe("container")
    expect(table.rendering.publicPropsTargetNodeId).toBe("table")
    expect(table.rendering.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "container", host: { kind: "intrinsic", tag: "div" }, receivesPublicProps: false, children: [expect.objectContaining({ nodeId: "table", evidenceRefs: ["source"] })] }),
      expect.objectContaining({ id: "table", host: { kind: "intrinsic", tag: "table" }, receivesPublicProps: true, children: [] }),
    ]))
  })

  test("captures inherited defaults supplied by Separator's wrapper", () => {
    const separator = loadFamily("separator").exports.find((entry) => entry.name === "Separator")!.component! as any
    expect(separator.inheritedPropDefaults).toEqual(expect.arrayContaining([
      expect.objectContaining({ propName: "orientation", value: "horizontal" }),
      expect.objectContaining({ propName: "decorative", value: true }),
    ]))
  })

  test("reconciles every approved token utility in source modifiers", () => {
    expect(analyzeTailwindTokenDependencies("border-input file:text-foreground placeholder:text-muted-foreground md:text-sm leading-relaxed leading-snug leading-normal ms-4 hover:bg-muted/50 focus-visible:ring-ring/50").map(({ tokenId }) => tokenId).sort()).toEqual([
      "color.input", "color.foreground", "color.muted-foreground", "font-size.sm", "line-height.relaxed", "line-height.snug", "line-height.normal", "spacing.unit", "color.muted", "color.ring",
    ].sort())
  })

  test("resolves approved font-family utilities from the canonical theme vocabulary", () => {
    expect(tokenContract.tokens.filter((token) => token.category === "font-family").map(({ id }) => id)).toEqual(["font.sans", "font.heading"])
    expect(analyzeTailwindTokenDependencies("font-heading font-sans").map(({ tokenId }) => tokenId)).toEqual(["font.heading", "font.sans"])
  })

  test("reconciles CardTitle's approved heading font dependency", () => {
    const card = loadFamily("card")
    const cardTitle = card.exports.find((entry) => entry.name === "CardTitle")!.component!
    expect(cardTitle.tokenDependencies.map(({ tokenId }) => tokenId)).toContain("font.heading")
  })

  test("audits every encountered utility in the nine current families", () => {
    const findings = currentNineFamilyIds.flatMap((id) => auditComponentTokenCoverage(sourcePath(id)))
    expect(new Set(tokenContract.coverage.contracted)).toEqual(new Set(["color", "radius", "font-family", "font-size", "font-weight", "letter-spacing", "line-height", "spacing", "shadow"]))
    expect(findings.filter(({ classification }) => classification === "suspicious-contracted-namespace")).toEqual([])
    expect(findings.filter(({ classification }) => classification === "resolved-approved-token").every(({ tokenId }) => tokenContract.tokens.some((token) => token.id === tokenId))).toBe(true)
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ utility: "font-heading", classification: "resolved-approved-token", tokenId: "font.heading" }),
      expect.objectContaining({ utility: "leading-none", classification: "recognized-no-approved-token" }),
      expect.objectContaining({ utility: "border", classification: "known-not-contracted-namespace", namespace: "border-width" }),
    ]))
  })
})
