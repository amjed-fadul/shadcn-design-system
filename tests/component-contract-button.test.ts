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

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(root, "src/components/ui/button.tsx")

describe("Button component contract", () => {
  test("reconciles source identity and public exports", () => {
    const seed = JSON.parse(readFileSync(join(root, "provenance/seed-components.json"), "utf8")).components.button
    expect(contractSet.familyCount).toBe(19)
    expect(contractSet.status).toBe("candidate")
    expect(contractSet.familyFiles).toContain("contracts/components/families/button.json")
    expect(button.id).toBe("button")
    expect(button.source).toMatchObject({ canonicalPath: seed.canonicalPath, canonicalBlobSha: seed.canonicalBlobSha, implementationKind: seed.implementationKind, upstreamPath: seed.upstreamPath, upstreamBlobSha: seed.upstreamBlobSha })
    expect(readCanonicalSourceBlobSha(sourcePath)).toBe("1ed156ee0d92a5cf614ce9c3268c1d3adf5f8ecc")
    expect(button.source.canonicalBlobSha).toBe(seed.canonicalBlobSha)
    expect(listModuleExports(sourcePath).map((item) => item.name).sort()).toEqual(["Button", "buttonVariants"])
    expect(button.exports.map((item) => [item.name, item.kind, item.authorableJsx]).sort()).toEqual([["Button", "component", true], ["buttonVariants", "helper", false]])
  })

  test("reconciles local defaults, CVA variants, slot delegation, and rendering", () => {
    const component = button.exports.find((item) => item.name === "Button")!.component!
    const variants = extractCvaVariantLiterals(sourcePath, "buttonVariants")
    const defaults = extractFunctionPropDefaults(sourcePath, "Button")
    expect(component.inherits).toEqual(["html.button"])
    expect(component.localProps.map((prop) => prop.name)).toEqual(["variant", "size", "asChild"])
    expect(component.localProps[0].type).toEqual({ kind: "enum", values: variants.variants.variant })
    expect(component.localProps[1].type).toEqual({ kind: "enum", values: variants.variants.size })
    expect(component.localProps[0].default).toBe(variants.defaults.variant)
    expect(component.localProps[1].default).toBe(variants.defaults.size)
    expect(component.localProps[2].default).toBe(defaults.get("asChild"))
    const rendering = extractButtonRenderingEvidence(sourcePath, "Button")
    expect(component.slots[0]).toMatchObject({ propName: rendering.conditionProp, default: rendering.asChildDefault, replacesHost: rendering.whenTrue === "Slot.Root" && rendering.whenFalse === rendering.defaultHost, forwardsProps: rendering.forwardsProps, childCardinality: { min: 0, max: 1 }, childRequires: ["multiple children require a Radix Slottable that resolves to one React element"], refForwarding: "unresolved" })
    expect(component.rendering.rootNodeId).toBe("host")
    expect(component.rendering.publicPropsTargetNodeId).toBe("host")
    expect(component.rendering.nodes).toHaveLength(1)
    expect(component.rendering.nodes[0].host).toEqual({ kind: "intrinsic", tag: rendering.defaultHost })
    expect(component.rendering.nodes[0].dataAttributes.map(({ name, value, prop }) => ({ name, value, sourceProp: prop }))).toEqual(rendering.dataAttributes)
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
    expect(normalize(dependencies.filter((dependency) => !dependency.when))).toEqual(normalize(analyzeTailwindTokenDependencies(baseClasses)))
    for (const [variant, classNames] of Object.entries(variantClasses.variant)) expect(normalize(dependencies.filter((dependency) => dependency.when?.propName === "variant" && dependency.when.equals === variant))).toEqual(normalize(analyzeTailwindTokenDependencies(classNames)))
    for (const [size, classNames] of Object.entries(variantClasses.size)) expect(normalize(dependencies.filter((dependency) => dependency.when?.propName === "size" && dependency.when.equals === size))).toEqual(normalize(analyzeTailwindTokenDependencies(classNames)))
    const authority = { interfaceIds: new Set([htmlButton.id]), interfacePropNames: new Map([[htmlButton.id, new Set(htmlButton.props.map((prop) => prop.name))]]), interfaceContracts: new Map([[htmlButton.id, htmlButton as InheritedInterfaceContract]]), tokenIds: new Set(tokenContract.tokens.map((token) => token.id)), derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)), capabilityIds: new Set<string>(), sourceIdentity: { canonicalPath: button.source.canonicalPath, canonicalBlobSha: readCanonicalSourceBlobSha(sourcePath) } }
    expect(validateInheritedInterfaceInvariants(htmlButton as InheritedInterfaceContract)).toEqual([])
    expect(validateComponentFamilyInvariants(button as ComponentFamilyContract, authority)).toEqual([])
  })
})
