import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import type { ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependenciesForExport, analyzeComponentTokenSource, auditComponentTokenCoverage, compareComponentTokenDependenciesForExport } from "./helpers/component-token-analysis"
import { analyzeIntrinsicReactInterface } from "./helpers/typescript-interface-analysis"
import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const source = join(repoRoot, "src/components/ui/sidebar.tsx")
const intrinsicInterfaces = ["html.a", "html.li", "html.main", "html.ul"] as const

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function family() {
  return loadJson<ComponentFamilyContract>(join(repoRoot, "contracts/components/families/sidebar.json"))
}

function inherited(id: string) {
  return loadJson<InheritedInterfaceContract>(join(repoRoot, `contracts/components/interfaces/${id}.json`))
}

function authority() {
  const contracts = contractSet.interfaceFiles.map((file) => inherited(file.replace("contracts/components/interfaces/", "").replace(".json", "")))
  return {
    interfaceIds: new Set(contracts.map(({ id }) => id)),
    interfacePropNames: new Map(contracts.map((item) => [item.id, new Set(item.props.map(({ name }) => name))])),
    interfaceContracts: new Map(contracts.map((item) => [item.id, item])),
    tokenIds: new Set(tokenContract.tokens.map(({ id }) => id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map(({ id }) => id)),
    capabilityIds: new Set(["sidebar.context"]),
  }
}

describe("Sidebar component family contract", () => {
  test("preserves Sidebar within the independently approved family scope", () => {
    expect(contractSet.familyCount).toBe(canonicalFamilyIds.length)
    expect(contractSet.familyFiles).toHaveLength(canonicalFamilyIds.length)
    expect(contractSet.familyFiles).toContain("contracts/components/families/sidebar.json")
  })

  test("reconciles all 24 public exports and keeps useSidebar non-JSX", () => {
    const contract = family()
    const sourceExports = sourceAnalysis.listModuleExports(source)
    expect(sourceExports).toHaveLength(24)
    expect(contract.exports.map(({ name, kind, authorableJsx }) => [name, kind, authorableJsx]).sort()).toEqual(sourceExports.map(({ name }) => [name, name === "useSidebar" ? "hook" : "component", name !== "useSidebar"]).sort())
    expect(contract.source.canonicalBlobSha).toBe(sourceAnalysis.readCanonicalSourceBlobSha(source))
  })

  test.each(intrinsicInterfaces)("pins %s to the React declaration and exact intrinsic props", (id) => {
    const contract = inherited(id)
    const tag = id.slice("html.".length) as keyof React.JSX.IntrinsicElements
    expect(contract.source.kind).toBe("react-intrinsic")
    expect(existsSync(join(repoRoot, contract.source.declarationPath))).toBe(true)
    expect(createHash("sha256").update(readFileSync(join(repoRoot, contract.source.declarationPath))).digest("hex")).toBe(contract.source.declarationSha256)
    expect(contract.props.map(({ name, required, typeText }) => ({ name, required, typeText }))).toEqual(analyzeIntrinsicReactInterface(tag))
    expect(validateInheritedInterfaceInvariants(contract)).toEqual([])
  })

  test("records the explicit provider inputs and both controlled or uncontrolled state channels", () => {
    const contract = family()
    const provider = contract.exports.find(({ name }) => name === "SidebarProvider")!.component!
    expect(provider.localProps).toEqual(expect.arrayContaining([
      { name: "isMobile", required: false, type: { kind: "boolean" }, default: false, evidenceRefs: ["source", "declaration"] },
      { name: "defaultOpen", required: false, type: { kind: "boolean" }, default: true, evidenceRefs: ["source", "declaration"] },
      { name: "open", required: false, type: { kind: "boolean" }, evidenceRefs: ["source", "declaration"] },
      { name: "onOpenChange", required: false, type: { kind: "typescript", typeText: "(open: boolean) => void" }, evidenceRefs: ["source", "declaration"] },
      { name: "defaultOpenMobile", required: false, type: { kind: "boolean" }, default: false, evidenceRefs: ["source", "declaration"] },
      { name: "openMobile", required: false, type: { kind: "boolean" }, evidenceRefs: ["source", "declaration"] },
      { name: "onOpenMobileChange", required: false, type: { kind: "typescript", typeText: "(open: boolean) => void" }, evidenceRefs: ["source", "declaration"] },
    ]))
    expect(provider.stateChannels).toEqual([
      { name: "open", controlledProp: "open", defaultProp: "defaultOpen", changeEventProp: "onOpenChange", evidenceRefs: ["source", "declaration", "runtime"] },
      { name: "openMobile", controlledProp: "openMobile", defaultProp: "defaultOpenMobile", changeEventProp: "onOpenMobileChange", evidenceRefs: ["source", "declaration", "runtime"] },
    ])
    expect(provider.events).toEqual([
      { propName: "onOpenChange", payload: { kind: "boolean" }, evidenceRefs: ["source", "declaration", "runtime"] },
      { propName: "onOpenMobileChange", payload: { kind: "boolean" }, evidenceRefs: ["source", "declaration", "runtime"] },
    ])
  })

  test("records explicit Sidebar branches, effective state, and portal containment", () => {
    const contract = family()
    const sidebar = contract.exports.find(({ name }) => name === "Sidebar")!.component!
    expect(sidebar.localProps).toContainEqual({
      name: "portalContainer",
      required: false,
      type: { kind: "typescript", typeText: 'ComponentProps<typeof SheetContent>["portalContainer"]' },
      evidenceRefs: ["source", "declaration"],
    })
    expect(sidebar.rendering).toMatchObject({ alternatives: [
      { when: { propName: "collapsible", equals: "none" } },
      { when: { source: "state", name: "isMobile", truthiness: "truthy" } },
      { otherwise: true },
    ] })
    const alternatives = "alternatives" in sidebar.rendering ? sidebar.rendering.alternatives : []
    const noneRoot = alternatives[0].rendering.nodes.find(({ id }) => id === "plain")!
    const mobileContent = alternatives[1].rendering.nodes.find(({ id }) => id === "sheet-content")!
    const desktopRoot = alternatives[2].rendering.nodes.find(({ id }) => id === "desktop")!
    expect(noneRoot.dataAttributes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "data-state", source: "primitive-state", prop: "effectiveState", evidenceRefs: ["source"] }),
      expect.objectContaining({ name: "data-collapsible", source: "literal", value: "", evidenceRefs: ["source"] }),
    ]))
    expect(mobileContent.dataAttributes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "data-state", source: "conditional-value", condition: { source: "state", name: "openMobile", truthiness: "truthy" }, whenTrue: { source: "literal", value: "expanded" }, whenFalse: { source: "literal", value: "collapsed" }, evidenceRefs: ["source"] }),
      expect.objectContaining({ name: "data-mobile", source: "literal", value: "true", evidenceRefs: ["source"] }),
    ]))
    expect(desktopRoot.dataAttributes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "data-state", source: "primitive-state", prop: "effectiveState", evidenceRefs: ["source"] }),
    ]))
    expect(alternatives[1].rendering.portalBoundaries).toEqual([])
  })

  test("preserves factual context capabilities and proven Slots without ambient browser policy", () => {
    const contract = family()
    const provider = contract.exports.find(({ name }) => name === "SidebarProvider")!.component!
    expect(provider.composition.provides).toEqual(["sidebar.context"])
    const contextualExports = ["Sidebar", "SidebarTrigger", "SidebarRail", "SidebarMenuButton"]
    for (const name of contextualExports) {
      expect(contract.exports.find((entry) => entry.name === name)!.component!.composition.requires).toEqual(["sidebar.context"])
    }
    expect(contract.evidence).toHaveProperty("declaration")
    expect(JSON.stringify(contract.evidence)).not.toMatch(/cookie|shortcut|matchMedia|use-mobile|browser viewport/i)
    for (const name of ["SidebarGroupLabel", "SidebarGroupAction", "SidebarMenuButton", "SidebarMenuAction", "SidebarMenuSubButton"]) {
      expect(contract.exports.find((entry) => entry.name === name)!.component!.slots).toHaveLength(1)
    }
    expect(contract.exports.filter(({ component }) => component?.slots.length).map(({ name }) => name).sort()).toEqual(["SidebarGroupAction", "SidebarGroupLabel", "SidebarMenuAction", "SidebarMenuButton", "SidebarMenuSubButton"])
  })

  test("reconciles source render alternatives and approved Sidebar token facts with no unresolved evidence", () => {
    const contract = family()
    const sidebar = contract.exports.find(({ name }) => name === "Sidebar")!.component!
    const menuButton = contract.exports.find(({ name }) => name === "SidebarMenuButton")!.component!
    expect(sidebar.rendering).toHaveProperty("alternatives")
    expect(menuButton.rendering).toHaveProperty("alternatives")
    expect(contract.unresolved).toEqual([])
    expect(contract.exports.flatMap((entry) => entry.component ? sourceAnalysis.analyzeJsxRenderTree(source, entry.name).unresolved : [])).toEqual([])
    expect(contract.exports.flatMap((entry) => entry.component ? sourceAnalysis.compareJsxRenderTree(entry.component.rendering, sourceAnalysis.analyzeJsxRenderTree(source, entry.name)) : [])).toEqual([])
    expect(analyzeComponentTokenSource(source).unresolved).toEqual([])
    for (const entry of contract.exports) {
      if (!entry.component) continue
      expect(compareComponentTokenDependenciesForExport(source, entry.name, entry.component.tokenDependencies)).toEqual([])
    }
    expect(auditComponentTokenCoverage(source).filter(({ classification }) => classification === "suspicious-contracted-namespace")).toEqual([])
    expect(auditComponentTokenCoverage(source)).toContainEqual({ utility: "shadow-none", classification: "recognized-no-approved-token", namespace: "shadow" })
    const sidebarTokens = new Set(contract.exports.flatMap(({ component }) => component?.tokenDependencies ?? []).map(({ tokenId }) => tokenId).filter((id) => id.startsWith("color.sidebar")))
    expect(sidebarTokens).toEqual(new Set(["color.sidebar", "color.sidebar-foreground", "color.sidebar-accent", "color.sidebar-accent-foreground", "color.sidebar-border"]))
    expect(validateComponentFamilyInvariants(contract, authority())).toEqual([])
  })

  test("detects missing and invented token dependencies within one Sidebar export", () => {
    const contract = family()
    const inset = contract.exports.find(({ name }) => name === "SidebarInset")!.component!
    const expected = analyzeComponentTokenDependenciesForExport(source, "SidebarInset")
    expect(expected).not.toEqual([])
    expect(compareComponentTokenDependenciesForExport(source, "SidebarInset", inset.tokenDependencies.slice(1))).not.toEqual([])
    expect(compareComponentTokenDependenciesForExport(source, "SidebarInset", [...inset.tokenDependencies, { tokenId: "color.primary", evidenceRefs: ["source"] }])).not.toEqual([])
  })

})
