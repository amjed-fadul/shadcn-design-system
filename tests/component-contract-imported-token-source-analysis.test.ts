import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { analyzeComponentTokenDependenciesForExport, analyzeComponentTokenSourceForExport, compareComponentTokenDependenciesForExport } from "../src/contracts/components/canonical-token-source-analysis"
import { createTokenSourceAnalyzer } from "../src/contracts/components/token-source-analysis"

const root = process.cwd()
const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
const providerPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
const wrongConsumerPath = join(root, "tests/fixtures/imported-cva-wrong-consumer.tsx")
const toggleGroupPath = join(root, "src/components/ui/toggle-group.tsx")
const togglePath = join(root, "src/components/ui/toggle.tsx")

function fixtureAnalyzer() {
  return createTokenSourceAnalyzer({
    classMergeFunctionNames: ["cn"],
    recipeFunctionNames: ["cva"],
    readSource: (sourcePath) => readFileSync(sourcePath, "utf8"),
    resolveImportedRecipe: ({ moduleSpecifier, importedName }) => moduleSpecifier === "./imported-cva-recipe"
      ? { sourcePath: providerPath, exportName: importedName }
      : undefined,
    resolveUtility: (utility) => ({
      "rounded-lg": { tokenId: "radius.lg" },
      "rounded-md": { tokenId: "radius.md" },
      "text-sm": { tokenId: "font-size.sm" },
      "bg-background": { tokenId: "color.background" },
      "bg-destructive": { tokenId: "color.destructive" },
      "h-0": { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 } },
      "h-2.5": { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 } },
      "shadow-sm": { tokenId: "shadow.sm" },
      "shadow-md": { tokenId: "shadow.md" },
    } as const)[utility],
  })
}

describe("imported CVA token source analysis", () => {
  test("resolves a statically aliased pinned recipe with exact variants, conditions, and source provenance", () => {
    const analysis = fixtureAnalyzer().analyzeComponentTokenSourceForExport(consumerPath, "ImportedDynamicFixture")

    expect(analysis.unresolved).toEqual([])
    expect(analysis.resolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ classNames: "rounded-lg text-sm", source: expect.objectContaining({ sourcePath: providerPath, sourceText: '"rounded-lg text-sm"' }) }),
      expect.objectContaining({ classNames: "bg-background", propName: "tone", equals: "default", source: expect.objectContaining({ sourcePath: providerPath }) }),
      expect.objectContaining({ classNames: "bg-destructive", propName: "tone", equals: "danger", source: expect.objectContaining({ sourcePath: providerPath }) }),
      expect.objectContaining({ classNames: "h-0", propName: "size", equals: "default", source: expect.objectContaining({ sourcePath: providerPath }) }),
      expect.objectContaining({ classNames: "h-2.5", propName: "size", equals: "sm", source: expect.objectContaining({ sourcePath: providerPath }) }),
    ]))
  })

  test("applies recipe defaults and literal call arguments without inventing inactive variant conditions", () => {
    const analyzer = fixtureAnalyzer()
    const defaults = analyzer.analyzeComponentTokenDependenciesForExport(consumerPath, "ImportedDefaultsFixture")

    expect(defaults).toEqual(expect.arrayContaining([
      { tokenId: "radius.lg", evidenceRefs: ["source"] },
      { tokenId: "font-size.sm", evidenceRefs: ["source"] },
      { tokenId: "color.background", evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 }, evidenceRefs: ["source"] },
    ]))
    expect(defaults).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenId: "color.destructive" }),
      expect.objectContaining({ viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 } }),
    ]))
    expect(analyzer.analyzeComponentTokenDependenciesForExport(consumerPath, "ImportedStaticFixture")).toEqual(expect.arrayContaining([
      { tokenId: "color.destructive", evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 }, evidenceRefs: ["source"] },
    ]))
    expect(analyzer.compareComponentTokenDependenciesForExport(consumerPath, "ImportedDefaultsFixture", defaults.filter((dependency) => dependency.tokenId !== "color.background"))).toContainEqual(expect.stringContaining("Missing source token dependency"))
  })

  test("fails closed for wrong import source or export and dynamic or computed recipe authority", () => {
    const analyzer = fixtureAnalyzer()
    for (const [sourcePath, exportName, reason] of [
      [wrongConsumerPath, "WrongSourceFixture", "Imported recipe source is not approved."],
      [wrongConsumerPath, "WrongExportFixture", "Imported recipe export is not a static CVA recipe."],
      [consumerPath, "ImportedDynamicConfigFixture", "Unsupported dynamic recipe configuration."],
      [consumerPath, "ImportedComputedConfigFixture", "Unsupported recipe variant property."],
      [consumerPath, "AmbiguousInvocationFixture", "Unsupported recipe invocation property."],
      [consumerPath, "AmbiguousDataFlowFixture", "Unsupported dynamic recipe invocation."],
      [consumerPath, "DynamicImportFixture", "Unsupported dynamic class expression."],
    ] as const) {
      const analysis = analyzer.analyzeComponentTokenSourceForExport(sourcePath, exportName)
      expect(analysis.unresolved.map((finding) => finding.reason), exportName).toContain(reason)
    }
  })

  test("resolves the canonical toggle recipe only through its pinned module and export identity", () => {
    const analysis = analyzeComponentTokenSourceForExport(toggleGroupPath, "ToggleGroupItem")
    const dependencies = analyzeComponentTokenDependenciesForExport(toggleGroupPath, "ToggleGroupItem")

    expect(analysis.unresolved).toEqual([])
    expect(analysis.resolved).toContainEqual(expect.objectContaining({
      classNames: expect.stringContaining("group/toggle"),
      source: expect.objectContaining({ sourcePath: togglePath }),
    }))
    expect(dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenId: "color.input", when: { propName: "variant", equals: "outline" } }),
      expect.objectContaining({ tokenId: "radius.md", when: { propName: "size", equals: "sm" } }),
    ]))

    const conditionDrift = structuredClone(dependencies)
    conditionDrift.find((dependency) => dependency.tokenId === "color.input" && dependency.when?.equals === "outline")!.when!.equals = "default"
    expect(compareComponentTokenDependenciesForExport(toggleGroupPath, "ToggleGroupItem", conditionDrift)).not.toEqual([])

    const derivationDrift = structuredClone(dependencies)
    derivationDrift.find((dependency) => dependency.viaDerivedRule?.multiplier === 7)!.viaDerivedRule!.multiplier = 8
    expect(compareComponentTokenDependenciesForExport(toggleGroupPath, "ToggleGroupItem", derivationDrift)).not.toEqual([])
  })
})
