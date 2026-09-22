import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { createTokenSourceAnalyzer } from "../src/contracts/components/token-source-analysis"

const fixturePath = join(process.cwd(), "tests/fixtures/token-utility-condition-fixture.tsx")

const analyzer = createTokenSourceAnalyzer({
  classMergeFunctionNames: ["cn"],
  recipeFunctionNames: ["cva"],
  resolveUtility: (utility) => ({
    "rounded-lg": { tokenId: "radius.lg" },
    "rounded-md": { tokenId: "radius.md" },
    "gap-2": { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 } },
    "bg-background": { tokenId: "color.background" },
    "bg-destructive": { tokenId: "color.destructive" },
  } as const)[utility],
})

describe("conditional Tailwind token utility analysis", () => {
  test("preserves exact data condition names and values and canonical stacked conjunctions", () => {
    expect(analyzer.analyzeTailwindTokenDependencies(
      "data-[size=sm]:rounded-md group-data-[orientation=vertical]/root:data-[spacing=0]:gap-2 dark:hover:data-[state=open]:bg-background aria-invalid:bg-destructive",
    )).toEqual([
      { tokenId: "radius.md", when: { propName: "size", equals: "sm" }, evidenceRefs: ["source"] },
      {
        tokenId: "spacing.unit",
        when: { all: [{ propName: "orientation", equals: "vertical" }, { propName: "spacing", equals: 0 }] },
        viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 },
        evidenceRefs: ["source"],
      },
      { tokenId: "color.background", when: { propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "color.destructive", when: { propName: "aria-invalid", equals: true }, evidenceRefs: ["source"] },
    ])
  })

  test("combines recipe and utility conditions without losing either predicate", () => {
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "RecipeAndUtilityConditionFixture")).toEqual(expect.arrayContaining([
      {
        tokenId: "color.background",
        when: { all: [{ propName: "tone", equals: "default" }, { propName: "state", equals: "open" }] },
        evidenceRefs: ["source"],
      },
      {
        tokenId: "color.destructive",
        when: { all: [{ propName: "tone", equals: "danger" }, { propName: "state", equals: "closed" }] },
        evidenceRefs: ["source"],
      },
    ]))
  })

  test("rejects exact condition and value drift during source comparison", () => {
    const exact = analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "ConditionalUtilityFixture")
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "ConditionalUtilityFixture", exact)).toEqual([])

    const conditionDrift = structuredClone(exact) as Array<{ when?: { propName?: string; equals?: unknown; all?: Array<{ propName: string; equals: unknown }> } } & Record<string, unknown>>
    conditionDrift.find((dependency) => dependency.when?.propName === "size")!.when!.propName = "variant"
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "ConditionalUtilityFixture", conditionDrift as never)).toEqual(expect.arrayContaining([
      expect.stringContaining('"propName":"size","equals":"sm"'),
      expect.stringContaining('"propName":"variant","equals":"sm"'),
    ]))

    const valueDrift = structuredClone(exact) as Array<{ when?: { propName?: string; equals?: unknown; all?: Array<{ propName: string; equals: unknown }> } } & Record<string, unknown>>
    const stacked = valueDrift.find((dependency) => dependency.when?.all)!.when!.all!
    stacked.at(-1)!.equals = 1
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "ConditionalUtilityFixture", valueDrift as never)).toEqual(expect.arrayContaining([
      expect.stringContaining('"propName":"spacing","equals":0'),
      expect.stringContaining('"propName":"spacing","equals":1'),
    ]))
  })

  test("fails closed for malformed, dynamic, unsupported data-like, and ambiguous arbitrary prefixes", () => {
    expect(analyzer.analyzeTailwindTokenDependencies(
      "data-[size=sm:rounded-md data-[${dimension}=sm]:rounded-lg mystery-data-[size=sm]:bg-background [&:has([data-size=sm])]:bg-destructive data-[size=sm]/named-self:rounded-md",
    )).toEqual([])
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "MalformedUtilityFixture")).toEqual([])
  })

  test("deduplicates repeated conditions and rejects contradictory conjunctions", () => {
    expect(analyzer.analyzeTailwindTokenDependencies("data-[size=sm]:data-[size=sm]:rounded-md")).toEqual([
      { tokenId: "radius.md", when: { propName: "size", equals: "sm" }, evidenceRefs: ["source"] },
    ])
    expect(analyzer.analyzeTailwindTokenDependencies("data-[size=sm]:data-[size=lg]:rounded-md")).toEqual([])
  })
})
