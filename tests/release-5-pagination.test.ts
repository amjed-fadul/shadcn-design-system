import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import contractSet from "../contracts/components/component-contract-set.json"
import pagination from "../contracts/components/families/pagination.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import type { ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"
import { analyzeJsxRenderTree, compareJsxRenderTree } from "./helpers/component-source-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(root, "src/components/ui/pagination.tsx")
const wrongExportSourcePath = join(root, "tests/fixtures/pagination-cross-family-wrong-export.tsx")
const wrongModuleSourcePath = join(root, "tests/fixtures/pagination-cross-family-wrong-module.tsx")

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

const family = pagination as ComponentFamilyContract
const link = family.exports.find((entry) => entry.name === "PaginationLink")!.component!

describe("release.5 Pagination", () => {
  test("models PaginationLink's imported Button as an authoritative cross-family render host", () => {
    const source = analyzeJsxRenderTree(sourcePath, "PaginationLink")
    const rendering = link.rendering
    const rootNode = "nodes" in rendering
      ? rendering.nodes.find((node) => node.id === rendering.rootNodeId)
      : undefined

    expect(source.root).toMatchObject({ tag: "Button", kind: "component" })
    expect(rootNode?.host).toEqual({ kind: "cross-family-export", familyId: "button", exportName: "Button" })
    expect(compareJsxRenderTree(link.rendering, source)).toEqual([])
    const relabeled = structuredClone(link.rendering)
    if (!("nodes" in relabeled)) throw new Error("Expected PaginationLink to have one rendering tree")
    relabeled.nodes.find((node) => node.id === relabeled.rootNodeId)!.host = { kind: "cross-family-export", familyId: "avatar", exportName: "Button" }
    expect(compareJsxRenderTree(relabeled, source)).not.toEqual([])

    const interfaces = contractSet.interfaceFiles.map((path) => loadJson<InheritedInterfaceContract>(join(root, path)))
    const componentExportIds = new Set<string>()
    for (const path of contractSet.familyFiles) {
      const candidate = loadJson<ComponentFamilyContract>(join(root, path))
      for (const entry of candidate.exports) if (entry.kind === "component" && entry.authorableJsx) componentExportIds.add(`${candidate.id}.${entry.name}`)
    }
    expect(validateComponentFamilyInvariants(family, {
      interfaceIds: new Set(interfaces.map((entry) => entry.id)),
      interfacePropNames: new Map(interfaces.map((entry) => [entry.id, new Set(entry.props.map((prop) => prop.name))])),
      interfaceContracts: new Map(interfaces.map((entry) => [entry.id, entry])),
      tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
      derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
      capabilityIds: new Set<string>(),
      componentExportIds,
    })).toEqual([])
  })

  test.each([
    ["an aliased wrong export", wrongExportSourcePath, { importedName: "Avatar", localName: "Button", moduleSpecifier: "@/components/ui/button" }],
    ["a same-basename wrong module", wrongModuleSourcePath, { importedName: "Button", localName: "Button", moduleSpecifier: "@/other/button" }],
  ])("rejects %s as evidence for button.Button", (_case, adversarialSourcePath, expectedBinding) => {
    const source = analyzeJsxRenderTree(adversarialSourcePath, "PaginationLink")
    expect(source.root?.importBinding).toEqual(expectedBinding)
    expect(compareJsxRenderTree(link.rendering, source)).not.toEqual([])
  })
})
