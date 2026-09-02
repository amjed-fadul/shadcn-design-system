import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { resolveConditionalApiShape, validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import { isRenderingTree, type ComponentFamilyContract, type InheritedInterfaceContract, type RenderingFact, type RenderingTree } from "../src/contracts/components/types"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependencies, analyzeComponentTokenSource, auditComponentTokenCoverage, compareComponentTokenDependencies } from "./helpers/component-token-analysis"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const task5Families = ["dialog", "dropdown-menu", "select", "sheet"]
const task5Exports: Record<string, string[]> = {
  select: ["Select", "SelectContent", "SelectGroup", "SelectItem", "SelectLabel", "SelectScrollDownButton", "SelectScrollUpButton", "SelectSeparator", "SelectTrigger", "SelectValue"],
  "dropdown-menu": ["DropdownMenu", "DropdownMenuCheckboxItem", "DropdownMenuContent", "DropdownMenuGroup", "DropdownMenuItem", "DropdownMenuLabel", "DropdownMenuPortal", "DropdownMenuRadioGroup", "DropdownMenuRadioItem", "DropdownMenuSeparator", "DropdownMenuShortcut", "DropdownMenuSub", "DropdownMenuSubContent", "DropdownMenuSubTrigger", "DropdownMenuTrigger"],
  dialog: ["Dialog", "DialogClose", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogOverlay", "DialogPortal", "DialogTitle", "DialogTrigger"],
  sheet: ["Sheet", "SheetClose", "SheetContent", "SheetDescription", "SheetFooter", "SheetHeader", "SheetTitle", "SheetTrigger"],
}

function tree(rendering: RenderingFact): RenderingTree {
  if (!isRenderingTree(rendering)) throw new Error("Expected an unconditional rendering tree in a pre-Task 6A family.")
  return rendering
}

const expectedInterfaces = [
  ["radix.select.root", "select", "Root", ["open", "defaultOpen", "value", "defaultValue"], ["onOpenChange", "onValueChange"]],
  ["radix.select.trigger", "select", "Trigger", ["asChild"], []],
  ["radix.select.value", "select", "Value", ["placeholder", "asChild"], []],
  ["radix.select.content", "select", "Content", ["position", "forceMount", "asChild"], []],
  ["radix.select.group", "select", "Group", ["asChild"], []],
  ["radix.select.item", "select", "Item", ["value", "disabled", "asChild"], []],
  ["radix.select.label", "select", "Label", ["asChild"], []],
  ["radix.select.separator", "select", "Separator", ["asChild"], []],
  ["radix.select.scroll-up-button", "select", "ScrollUpButton", ["asChild"], []],
  ["radix.select.scroll-down-button", "select", "ScrollDownButton", ["asChild"], []],
  ["radix.select.portal", "select", "Portal", ["container", "forceMount"], []],
  ["radix.select.viewport", "select", "Viewport", ["nonce", "asChild"], []],
  ["radix.select.item-indicator", "select", "ItemIndicator", ["asChild"], []],
  ["radix.select.item-text", "select", "ItemText", ["asChild"], []],
  ["radix.dropdown-menu.root", "dropdown-menu", "Root", ["open", "defaultOpen", "modal"], ["onOpenChange"]],
  ["radix.dropdown-menu.trigger", "dropdown-menu", "Trigger", ["asChild"], []],
  ["radix.dropdown-menu.portal", "dropdown-menu", "Portal", ["container", "forceMount"], []],
  ["radix.dropdown-menu.content", "dropdown-menu", "Content", ["forceMount", "asChild"], []],
  ["radix.dropdown-menu.group", "dropdown-menu", "Group", ["asChild"], []],
  ["radix.dropdown-menu.label", "dropdown-menu", "Label", ["asChild"], []],
  ["radix.dropdown-menu.item", "dropdown-menu", "Item", ["disabled", "asChild"], ["onSelect"]],
  ["radix.dropdown-menu.checkbox-item", "dropdown-menu", "CheckboxItem", ["checked", "asChild"], ["onCheckedChange"]],
  ["radix.dropdown-menu.radio-group", "dropdown-menu", "RadioGroup", ["value", "asChild"], ["onValueChange"]],
  ["radix.dropdown-menu.radio-item", "dropdown-menu", "RadioItem", ["value", "asChild"], []],
  ["radix.dropdown-menu.separator", "dropdown-menu", "Separator", ["asChild"], []],
  ["radix.dropdown-menu.sub", "dropdown-menu", "Sub", ["open", "defaultOpen"], ["onOpenChange"]],
  ["radix.dropdown-menu.sub-trigger", "dropdown-menu", "SubTrigger", ["asChild"], []],
  ["radix.dropdown-menu.sub-content", "dropdown-menu", "SubContent", ["forceMount", "asChild"], []],
  ["radix.dialog.root", "dialog", "Root", ["open", "defaultOpen", "modal"], ["onOpenChange"]],
  ["radix.dialog.trigger", "dialog", "Trigger", ["asChild"], []],
  ["radix.dialog.portal", "dialog", "Portal", ["container", "forceMount"], []],
  ["radix.dialog.close", "dialog", "Close", ["asChild"], []],
  ["radix.dialog.overlay", "dialog", "Overlay", ["forceMount", "asChild"], []],
  ["radix.dialog.content", "dialog", "Content", ["forceMount", "asChild"], []],
  ["radix.dialog.title", "dialog", "Title", ["asChild"], []],
  ["radix.dialog.description", "dialog", "Description", ["asChild"], []],
] as const

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function family(id: string) { return loadJson<ComponentFamilyContract>(join(repoRoot, `contracts/components/families/${id}.json`)) }
function inherited(id: string) { return loadJson<InheritedInterfaceContract>(join(repoRoot, `contracts/components/interfaces/${id}.json`)) }
function sourcePath(id: string) { return join(repoRoot, `src/components/ui/${id}.tsx`) }
const declarationPropSupport = new Map<string, boolean>()
function declarationExposesProp(contract: InheritedInterfaceContract, propName: string) {
  const key = `${contract.id}:${propName}`
  const cached = declarationPropSupport.get(key)
  if (cached !== undefined) return cached
  try {
    const result = analyzePackageComponentInterface(contract.source, { props: [propName], events: [] }).props.length === 1
    declarationPropSupport.set(key, result)
    return result
  } catch (error) {
    if (error instanceof Error && error.message.includes(`missing requested prop: ${propName}`)) {
      declarationPropSupport.set(key, false)
      return false
    }
    throw error
  }
}
const asChildSlot = { propName: "asChild", default: false, replacesHost: true, childCardinality: { min: 0, max: 1 }, forwardsProps: true, childRequires: ["multiple children require a Radix Slottable that resolves to one React element"], refForwarding: "unresolved" as const, evidenceRefs: ["source", "declaration"] }
function asChildSlotErrors(contract: ComponentFamilyContract) {
  const errors: string[] = []
  for (const entry of contract.exports) {
    if (!entry.component) continue
    const supportsAsChild = entry.component.inherits.some((interfaceId) => declarationExposesProp(inherited(interfaceId), "asChild"))
    if (JSON.stringify(entry.component.slots) !== JSON.stringify(supportsAsChild ? [asChildSlot] : [])) errors.push(`Component ${entry.name} has Slot facts that do not match its pinned asChild declaration.`)
  }
  return errors
}
function authority() {
  const contracts = contractSet.interfaceFiles.map((file) => inherited(file.replace("contracts/components/interfaces/", "").replace(".json", "")))
  return {
    interfaceIds: new Set(contracts.map(({ id }) => id)),
    interfacePropNames: new Map(contracts.map((item) => [item.id, new Set(item.props.map(({ name }) => name))])),
    interfaceContracts: new Map(contracts.map((item) => [item.id, item])),
    tokenIds: new Set(tokenContract.tokens.map(({ id }) => id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map(({ id }) => id)),
    capabilityIds: new Set(["dialog.context", "dropdown-menu.context", "dropdown-menu.subcontext", "select.context", "sheet.context"]),
  }
}

describe("compound and overlay Phase 3 Task 5 component contracts", () => {
  test("preserves the four Task 5 families within the completed family set", () => {
    expect(contractSet.familyCount).toBe(19)
    expect(contractSet.familyFiles).toHaveLength(19)
    expect(contractSet.familyFiles.filter((file) => task5Families.some((id) => file.endsWith(`/${id}.json`))).sort()).toEqual(task5Families.map((id) => `contracts/components/families/${id}.json`).sort())
    expect(contractSet.familyFiles.some((file) => file.endsWith("/sidebar.json"))).toBe(true)
  })

  test.each(task5Families)("reconciles %s source exports independently", (id) => {
    const contract = family(id)
    expect(contract.exports.map(({ name }) => name).sort()).toEqual(task5Exports[id].slice().sort())
    expect(contract.exports.every(({ kind, authorableJsx }) => kind === "component" && authorableJsx)).toBe(true)
    expect(contract.source.canonicalBlobSha).toMatch(/^[0-9a-f]{40}$/)
    expect(contract.source.canonicalBlobSha).toBe(sourceAnalysis.readCanonicalSourceBlobSha(sourcePath(id)))
    expect(existsSync(sourcePath(id))).toBe(true)
  })

  test.each(expectedInterfaces)("reconciles %s against its pinned declaration", (id, packageName, symbol, props, events) => {
    const contract = inherited(id)
    expect(contract.source.package).toBe(`@radix-ui/react-${packageName}`)
    expect(contract.source.symbol).toBe(symbol)
    expect(createHash("sha256").update(readFileSync(join(repoRoot, contract.source.declarationPath))).digest("hex")).toBe(contract.source.declarationSha256)
    expect({ props: contract.props, events: contract.events ?? [], conditionalApi: contract.conditionalApi ?? [] }).toEqual(analyzePackageComponentInterface(contract.source, { props: [...props], events: [...events] }))
    expect(validateInheritedInterfaceInvariants(contract)).toEqual([])
  })

  test.each(expectedInterfaces)("records asChild only when %s exposes it in the pinned declaration", (id) => {
    const contract = inherited(id)
    expect(contract.props.some(({ name }) => name === "asChild")).toBe(declarationExposesProp(contract, "asChild"))
  })

  test.each(task5Families)("models only declaration-supported asChild slots for %s", (id) => {
    const contract = family(id)
    for (const entry of contract.exports) {
      if (!entry.component) continue
      const supportsAsChild = entry.component.inherits.some((interfaceId) => declarationExposesProp(inherited(interfaceId), "asChild"))
      expect(entry.component.slots).toEqual(supportsAsChild ? [asChildSlot] : [])
    }
    expect(asChildSlotErrors(contract)).toEqual([])
  })

  test("rejects removed factual asChild slots and invented unsupported slots", () => {
    const missing = structuredClone(family("select"))
    missing.exports.find(({ name }) => name === "SelectTrigger")!.component!.slots = []
    expect(asChildSlotErrors(missing)).toContain("Component SelectTrigger has Slot facts that do not match its pinned asChild declaration.")

    const invented = structuredClone(family("select"))
    invented.exports.find(({ name }) => name === "Select")!.component!.slots = [asChildSlot]
    expect(validateComponentFamilyInvariants(invented, authority())).toContain("Component Select slot references unknown public prop: asChild.")
  })

  test.each(task5Families)("has complete source evidence and no suspicious contracted namespace for %s", (id) => {
    const contract = family(id)
    expect(contract.unresolved).toEqual([])
    expect(auditComponentTokenCoverage(sourcePath(id)).filter(({ classification }) => classification === "suspicious-contracted-namespace")).toEqual([])
    expect(contract.exports.flatMap((entry) => entry.component ? sourceAnalysis.analyzeJsxRenderTree(sourcePath(id), entry.name).unresolved : [])).toEqual([])
    expect(contract.exports.flatMap((entry) => entry.component ? sourceAnalysis.compareJsxRenderTree(entry.component.rendering, sourceAnalysis.analyzeJsxRenderTree(sourcePath(id), entry.name)) : [])).toEqual([])
  })

  test("derives every approved Task 5 token and classifies raw primitive overlay color outside the semantic contract", () => {
    const dropdown = analyzeComponentTokenDependencies(sourcePath("dropdown-menu"))
    expect(dropdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenId: "letter-spacing.widest" }),
      expect.objectContaining({ tokenId: "shadow.lg" }),
    ]))
    for (const id of task5Families) {
      const analysis = analyzeComponentTokenSource(sourcePath(id))
      expect(analysis.unresolved).toEqual([])
      expect(auditComponentTokenCoverage(sourcePath(id)).filter(({ classification }) => classification === "suspicious-contracted-namespace")).toEqual([])
    }
    expect(auditComponentTokenCoverage(sourcePath("dialog"))).toContainEqual(expect.objectContaining({ utility: "bg-black", classification: "known-not-contracted-namespace", namespace: "primitive-color" }))
  })

  test.each(task5Families)("reconciles every %s token dependency against production source and rejects missing or invented facts", (id) => {
    const dependencies = family(id).exports.flatMap(({ component }) => component?.tokenDependencies ?? [])
    expect(compareComponentTokenDependencies(sourcePath(id), dependencies)).toEqual([])
    expect(dependencies).not.toEqual([])
    const key = (dependency: typeof dependencies[number]) => JSON.stringify({ tokenId: dependency.tokenId, when: dependency.when, viaDerivedRule: dependency.viaDerivedRule })
    const uniqueIndex = dependencies.findIndex((dependency, index, all) => all.filter((candidate) => key(candidate) === key(dependency)).length === 1)
    expect(uniqueIndex).toBeGreaterThanOrEqual(0)
    expect(compareComponentTokenDependencies(sourcePath(id), dependencies.filter((_, index) => index !== uniqueIndex))).not.toEqual([])
    expect(compareComponentTokenDependencies(sourcePath(id), [...dependencies, { tokenId: "color.primary", evidenceRefs: ["source", "tokens"] }])).not.toEqual([])
  })

  test("keeps independent Dropdown Menu state channels and indeterminate checked values", () => {
    const menu = family("dropdown-menu")
    const checkbox = menu.exports.find(({ name }) => name === "DropdownMenuCheckboxItem")!.component!
    const radio = menu.exports.find(({ name }) => name === "DropdownMenuRadioGroup")!.component!
    const sub = menu.exports.find(({ name }) => name === "DropdownMenuSub")!.component!
    expect(menu.exports.find(({ name }) => name === "DropdownMenu")!.component!.stateChannels).toEqual([{ name: "open", controlledProp: "open", defaultProp: "defaultOpen", changeEventProp: "onOpenChange", evidenceRefs: ["source", "declaration"] }])
    expect(checkbox.stateChannels).toEqual([{ name: "checked", controlledProp: "checked", changeEventProp: "onCheckedChange", evidenceRefs: ["source", "declaration"] }])
    expect(radio.stateChannels).toEqual([{ name: "value", controlledProp: "value", changeEventProp: "onValueChange", evidenceRefs: ["declaration"] }])
    expect(sub.stateChannels).toEqual([{ name: "open", controlledProp: "open", defaultProp: "defaultOpen", changeEventProp: "onOpenChange", evidenceRefs: ["declaration"] }])
    expect(inherited("radix.dropdown-menu.checkbox-item").props.find(({ name }) => name === "checked")?.typeText).toContain("indeterminate")
    expect(validateComponentFamilyInvariants(menu, authority())).toEqual([])
  })

  test("models Dialog and Sheet as shared Dialog authority with conditional close structure", () => {
    const dialog = family("dialog")
    const sheet = family("sheet")
    expect(new Set(dialog.exports.flatMap(({ component }) => component?.inherits ?? [])).size).toBeGreaterThan(0)
    expect(sheet.exports.flatMap(({ component }) => component?.inherits ?? []).filter((id) => id.startsWith("radix.sheet."))).toEqual([])
    for (const contract of [dialog, sheet]) {
      const content = contract.exports.find(({ name }) => name.endsWith("Content"))!.component!
      expect(content.conditionalApi).toEqual(expect.arrayContaining([
        expect.objectContaining({ when: { propName: "showCloseButton", equals: true } }),
        expect.objectContaining({ when: { propName: "showCloseButton", equals: false } }),
      ]))
      expect(tree(content.rendering).portalBoundaries).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: "portal" })]))
      expect(tree(content.rendering).nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "portal" }),
        expect.objectContaining({ id: "overlay" }),
        expect.objectContaining({ id: "content", receivesPublicProps: true }),
        expect.objectContaining({ id: "close", host: { kind: "component-export", exportName: expect.stringContaining("Close") } }),
      ]))
    }
    expect(dialog.exports.find(({ name }) => name === "DialogContent")!.component!.localProps).toEqual([{ name: "showCloseButton", required: false, type: { kind: "boolean" }, default: true, evidenceRefs: ["source"] }])
    expect(sheet.exports.find(({ name }) => name === "SheetContent")!.component!.localProps).toEqual(expect.arrayContaining([{ name: "side", required: false, type: { kind: "enum", values: ["top", "right", "bottom", "left"] }, default: "right", evidenceRefs: ["source"] }]))
    expect(validateComponentFamilyInvariants(dialog, authority())).toEqual([])
    expect(validateComponentFamilyInvariants(sheet, authority())).toEqual([])
  })

  test("rejects render, token, authority, and declaration mutations", () => {
    const dialogContent = family("dialog").exports.find(({ name }) => name === "DialogContent")!.component!
    const renderMutation = structuredClone(tree(dialogContent.rendering))
    renderMutation.portalBoundaries = []
    expect(sourceAnalysis.compareJsxRenderTree(renderMutation, sourceAnalysis.analyzeJsxRenderTree(sourcePath("dialog"), "DialogContent"))).not.toEqual([])

    const tokenMutation = family("select").exports.flatMap(({ component }) => component?.tokenDependencies ?? [])
    const tokenKey = (dependency: typeof tokenMutation[number]) => JSON.stringify({ tokenId: dependency.tokenId, when: dependency.when, viaDerivedRule: dependency.viaDerivedRule })
    const tokenUniqueIndex = tokenMutation.findIndex((dependency, index, all) => all.filter((candidate) => tokenKey(candidate) === tokenKey(dependency)).length === 1)
    expect(tokenUniqueIndex).toBeGreaterThanOrEqual(0)
    expect(compareComponentTokenDependencies(sourcePath("select"), tokenMutation.filter((_, index) => index !== tokenUniqueIndex))).not.toEqual([])

    const dialogInterface = inherited("radix.dialog.root")
    const declarationMutation = structuredClone(dialogInterface)
    declarationMutation.source.declarationSha256 = "0".repeat(64)
    expect(createHash("sha256").update(readFileSync(join(repoRoot, dialogInterface.source.declarationPath))).digest("hex")).not.toBe(declarationMutation.source.declarationSha256)

    const authorityMutation = structuredClone(family("dialog"))
    authorityMutation.exports[0].component!.inherits = ["radix.sheet.root"]
    expect(validateComponentFamilyInvariants(authorityMutation, authority())).not.toEqual([])
  })

  test("resolves Dialog conditional close edges without treating authoring composition as automatic structure", () => {
    const content = family("dialog").exports.find(({ name }) => name === "DialogContent")!.component!
    const trueShape = resolveConditionalApiShape(content, { propName: "showCloseButton", equals: true }, authority())
    const falseShape = resolveConditionalApiShape(content, { propName: "showCloseButton", equals: false }, authority())
    expect(trueShape.props.find(({ name }) => name === "showCloseButton")).toMatchObject({ type: { kind: "boolean" } })
    expect(falseShape.props.find(({ name }) => name === "showCloseButton")).toMatchObject({ type: { kind: "boolean" } })
    expect(content.composition.hardConstraints).toEqual([])
  })

  test("derives a boolean data attribute from a public-prop equality predicate", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(join(repoRoot, "tests/fixtures/component-analysis-completeness-fixture.tsx"), "DerivedAttributeFixture")
    expect(tree.root?.dataAttributes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "data-match", source: "derived-condition", condition: { propName: "mode", equals: "a" } }),
    ]))
    expect(tree.unresolved).toEqual([])
    const unsupported = sourceAnalysis.analyzeJsxRenderTree(join(repoRoot, "tests/fixtures/component-analysis-completeness-fixture.tsx"), "UnsupportedDerivedAttributeFixture")
    expect(unsupported.unresolved).toEqual(expect.arrayContaining([expect.stringContaining("data-match")]))
  })

  test("resolves SelectContent equality-derived data attributes without unresolved evidence", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(sourcePath("select"), "SelectContent")
    expect(tree.unresolved).toEqual([])
    expect(tree.root?.children[0].dataAttributes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "data-align-trigger", source: "derived-condition", condition: { propName: "position", equals: "item-aligned" } }),
    ]))
  })

  test("reconciles Sheet's Dialog alias against the shared Dialog inherited authority", () => {
    const tree = sourceAnalysis.analyzeJsxRenderTree(sourcePath("sheet"), "Sheet")
    const rendering: RenderingFact = {
      rootNodeId: "root",
      publicPropsTargetNodeId: "root",
      nodes: [{
        id: "root",
        host: { kind: "inherited-interface", interfaceId: "radix.dialog.root" },
        receivesPublicProps: true,
        dataAttributes: [{ name: "data-slot", source: "literal", value: "sheet", evidenceRefs: [] }],
        children: [],
        evidenceRefs: [],
      }],
      portalBoundaries: [],
    }
    expect(sourceAnalysis.compareJsxRenderTree(rendering, tree)).toEqual([])
  })

  test("keeps derived-condition identity distinct from literal and direct-prop attributes", () => {
    const source = sourceAnalysis.analyzeJsxRenderTree(join(repoRoot, "tests/fixtures/component-analysis-completeness-fixture.tsx"), "DerivedAttributeFixture")
    const base = { rootNodeId: "root", publicPropsTargetNodeId: "root", nodes: [{ id: "root", host: { kind: "unresolved" }, receivesPublicProps: true, dataAttributes: [], children: [] }], portalBoundaries: [] }
    for (const dataAttribute of [
      { name: "data-match", source: "literal", value: "true" },
      { name: "data-match", source: "prop", prop: "mode" },
    ] as const) {
      expect(sourceAnalysis.compareJsxRenderTree({ ...base, nodes: [{ ...base.nodes[0], dataAttributes: [dataAttribute] }] }, source)).toContain("Data attributes mismatch at Primitive.Root.")
    }
  })

  test.each([
    ["unknown prop", { propName: "missing", equals: "a" }, "references unknown prop: missing"],
    ["incompatible literal", { propName: "variant", equals: "missing" }, "incompatible literal for prop variant: missing"],
  ])("rejects a derived condition with %s", (_label, condition, message) => {
    const candidate = structuredClone(family("tabs"))
    const list = candidate.exports.find(({ name }) => name === "TabsList")!.component!
    tree(list.rendering).nodes[0].dataAttributes.push({ name: "data-derived", source: "derived-condition", condition, evidenceRefs: ["source"] })
    expect(validateComponentFamilyInvariants(candidate, authority()).some((error) => error.includes(message))).toBe(true)
  })
})
