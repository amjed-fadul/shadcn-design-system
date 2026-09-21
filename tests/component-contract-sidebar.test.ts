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

  test("preserves provider state, factual context capabilities, and proven Slots without hard-coding an anatomy", () => {
    const contract = family()
    const provider = contract.exports.find(({ name }) => name === "SidebarProvider")!.component!
    expect(provider.localProps).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "defaultOpen", default: true, type: { kind: "boolean" } }),
      expect.objectContaining({ name: "open", type: { kind: "boolean" } }),
      expect.objectContaining({ name: "onOpenChange" }),
    ]))
    expect(provider.localProps.map(({ name }) => name)).not.toContain("openMobile")
    expect(provider.stateChannels).toEqual([expect.objectContaining({ name: "open", controlledProp: "open", defaultProp: "defaultOpen", changeEventProp: "onOpenChange" })])
    expect(provider.composition.provides).toEqual(["sidebar.context"])
    expect(contract.exports.find(({ name }) => name === "Sidebar")!.component!.composition.requires).toEqual(["sidebar.context"])
    expect(contract.exports.find(({ name }) => name === "SidebarTrigger")!.component!.composition.requires).toEqual(["sidebar.context"])
    expect(contract.exports.find(({ name }) => name === "SidebarMenuButton")!.component!.composition.requires).toEqual(["sidebar.context"])
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
