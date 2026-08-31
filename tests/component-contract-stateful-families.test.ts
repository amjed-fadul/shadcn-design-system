import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { resolveConditionalApiShape, validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import type { ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import * as tokenAnalysis from "./helpers/component-token-analysis"
import { extractCvaVariantLiterals, extractFunctionPropDefaults, listModuleExports, readCanonicalSourceBlobSha } from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependencies, auditComponentTokenCoverage } from "./helpers/component-token-analysis"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"

const task4FamilyFiles = ["accordion", "checkbox", "scroll-area", "tabs", "tooltip"]
const root = fileURLToPath(new URL("../", import.meta.url))
const analysisFixture = join(root, "tests/fixtures/component-analysis-fixture.tsx")
const completenessFixture = join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx")

function loadJson<T>(path: string): T | undefined {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : undefined
}

function family(id: string) {
  return loadJson<ComponentFamilyContract>(join(root, `contracts/components/families/${id}.json`))
}

function interfaceContract(id: string) {
  return loadJson<InheritedInterfaceContract>(join(root, `contracts/components/interfaces/${id}.json`))
}

const expectedInterfaceFacts = [
  ["radix.checkbox.root", "checkbox", "Root", ["checked", "defaultChecked", "required"], ["onCheckedChange"]],
  ["radix.checkbox.indicator", "checkbox", "Indicator", ["forceMount"], []],
  ["radix.tabs.root", "tabs", "Root", ["value", "defaultValue", "orientation", "activationMode"], ["onValueChange"]],
  ["radix.tabs.list", "tabs", "List", ["loop"], []],
  ["radix.tabs.trigger", "tabs", "Trigger", ["value"], []],
  ["radix.tabs.content", "tabs", "Content", ["value", "forceMount"], []],
  ["radix.accordion.item", "accordion", "Item", ["disabled", "value"], []],
  ["radix.accordion.header", "accordion", "Header", [], []],
  ["radix.accordion.trigger", "accordion", "Trigger", [], []],
  ["radix.accordion.content", "accordion", "Content", [], []],
  ["radix.tooltip.provider", "tooltip", "Provider", ["children", "delayDuration", "skipDelayDuration", "disableHoverableContent"], []],
  ["radix.tooltip.root", "tooltip", "Root", ["children", "open", "defaultOpen", "delayDuration", "disableHoverableContent"], ["onOpenChange"]],
  ["radix.tooltip.trigger", "tooltip", "Trigger", [], []],
  ["radix.tooltip.portal", "tooltip", "Portal", ["container", "forceMount"], []],
  ["radix.tooltip.content", "tooltip", "Content", ["forceMount", "sideOffset"], []],
  ["radix.tooltip.arrow", "tooltip", "Arrow", [], []],
  ["radix.scroll-area.root", "scroll-area", "Root", ["type", "dir", "scrollHideDelay"], []],
  ["radix.scroll-area.viewport", "scroll-area", "Viewport", [], []],
  ["radix.scroll-area.scrollbar", "scroll-area", "ScrollAreaScrollbar", ["orientation", "forceMount"], []],
  ["radix.scroll-area.thumb", "scroll-area", "ScrollAreaThumb", ["forceMount"], []],
  ["radix.scroll-area.corner", "scroll-area", "Corner", [], []],
] as const

function authority() {
  const interfaces = contractSet.interfaceFiles.map((file) => interfaceContract(file.replace("contracts/components/interfaces/", "").replace(".json", ""))).filter((item): item is InheritedInterfaceContract => Boolean(item))
  return {
    interfaceIds: new Set(interfaces.map((item) => item.id)),
    interfacePropNames: new Map(interfaces.map((item) => [item.id, new Set(item.props.map((prop) => prop.name))])),
    interfaceContracts: new Map(interfaces.map((item) => [item.id, item])),
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
  }
}

describe("stateful Phase 3 Task 4 component contracts", () => {
  test("preserves static token evidence while reporting unsupported dynamic class expressions", () => {
    const analyzeComponentTokenSource = (tokenAnalysis as { analyzeComponentTokenSource?: (sourcePath: string) => { resolved: Array<{ classNames: string }>; unresolved: Array<{ sourceText: string; reason: string }> } }).analyzeComponentTokenSource
    expect(analyzeComponentTokenSource).toBeTypeOf("function")
    const result = analyzeComponentTokenSource!(completenessFixture)
    expect(result.resolved).toEqual(expect.arrayContaining([expect.objectContaining({ classNames: "bg-border" })]))
    expect(result.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceText: "styles.root" }),
      expect.objectContaining({ sourceText: "`bg-${tone}`" }),
      expect.objectContaining({ sourceText: "classes" }),
      expect.objectContaining({ sourceText: "cvaClasses" }),
    ]))
    expect(analyzeComponentTokenDependencies(completenessFixture)).toEqual(expect.arrayContaining([{ tokenId: "color.border", evidenceRefs: ["source"] }]))
    expect(tokenAnalysis.compareComponentTokenDependencies(completenessFixture, [])).toEqual(expect.arrayContaining([expect.stringContaining("Unresolved class evidence")]))
  })

  test("discovers lexical CVA recipes in function and block scopes without losing static class evidence", () => {
    const dependencies = analyzeComponentTokenDependencies(completenessFixture)
    expect(dependencies).toEqual(expect.arrayContaining([
      { tokenId: "font-size.sm", evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 }, when: { propName: "size", equals: "sm" }, evidenceRefs: ["source"] },
      { tokenId: "shadow.sm", evidenceRefs: ["source"] },
      { tokenId: "color.border", evidenceRefs: ["source"] },
      { tokenId: "radius.lg", evidenceRefs: ["source"] },
      { tokenId: "shadow.md", evidenceRefs: ["source"] },
      { tokenId: "font-weight.medium", evidenceRefs: ["source"] },
    ]))
  })

  test("reports unsupported CVA variant shapes while retaining resolvable CVA bases", () => {
    const source = tokenAnalysis.analyzeComponentTokenSource(completenessFixture)
    expect(source.resolved).toEqual(expect.arrayContaining([expect.objectContaining({ classNames: "text-sm" }), expect.objectContaining({ classNames: "font-medium" })]))
    expect(source.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceText: "dynamicVariants", reason: expect.stringContaining("CVA variants") }),
      expect.objectContaining({ sourceText: "...dynamicVariants", reason: expect.stringContaining("CVA variant") }),
      expect.objectContaining({ sourceText: "...dynamicVariants", reason: expect.stringContaining("CVA configuration") }),
      expect.objectContaining({ sourceText: "...dynamicVariants", reason: expect.stringContaining("CVA variant value") }),
      expect.objectContaining({ sourceText: "...dynamicVariants", reason: expect.stringContaining("CVA compound") }),
    ]))
  })

  test("classifies arbitrary values, CSS keywords, and current color by generic utility semantics", () => {
    const findings = auditComponentTokenCoverage(completenessFixture)
    for (const utility of ["rounded-[7px]", "rounded-[inherit]", "text-current"]) expect(findings).toContainEqual(expect.objectContaining({ utility, classification: "recognized-no-approved-token" }))
  })

  test("tracks parameter-derived rest spreads and unresolved dynamic render evidence without losing static nodes", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(completenessFixture, "RenderCompletenessFixture")
    expect(tree).toMatchObject({ root: { tag: "Primitive.Root", receivesPublicProps: true, dataAttributes: [expect.objectContaining({ name: "data-slot", value: "static" }), expect.objectContaining({ name: "data-x" })], children: [expect.objectContaining({ tag: "StaticChild" })] } })
    expect(tree.unresolved).toEqual(expect.arrayContaining([expect.stringContaining("data-x"), expect.stringContaining("dynamicChild")]))
    const unsupportedSpread = sourceAnalysis.analyzeJsxRenderTree(completenessFixture, "UnsupportedSpreadFixture")
    expect(unsupportedSpread.root).toMatchObject({ receivesPublicProps: true })
    expect(unsupportedSpread.unresolved).toEqual(expect.arrayContaining([expect.stringContaining("Unsupported spread"), expect.stringContaining("data-state")]))
    expect(sourceAnalysis.analyzeJsxRenderTree(completenessFixture, "UnrelatedSpreadFixture")).toMatchObject({ root: { receivesPublicProps: false }, unresolved: [expect.stringContaining("Unsupported spread")] })
    const conditional = sourceAnalysis.analyzeJsxRenderTree(completenessFixture, "ConditionalRenderFixture")
    expect(conditional.root).toMatchObject({ children: expect.arrayContaining([expect.objectContaining({ tag: "StaticChild" })]) })
    expect(conditional.unresolved).toEqual(expect.arrayContaining([expect.stringContaining("Conditional JSX child")]))
    const multipleReturns = sourceAnalysis.analyzeJsxRenderTree(completenessFixture, "MultipleReturnFixture")
    expect(multipleReturns.root).toMatchObject({ tag: "Primitive.Root" })
    expect(multipleReturns.unresolved).toEqual(expect.arrayContaining([expect.stringContaining("Multiple returned JSX")]))
  })

  test("discovers direct, conditional, and CVA compound class-bearing expressions without harvesting unrelated strings", () => {
    const normalize = (dependencies: Array<{ tokenId: string; viaDerivedRule?: { id: string; multiplier: number }; when?: { propName: string; equals: string | number | boolean } }>) => dependencies.map(({ tokenId, viaDerivedRule, when }) => ({ tokenId, ...(viaDerivedRule ? { viaDerivedRule } : {}), ...(when ? { when } : {}) })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    expect(normalize(analyzeComponentTokenDependencies(analysisFixture))).toEqual(normalize([
      { tokenId: "radius.md" },
      { tokenId: "font-size.sm" },
      { tokenId: "font-size.sm", when: { propName: "tone", equals: "quiet" } },
      { tokenId: "shadow.sm" },
      { tokenId: "shadow.md" },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 3.5 } },
      { tokenId: "color.border" },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 } },
      { tokenId: "color.ring" },
      { tokenId: "color.foreground" },
    ]))
    expect(auditComponentTokenCoverage(analysisFixture).filter((finding) => finding.classification === "suspicious-contracted-namespace")).toEqual([])
  })

  test("derives JSX trees, portal nodes, nested branches, and public-props targets from wrapper source", () => {
    const analyzeJsxRenderTree = (sourceAnalysis as { analyzeJsxRenderTree?: (sourcePath: string, exportName: string) => unknown }).analyzeJsxRenderTree
    expect(analyzeJsxRenderTree).toBeTypeOf("function")
    expect(analyzeJsxRenderTree!(analysisFixture, "RenderFixture")).toMatchObject({
      root: { tag: "Primitive.Root", receivesPublicProps: true, children: [expect.objectContaining({ tag: "Primitive.Portal", portal: true })] },
      unresolved: [expect.stringContaining("Conditional JSX child")],
    })
  })

  test("reconciles Task 4 rendering facts from source and rejects invented portals or changed automatic children", () => {
    const compareJsxRenderTree = (sourceAnalysis as { compareJsxRenderTree?: (rendering: NonNullable<ComponentFamilyContract["exports"][number]["component"]>["rendering"], source: unknown) => string[] }).compareJsxRenderTree
    expect(compareJsxRenderTree).toBeTypeOf("function")
    for (const id of task4FamilyFiles) for (const entry of family(id)!.exports) if (entry.component) {
      expect(compareJsxRenderTree!(entry.component.rendering, sourceAnalysis.analyzeJsxRenderTree(join(root, `src/components/ui/${id}.tsx`), entry.name))).toEqual([])
    }

    const checkbox = structuredClone(family("checkbox")!)
    checkbox.exports[0].component!.rendering.portalBoundaries.push({ nodeId: "root", evidenceRefs: ["source"] })
    expect(compareJsxRenderTree!(checkbox.exports[0].component!.rendering, sourceAnalysis.analyzeJsxRenderTree(join(root, "src/components/ui/checkbox.tsx"), "Checkbox"))).not.toEqual([])

    const tooltip = structuredClone(family("tooltip")!)
    tooltip.exports.find((entry) => entry.name === "TooltipContent")!.component!.rendering.portalBoundaries = []
    expect(compareJsxRenderTree!(tooltip.exports.find((entry) => entry.name === "TooltipContent")!.component!.rendering, sourceAnalysis.analyzeJsxRenderTree(join(root, "src/components/ui/tooltip.tsx"), "TooltipContent"))).not.toEqual([])

    const scrollArea = structuredClone(family("scroll-area")!)
    scrollArea.exports.find((entry) => entry.name === "ScrollArea")!.component!.rendering.nodes.find((node) => node.id === "root")!.children.pop()
    expect(compareJsxRenderTree!(scrollArea.exports.find((entry) => entry.name === "ScrollArea")!.component!.rendering, sourceAnalysis.analyzeJsxRenderTree(join(root, "src/components/ui/scroll-area.tsx"), "ScrollArea"))).not.toEqual([])
  })

  test("rejects removed direct or conditional token dependencies and invented contract dependencies", () => {
    const compareComponentTokenDependencies = (tokenAnalysis as { compareComponentTokenDependencies?: (sourcePath: string, dependencies: Array<{ tokenId: string; when?: unknown; viaDerivedRule?: unknown }>) => string[] }).compareComponentTokenDependencies
    expect(compareComponentTokenDependencies).toBeTypeOf("function")
    const dependencies = (id: string) => family(id)!.exports.flatMap((entry) => entry.component?.tokenDependencies ?? [])

    const checkbox = structuredClone(dependencies("checkbox"))
    checkbox.splice(checkbox.findIndex((dependency) => dependency.tokenId === "spacing.unit" && dependency.viaDerivedRule?.multiplier === 3.5), 1)
    expect(compareComponentTokenDependencies!(join(root, "src/components/ui/checkbox.tsx"), checkbox)).not.toEqual([])

    const scrollArea = structuredClone(dependencies("scroll-area"))
    scrollArea.splice(scrollArea.findIndex((dependency) => dependency.tokenId === "spacing.unit" && dependency.viaDerivedRule?.multiplier === 2.5), 1)
    expect(compareComponentTokenDependencies!(join(root, "src/components/ui/scroll-area.tsx"), scrollArea)).not.toEqual([])

    const invented = structuredClone(dependencies("checkbox"))
    invented.push({ tokenId: "color.background", evidenceRefs: ["source", "tokens"] })
    expect(compareComponentTokenDependencies!(join(root, "src/components/ui/checkbox.tsx"), invented)).not.toEqual([])
  })
  test("registers exactly the five approved Task 4 family contract files", () => {
    expect(contractSet.familyFiles.filter((file) => task4FamilyFiles.some((id) => file.endsWith(`/${id}.json`))).sort()).toEqual(task4FamilyFiles.map((id) => `contracts/components/families/${id}.json`))
  })

  test.each(task4FamilyFiles)("audits %s source utilities without suspicious contracted namespaces", (id) => {
    expect(auditComponentTokenCoverage(join(root, `src/components/ui/${id}.tsx`)).filter((finding) => finding.classification === "suspicious-contracted-namespace")).toEqual([])
  })

  test.each(task4FamilyFiles)("has complete source-owned token and render evidence for %s", (id) => {
    const tokenSource = tokenAnalysis.analyzeComponentTokenSource(join(root, `src/components/ui/${id}.tsx`))
    expect(tokenSource.unresolved).toEqual([])
    const renderUnresolved = family(id)!.exports.flatMap((entry) => entry.component ? sourceAnalysis.analyzeJsxRenderTree(join(root, `src/components/ui/${id}.tsx`), entry.name).unresolved : [])
    expect(renderUnresolved).toEqual([])
  })

  test.each(task4FamilyFiles)("records every approved token dependency found in %s source", (id) => {
    const contract = family(id)
    expect(contract).toBeDefined()
    const normalize = (dependencies: Array<{ tokenId: string; when?: unknown; viaDerivedRule?: unknown }>) => dependencies.map(({ tokenId, when, viaDerivedRule }) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })).filter((dependency, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(dependency)) === index).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    expect(normalize(contract!.exports.flatMap((entry) => entry.component?.tokenDependencies ?? []))).toEqual(normalize(analyzeComponentTokenDependencies(join(root, `src/components/ui/${id}.tsx`))))
  })

  test.each(task4FamilyFiles)("reconciles %s source identity and exact public exports", (id) => {
    const contract = family(id)
    expect(contract).toBeDefined()
    const source = join(root, `src/components/ui/${id}.tsx`)
    const seed = JSON.parse(readFileSync(join(root, "provenance/seed-components.json"), "utf8")).components[id]
    const { canonicalPath, canonicalBlobSha, implementationKind, upstreamPath, upstreamBlobSha } = seed
    expect(contract!.source).toMatchObject({ canonicalPath, canonicalBlobSha, implementationKind, upstreamPath, upstreamBlobSha })
    expect(contract!.source.canonicalBlobSha).toBe(readCanonicalSourceBlobSha(source))
    expect(contract!.exports.map(({ name, kind, authorableJsx }) => [name, kind, authorableJsx]).sort()).toEqual(listModuleExports(source).map(({ name, declarationKind }) => [name, declarationKind === "FunctionDeclaration" ? "component" : "helper", declarationKind === "FunctionDeclaration"]).sort())
  })

  test.each(expectedInterfaceFacts)("derives %s facts from its pinned declaration", (id, packageName, symbol, props, events) => {
    const contract = interfaceContract(id)
    expect(contract).toBeDefined()
    const declarationPath = join(root, contract!.source.declarationPath)
    expect(createHash("sha256").update(readFileSync(declarationPath)).digest("hex")).toBe(contract!.source.declarationSha256)
    const analyzed = analyzePackageComponentInterface(contract!.source, { props: [...props], events: [...events] })
    expect({ props: contract!.props, events: contract!.events ?? [], conditionalApi: contract!.conditionalApi ?? [] }).toEqual(analyzed)
    expect(contract!.source.package).toBe(`@radix-ui/react-${packageName}`)
    expect(contract!.source.symbol).toBe(symbol)
    expect(validateInheritedInterfaceInvariants(contract!)).toEqual([])
  })

  test("models Checkbox's authoritative checked state and automatic indicator", () => {
    const checkbox = family("checkbox")!
    const component = checkbox.exports[0].component!
    expect(component.inherits).toEqual(["radix.checkbox.root"])
    expect(component.stateChannels).toEqual([{ name: "checked", controlledProp: "checked", defaultProp: "defaultChecked", changeEventProp: "onCheckedChange", evidenceRefs: ["source", "declaration"] }])
    expect(component.rendering.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "root", host: { kind: "inherited-interface", interfaceId: "radix.checkbox.root" }, receivesPublicProps: true, children: [expect.objectContaining({ nodeId: "indicator" })] }),
      expect.objectContaining({ id: "indicator", host: { kind: "inherited-interface", interfaceId: "radix.checkbox.indicator" }, children: [expect.objectContaining({ nodeId: "icon" })] }),
      expect.objectContaining({ id: "icon", host: { kind: "unresolved" } }),
    ]))
    expect(validateComponentFamilyInvariants(checkbox, authority())).toEqual([])
  })

  test("models Tabs' source-owned defaults and inherited value state", () => {
    const tabs = family("tabs")!
    const rootComponent = tabs.exports.find((entry) => entry.name === "Tabs")!.component!
    const listComponent = tabs.exports.find((entry) => entry.name === "TabsList")!.component!
    const source = join(root, "src/components/ui/tabs.tsx")
    expect(rootComponent.inheritedPropDefaults).toEqual([{ propName: "orientation", value: extractFunctionPropDefaults(source, "Tabs").get("orientation"), evidenceRefs: ["source"] }])
    expect(rootComponent.stateChannels).toEqual([{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["declaration"] }])
    const variants = extractCvaVariantLiterals(source, "tabsListVariants")
    expect(listComponent.localProps).toEqual([{ name: "variant", required: false, type: { kind: "enum", values: variants.variants.variant }, default: variants.defaults.variant, evidenceRefs: ["source"] }])
    expect(validateComponentFamilyInvariants(tabs, authority())).toEqual([])
  })

  test("resolves Accordion state only from the selected inherited branch", () => {
    const accordion = family("accordion")!
    const rootComponent = accordion.exports.find((entry) => entry.name === "Accordion")!.component!
    expect(rootComponent.inherits).toEqual(["radix.accordion.root"])
    expect(rootComponent.localProps).toEqual([])
    expect(rootComponent.events).toEqual([])
    expect(rootComponent.conditionalApi.flatMap((item) => [...item.propRefinements, ...item.eventRefinements])).toEqual([])
    expect(resolveConditionalApiShape(rootComponent, { propName: "type", equals: "single" }, authority())).toMatchObject({ props: expect.arrayContaining([expect.objectContaining({ name: "value", availability: "available", type: { kind: "string" } }), expect.objectContaining({ name: "defaultValue", availability: "available", type: { kind: "string" } })]), events: [expect.objectContaining({ propName: "onValueChange", payload: { kind: "string" } })] })
    expect(resolveConditionalApiShape(rootComponent, { propName: "type", equals: "multiple" }, authority())).toMatchObject({ props: expect.arrayContaining([expect.objectContaining({ name: "value", availability: "available", type: { kind: "array", item: { kind: "string" } } }), expect.objectContaining({ name: "collapsible", availability: "unavailable" })]), events: [expect.objectContaining({ propName: "onValueChange", payload: { kind: "array", item: { kind: "string" } } })] })
    expect(validateComponentFamilyInvariants(accordion, authority())).toEqual([])
  })

  test("models Tooltip portal and inherited open state", () => {
    const tooltip = family("tooltip")!
    const provider = tooltip.exports.find((entry) => entry.name === "TooltipProvider")!.component!
    const content = tooltip.exports.find((entry) => entry.name === "TooltipContent")!.component!
    expect(provider.inheritedPropDefaults).toEqual([{ propName: "delayDuration", value: 0, evidenceRefs: ["source"] }])
    expect(content.inheritedPropDefaults).toEqual([{ propName: "sideOffset", value: 0, evidenceRefs: ["source"] }])
    expect(content.rendering.portalBoundaries).toEqual([{ nodeId: "portal", evidenceRefs: ["source"] }])
    expect(validateComponentFamilyInvariants(tooltip, authority())).toEqual([])
  })

  test("models Scroll Area's source-owned automatic tree", () => {
    const scrollArea = family("scroll-area")!
    const rootComponent = scrollArea.exports.find((entry) => entry.name === "ScrollArea")!.component!
    const barComponent = scrollArea.exports.find((entry) => entry.name === "ScrollBar")!.component!
    expect(rootComponent.rendering.nodes.find((node) => node.id === "root")!.children.map((child) => child.nodeId)).toEqual(["viewport", "scrollbar", "corner"])
    expect(barComponent.inheritedPropDefaults).toEqual([{ propName: "orientation", value: "vertical", evidenceRefs: ["source"] }])
    expect(barComponent.rendering.nodes.find((node) => node.id === "scrollbar")!.children.map((child) => child.nodeId)).toEqual(["thumb"])
    expect(validateComponentFamilyInvariants(scrollArea, authority())).toEqual([])
  })
})
