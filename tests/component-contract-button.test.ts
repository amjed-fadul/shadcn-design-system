import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import button from "../contracts/components/families/button.json"
import htmlButton from "../contracts/components/interfaces/html.button.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import type { ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import { extractButtonRenderingEvidence, extractCvaVariantLiterals, extractDataSlotLiterals, extractFunctionPropDefaults, listModuleExports, readCanonicalSourceBlobSha } from "./helpers/component-source-analysis"
import { analyzeTailwindTokenDependencies } from "./helpers/component-token-analysis"
import { analyzeIntrinsicReactInterface } from "./helpers/typescript-interface-analysis"
import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(root, "src/components/ui/button.tsx")

describe("Button component contract", () => {
  test("reconciles source identity and public exports", () => {
    const seed = JSON.parse(readFileSync(join(root, "provenance/seed-components.json"), "utf8")).components.button
    expect(contractSet.familyCount).toBe(canonicalFamilyIds.length)
    expect(["candidate", "approved"]).toContain(contractSet.status)
    expect(contractSet.familyFiles).toContain("contracts/components/families/button.json")
    expect(button.id).toBe("button")
    expect(button.source).toMatchObject({ canonicalPath: seed.canonicalPath, canonicalBlobSha: seed.canonicalBlobSha, implementationKind: seed.implementationKind, upstreamPath: seed.upstreamPath, upstreamBlobSha: seed.upstreamBlobSha })
    expect(readCanonicalSourceBlobSha(sourcePath)).toBe(button.source.canonicalBlobSha)
    expect(button.source.canonicalBlobSha).toBe(seed.canonicalBlobSha)
    expect(listModuleExports(sourcePath).map((item) => item.name).sort()).toEqual(["Button", "buttonVariants"])
    expect(button.exports.map((item) => [item.name, item.kind, item.authorableJsx]).sort()).toEqual([["Button", "component", true], ["buttonVariants", "helper", false]])
  })

  test("reconciles local defaults, CVA variants, slot delegation, and rendering", () => {
    const component = button.exports.find((item) => item.name === "Button")!.component!
    const variants = extractCvaVariantLiterals(sourcePath, "buttonVariants")
    const defaults = extractFunctionPropDefaults(sourcePath, "Button")
    expect(component.inherits).toEqual(["html.button"])
    expect(component.localProps.map((prop) => prop.name)).toEqual(["variant", "size", "asChild", "loading"])
    expect(component.localProps[0].type).toEqual({ kind: "enum", values: variants.variants.variant })
    expect(component.localProps[1].type).toEqual({ kind: "enum", values: variants.variants.size })
    expect(component.localProps[0].default).toBe(variants.defaults.variant)
    expect(component.localProps[1].default).toBe(variants.defaults.size)
    expect(component.localProps[2].default).toBe(defaults.get("asChild"))
    expect(component.localProps[3]).toMatchObject({ name: "loading", required: false, type: { kind: "boolean" }, default: false })
    const rendering = extractButtonRenderingEvidence(sourcePath, "Button")
    expect(component.slots[0]).toMatchObject({ propName: rendering.conditionProp, default: rendering.asChildDefault, replacesHost: rendering.whenTrue === "Slot.Root" && rendering.whenFalse === rendering.defaultHost, forwardsProps: rendering.forwardsProps, childCardinality: { min: 0, max: 1 }, childRequires: ["multiple children require a Radix Slottable that resolves to one React element"], refForwarding: "unresolved" })
    expect(component.rendering.alternatives.map(({ when, otherwise }) => ({ when, otherwise }))).toEqual([
      { when: { propName: rendering.conditionProp, equals: true }, otherwise: undefined },
      { when: undefined, otherwise: true },
    ])
    const [slotBranch, defaultBranch] = component.rendering.alternatives.map(({ rendering: branch }) => branch)
    expect(slotBranch.nodes[0].host).toEqual({ kind: "unresolved" })
    expect(defaultBranch.nodes[0].host).toEqual({ kind: "intrinsic", tag: rendering.defaultHost })
    for (const branch of [slotBranch, defaultBranch]) {
      expect(branch.rootNodeId).toBe("host")
      expect(branch.publicPropsTargetNodeId).toBe("host")
      expect(branch.nodes.map((node) => node.id)).toEqual(["host", "spinner", "slottable"])
      expect(branch.nodes[0].children.map((child) => [child.nodeId, child.when])).toEqual([["spinner", { source: "state", name: "isLoading", truthiness: "truthy" }], ["slottable", undefined]])
      expect(branch.nodes[1].host).toEqual({ kind: "cross-family-export", familyId: "spinner", exportName: "Spinner" })
      expect((branch.nodes[0].dataAttributes as Array<{ name: string; value?: string; prop?: string }>).map(({ name, value, prop }) => ({ name, value, sourceProp: prop }))).toEqual(rendering.dataAttributes)
    }
    expect(extractDataSlotLiterals(sourcePath)).toContain("button")
  })

  test("preserves the complete pinned inherited interface and token authority", () => {
    const declarationPath = join(root, htmlButton.source.declarationPath)
    expect(existsSync(declarationPath)).toBe(true)
    expect(createHash("sha256").update(readFileSync(declarationPath)).digest("hex")).toBe(htmlButton.source.declarationSha256)
    expect(JSON.parse(readFileSync(join(root, "node_modules/@types/react/package.json"), "utf8")).version).toBe("18.3.3")
    expect(htmlButton.source.version).toBe("18.3.3")
    const analyzed = analyzeIntrinsicReactInterface("button")
    expect(htmlButton.props.map((prop) => [prop.name, prop.required, prop.typeText])).toEqual(analyzed.map((prop) => [prop.name, prop.required, prop.typeText]))
    const dependencies = button.exports.find((item) => item.name === "Button")!.component!.tokenDependencies
    expect(dependencies.every((dependency) => tokenContract.tokens.some((token) => token.id === dependency.tokenId))).toBe(true)
    const variantClasses = extractCvaVariantLiterals(sourcePath, "buttonVariants").classNames
    const baseClasses = extractCvaVariantLiterals(sourcePath, "buttonVariants").baseClassName
    const normalize = (items: Array<{ tokenId: string; viaDerivedRule?: unknown }>) => items.map(({ tokenId, viaDerivedRule }) => ({ tokenId, ...(viaDerivedRule ? { viaDerivedRule } : {}) })).filter((item, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    type ComparableDependency = { when?: { subject?: string; propName?: string; equals?: unknown; all?: Array<{ subject?: string; propName: string; equals: unknown }> } }
    const hasRecipeCondition = (dependency: ComparableDependency, propName: "variant" | "size", equals?: string) => {
      const atoms = dependency.when?.all ?? (dependency.when ? [dependency.when] : [])
      return atoms.some((atom) => atom.subject === undefined && atom.propName === propName && (equals === undefined || atom.equals === equals))
    }
    expect(normalize(dependencies.filter((dependency) => !hasRecipeCondition(dependency, "variant") && !hasRecipeCondition(dependency, "size")))).toEqual(normalize(analyzeTailwindTokenDependencies(baseClasses)))
    for (const [variant, classNames] of Object.entries(variantClasses.variant)) expect(normalize(dependencies.filter((dependency) => hasRecipeCondition(dependency, "variant", variant)))).toEqual(normalize(analyzeTailwindTokenDependencies(classNames)))
    for (const [size, classNames] of Object.entries(variantClasses.size)) expect(normalize(dependencies.filter((dependency) => hasRecipeCondition(dependency, "size", size)))).toEqual(normalize(analyzeTailwindTokenDependencies(classNames)))
    const authority = { interfaceIds: new Set([htmlButton.id]), interfacePropNames: new Map([[htmlButton.id, new Set(htmlButton.props.map((prop) => prop.name))]]), interfaceContracts: new Map([[htmlButton.id, htmlButton as InheritedInterfaceContract]]), tokenIds: new Set(tokenContract.tokens.map((token) => token.id)), derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)), capabilityIds: new Set<string>(), componentExportIds: new Set(["spinner.Spinner"]), sourceIdentity: { canonicalPath: button.source.canonicalPath, canonicalBlobSha: readCanonicalSourceBlobSha(sourcePath) } }
    expect(validateInheritedInterfaceInvariants(htmlButton as InheritedInterfaceContract)).toEqual([])
    expect(validateComponentFamilyInvariants(button as ComponentFamilyContract, authority)).toEqual([])
  })
})
