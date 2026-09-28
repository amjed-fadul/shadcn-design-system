import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import field from "../contracts/components/families/field.json"
import slider from "../contracts/components/families/slider.json"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import { analyzeRenderFlowSource, compareRenderFlowSource } from "../src/contracts/components/render-flow-source-analysis"
import type { RenderingFlow } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))

function flow(family: typeof field | typeof slider, exportName: string): RenderingFlow {
  const entry = family.exports.find((candidate) => candidate.name === exportName)
  if (!entry?.component?.renderingFlow) throw new Error(`Missing ${exportName} rendering flow`)
  return structuredClone(entry.component.renderingFlow) as RenderingFlow
}

function source(familyId: string, exportName: string) {
  const analyzed = analyzeRenderFlowSource(`${root}src/components/ui/${familyId}.tsx`, exportName, canonicalRenderSourceAnalysisConventions)
  expect(analyzed.errors).toEqual([])
  return analyzed
}

function repeatedEdge(contract: RenderingFlow) {
  const outcome = contract.branches.at(-1)?.outcome
  if (outcome?.kind !== "rendered") throw new Error("Missing rendered fallback")
  const edge = outcome.tree.nodes.flatMap((node) => node.children).find((child) => child.repeat)
  if (!edge) throw new Error("Missing repeated edge")
  return edge
}

describe("Release 005 Patch B source mutations", () => {
  const fieldSource = source("field", "FieldError")
  const sliderSource = source("slider", "Slider")

  test("accepts the complete source backed flows", () => {
    expect(compareRenderFlowSource(flow(field, "FieldError"), fieldSource, canonicalRenderSourceAnalysisConventions)).toEqual([])
    expect(compareRenderFlowSource(flow(slider, "Slider"), sliderSource, canonicalRenderSourceAnalysisConventions)).toEqual([])
  })

  test("rejects a removed FieldError absent branch or changed precedence", () => {
    const missing = flow(field, "FieldError")
    missing.branches.splice(1, 1)
    expect(compareRenderFlowSource(missing, fieldSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const swapped = flow(field, "FieldError")
    ;[swapped.branches[0], swapped.branches[1]] = [swapped.branches[1], swapped.branches[0]]
    expect(compareRenderFlowSource(swapped, fieldSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })

  test("rejects lost FieldError deduplication or item filtering", () => {
    const noDedup = flow(field, "FieldError")
    delete noDedup.collections[0].uniqueBy
    expect(compareRenderFlowSource(noDedup, fieldSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const noFilter = flow(field, "FieldError")
    delete repeatedEdge(noFilter).repeat!.itemWhen
    expect(compareRenderFlowSource(noFilter, fieldSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })

  test("rejects a fixed Slider child and changed collection precedence", () => {
    const fixed = flow(slider, "Slider")
    delete repeatedEdge(fixed).repeat
    expect(compareRenderFlowSource(fixed, sliderSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const precedence = flow(slider, "Slider")
    ;[precedence.collections[0].choices[0], precedence.collections[0].choices[1]] = [precedence.collections[0].choices[1], precedence.collections[0].choices[0]]
    expect(compareRenderFlowSource(precedence, sliderSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })

  test("rejects wrong Slider repetition count or wrong child edge", () => {
    const cardinality = flow(slider, "Slider")
    repeatedEdge(cardinality).repeat!.count = "matching-items"
    expect(compareRenderFlowSource(cardinality, sliderSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])

    const wrongNode = flow(slider, "Slider")
    const outcome = wrongNode.branches[0].outcome
    if (outcome.kind !== "rendered") throw new Error("Missing rendered Slider branch")
    const root = outcome.tree.nodes.find((node) => node.id === "root")!
    const track = root.children.find((child) => child.nodeId === "track")!
    const thumb = root.children.find((child) => child.nodeId === "thumb")!
    track.repeat = thumb.repeat
    delete thumb.repeat
    expect(compareRenderFlowSource(wrongNode, sliderSource, canonicalRenderSourceAnalysisConventions)).not.toEqual([])
  })
})
