import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { reconcileCanonicalComponentSources } from "../src/contracts/components/canonical-source-reconciliation"
import { analyzeJsxRenderTree, compareJsxRenderTree } from "../src/contracts/components/render-source-analysis"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import type { ComponentContractSet, ComponentFamilyContract, RenderingTree } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(root, "src/components/ui/toggle-group.tsx")
const family = JSON.parse(readFileSync(join(root, "contracts/components/families/toggle-group.json"), "utf8")) as ComponentFamilyContract
const manifest = JSON.parse(readFileSync(join(root, "contracts/components/component-contract-set.json"), "utf8")) as ComponentContractSet
const rootSource = analyzeJsxRenderTree(sourcePath, "ToggleGroup", canonicalRenderSourceAnalysisConventions)
const itemSource = analyzeJsxRenderTree(sourcePath, "ToggleGroupItem", canonicalRenderSourceAnalysisConventions)

function component(name: "ToggleGroup" | "ToggleGroupItem") {
  const found = family.exports.find((entry) => entry.name === name)?.component
  if (!found) throw new Error(`Missing ${name}`)
  return found
}
function rendering(name: "ToggleGroup" | "ToggleGroupItem") {
  return structuredClone(component(name).rendering) as RenderingTree
}
function attribute(tree: RenderingTree, name: string) {
  const result = tree.nodes[0].dataAttributes.find((entry) => entry.name === name)
  if (!result || result.source !== "ordered-writes") throw new Error(`Missing ordered ${name}`)
  return result
}
function sourceErrors(mutated: ComponentFamilyContract) {
  return reconcileCanonicalComponentSources(root, { contractSet: manifest, families: [mutated], interfaces: [] })
}

describe("Release 005 Toggle Group context provenance mutations", () => {
  test("baseline source and contract agree on provider, item lookup, and all ordered writes", () => {
    expect(rootSource.unresolved).toEqual([])
    expect(itemSource.unresolved).toEqual([])
    expect(compareJsxRenderTree(component("ToggleGroup").rendering, rootSource, canonicalRenderSourceAnalysisConventions)).toEqual([])
    expect(compareJsxRenderTree(component("ToggleGroupItem").rendering, itemSource, canonicalRenderSourceAnalysisConventions)).toEqual([])
    expect(sourceErrors(family).filter((error) => error.includes("context provenance"))).toEqual([])
  }, 30_000)

  test("rejects changed provider identity and standalone context defaults", () => {
    const wrongProvider = structuredClone(family)
    wrongProvider.exports.find((entry) => entry.name === "ToggleGroupItem")!.component!.context![0].providerExportName = "OtherProvider"
    expect(sourceErrors(wrongProvider)).toContain("Component ToggleGroupItem context provenance does not match source evidence.")

    const wrongDefault = structuredClone(family)
    wrongDefault.exports.find((entry) => entry.name === "ToggleGroupItem")!.component!.context![0].defaultFields[0].value = "sm"
    expect(sourceErrors(wrongDefault)).toContain("Component ToggleGroupItem context provenance does not match source evidence.")
  }, 45_000)

  test("rejects item-first, wrong field, wrong fallback, and truthy-shaped contract claims", () => {
    const itemFirst = rendering("ToggleGroupItem")
    const variant = attribute(itemFirst, "data-variant")
    if (variant.writes[0].kind !== "value" || variant.writes[0].value.source !== "nullish-coalesce") throw new Error("Missing nullish context lookup")
    ;[variant.writes[0].value.first, variant.writes[0].value.fallback] = [variant.writes[0].value.fallback, variant.writes[0].value.first]
    expect(compareJsxRenderTree(itemFirst, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const wrongField = rendering("ToggleGroupItem")
    const spacing = attribute(wrongField, "data-spacing")
    if (spacing.writes[0].kind !== "value" || spacing.writes[0].value.source !== "context-field") throw new Error("Missing context spacing")
    spacing.writes[0].value.field = "size"
    expect(compareJsxRenderTree(wrongField, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const wrongFallback = rendering("ToggleGroupItem")
    const size = attribute(wrongFallback, "data-size")
    if (size.writes[0].kind !== "value" || size.writes[0].value.source !== "nullish-coalesce") throw new Error("Missing nullish size")
    size.writes[0].value.fallback = { source: "literal", value: "sm" }
    expect(compareJsxRenderTree(wrongFallback, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const alwaysProvider = rendering("ToggleGroupItem")
    const alwaysVariant = attribute(alwaysProvider, "data-variant")
    if (alwaysVariant.writes[0].kind !== "value") throw new Error("Missing variant write")
    alwaysVariant.writes[0].value = { source: "context-field", contextId: "ToggleGroupContext", field: "variant" }
    expect(compareJsxRenderTree(alwaysProvider, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })

  test("rejects removed or reordered forwarded writes and wrong final attribute", () => {
    const noForward = rendering("ToggleGroupItem")
    attribute(noForward, "data-variant").writes.pop()
    expect(compareJsxRenderTree(noForward, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const reversed = rendering("ToggleGroupItem")
    attribute(reversed, "data-size").writes.reverse()
    expect(compareJsxRenderTree(reversed, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const extraEarlier = rendering("ToggleGroupItem")
    attribute(extraEarlier, "data-spacing").writes.unshift({ kind: "public-props-spread" })
    expect(compareJsxRenderTree(extraEarlier, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const wrongName = rendering("ToggleGroupItem")
    attribute(wrongName, "data-spacing").name = "data-density"
    expect(compareJsxRenderTree(wrongName, itemSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const groupNoForward = rendering("ToggleGroup")
    attribute(groupNoForward, "data-variant").writes.pop()
    expect(compareJsxRenderTree(groupNoForward, rootSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })
})
