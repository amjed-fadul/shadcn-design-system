import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import ts from "typescript"

import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { canonicalComponentPropSourceAnalyzer } from "../src/contracts/components/canonical-component-prop-source-analysis"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import { reconcileCanonicalComponentSources } from "../src/contracts/components/canonical-source-reconciliation"
import { analyzeRenderFlowSource, compareRenderFlowSource } from "../src/contracts/components/render-flow-source-analysis"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract, LocalPropContract, RenderingFlow } from "../src/contracts/components/types"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract } from "../src/validator/projection"

const root = fileURLToPath(new URL("../", import.meta.url))
const contracts = loadComponentContracts()
const slider = contracts.families.find((family) => family.id === "slider")!
const sliderEntry = slider.exports.find((entry) => entry.name === "Slider")!
const propAnalyzer = canonicalComponentPropSourceAnalyzer(root)
const interfaces = structuredClone(contracts.interfaces) as unknown as InheritedInterfaceContract[]
const contractSet = structuredClone(contracts.contractSet) as unknown as ComponentContractSet

function sourceErrors(family: ComponentFamilyContract) {
  return reconcileCanonicalComponentSources(root, {
    contractSet,
    families: [family],
    interfaces,
  })
}

describe("Release 005 Slider thumb naming contract", { timeout: 60000 }, () => {
  test("reconciles the public arrays and preserves producer cardinality", () => {
    const analysis = propAnalyzer.analyzeComponentPropSource(join(root, "src/components/ui/slider.tsx"), "Slider")
    expect(analysis.unresolved).toEqual([])
    expect(propAnalyzer.compareComponentLocalProps([...sliderEntry.component!.localProps] as LocalPropContract[], analysis)).toEqual([])
    expect(sliderEntry.authorableJsx).toBe(true)
    expect(sliderEntry.component!.renderingFlow!.collections[0].choices.map((choice) => choice.source)).toEqual([
      { kind: "prop", propName: "value" },
      { kind: "prop", propName: "defaultValue" },
      { kind: "singleton-prop", propName: "min" },
    ])
    expect(sliderEntry.component!.renderingFlow!.branches[0].outcome.kind).toBe("rendered")
    expect(sliderEntry.component!.accessibility.find((fact) => fact.feature === "accessible name")?.mechanism).toContain("each array index names that Thumb")
    const projection = projectExecutableContract({ componentContracts: contracts, tokenContract: getTokenContract() })
    const projected = projection.exports["slider\u0000Slider"]!.component!
    expect(projected.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "thumbAriaLabels", required: false, type: { kind: "typescript", typeText: "string[]" }, origin: "local" }),
      expect.objectContaining({ name: "thumbAriaLabelledBy", required: false, type: { kind: "typescript", typeText: "string[]" }, origin: "local" }),
    ]))
    expect("renderingFlow" in projected).toBe(false)
  })

  test("rejects removed or mistyped naming props and changed per-index accessibility facts", () => {
    const removed = structuredClone(slider) as unknown as ComponentFamilyContract
    removed.exports.find((entry) => entry.name === "Slider")!.component!.localProps = []
    expect(sourceErrors(removed)).toContain("Component Slider local prop surface does not match source evidence.")

    const mistyped = structuredClone(slider) as unknown as ComponentFamilyContract
    mistyped.exports.find((entry) => entry.name === "Slider")!.component!.localProps.find((prop) => prop.name === "thumbAriaLabels")!.type = { kind: "number" }
    expect(sourceErrors(mistyped)).toContain("Component Slider local prop surface does not match source evidence.")

  })

  test("source shape keeps indexed naming on Thumb, with mutations caught for index drift, root forwarding, and omission", () => {
    const sourcePath = join(root, "src/components/ui/slider.tsx")
    const sourceText = readFileSync(sourcePath, "utf8")
    const hasThumbIndexedNames = (text: string) => {
      const file = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      let thumbSpread = ""
      let rootHasNamingSpread = false
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(file)
          const spreads = node.attributes.properties.filter(ts.isJsxSpreadAttribute).map((attribute) => attribute.expression.getText(file))
          if (tag === "SliderPrimitive.Thumb") thumbSpread = spreads.find((spread) => spread.includes("thumbAriaLabels") || spread.includes("thumbAriaLabelledBy")) ?? ""
          if (tag === "SliderPrimitive.Root") rootHasNamingSpread = spreads.some((spread) => spread.includes("thumbAriaLabels") || spread.includes("thumbAriaLabelledBy"))
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
      return !rootHasNamingSpread && thumbSpread.includes('"aria-label": thumbAriaLabels[index]') && thumbSpread.includes('"aria-labelledby": thumbAriaLabelledBy[index]')
    }

    expect(hasThumbIndexedNames(sourceText)).toBe(true)
    expect(hasThumbIndexedNames(sourceText.replace("thumbAriaLabels[index]", "thumbAriaLabels[0]"))).toBe(false)
    expect(hasThumbIndexedNames(sourceText.replace("thumbAriaLabelledBy[index]", "thumbAriaLabelledBy[0]"))).toBe(false)
    const removedForwarding = sourceText.replace(/\s*\{\.\.\.\(thumbAriaLabels !== undefined[\s\S]*?\)\}/, "")
    expect(hasThumbIndexedNames(removedForwarding)).toBe(false)
    const rootOnlyForwarding = sourceText.replace(/\s*\{\.\.\.\(thumbAriaLabels !== undefined[\s\S]*?\)\}/, "").replace("<SliderPrimitive.Root", '<SliderPrimitive.Root {...(thumbAriaLabels !== undefined ? { "aria-label": thumbAriaLabels[index] } : {})}')
    expect(hasThumbIndexedNames(rootOnlyForwarding)).toBe(false)
  })

  test("source reconciliation rejects naming validation behavior drift", () => {
    const source = readFileSync(join(root, "src/components/ui/slider.tsx"), "utf8")
    const directory = mkdtempSync(join(tmpdir(), "slider-validation-mutations-"))
    const path = join(directory, "slider.tsx")
    const flow = structuredClone(sliderEntry.component!.renderingFlow!) as RenderingFlow
    try {
      writeFileSync(path, source)
      expect(compareRenderFlowSource(flow, analyzeRenderFlowSource(path, "Slider", canonicalRenderSourceAnalysisConventions), canonicalRenderSourceAnalysisConventions)).toEqual([])
      const mutations = [
        ["labels !== undefined && labelledBy !== undefined", "labels !== undefined && labelledBy === undefined"],
        ["labels.length !== values.length", "labels.length > values.length"],
        ["labelledBy.length !== values.length", "labelledBy.length > values.length"],
        ["labels.some((label) => label.trim().length === 0)", "labels.some((label) => label.length === 0)"],
        ["labelledBy.some((id) => id.trim().length === 0)", "labelledBy.every((id) => id.trim().length === 0)"],
      ] as const
      for (const [original, changed] of mutations) {
        expect(source).toContain(original)
        writeFileSync(path, source.replace(original, changed))
        const analysis = analyzeRenderFlowSource(path, "Slider", canonicalRenderSourceAnalysisConventions)
        expect(compareRenderFlowSource(flow, analysis, canonicalRenderSourceAnalysisConventions), changed).not.toEqual([])
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
