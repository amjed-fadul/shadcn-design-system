import { join } from "node:path"

import { __unstable__loadDesignSystem } from "tailwindcss"
import { beforeAll, describe, expect, test } from "vitest"

import { analyzeComponentTokenDependenciesForExport } from "../src/contracts/components/canonical-token-source-analysis"
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
    "text-sm": { tokenId: "font-size.sm" },
  } as const)[utility],
})

let tailwind: Awaited<ReturnType<typeof __unstable__loadDesignSystem>>

beforeAll(async () => {
  tailwind = await __unstable__loadDesignSystem("@theme { --radius-md: .375rem; --radius-lg: .5rem; --text-sm: .875rem; } @tailwind utilities;")
})

describe("conditional Tailwind token utility analysis", () => {
  test("preserves exact data condition names and values and canonical stacked conjunctions", () => {
    expect(analyzer.analyzeTailwindTokenDependencies(
      "data-[size=sm]:rounded-md group-data-[orientation=vertical]/root:data-[spacing=0]:gap-2 dark:hover:data-[state=open]:bg-background aria-invalid:bg-destructive",
    )).toEqual([
      { tokenId: "radius.md", when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "sm" }, evidenceRefs: ["source"] },
      {
        tokenId: "spacing.unit",
        sourceContext: { applicability: ["group-data-[orientation=vertical]/root"] },
        when: { subject: "data", path: [{ kind: "self" }], propName: "spacing", equals: 0 },
        viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 },
        evidenceRefs: ["source"],
      },
      { tokenId: "color.background", when: { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "color.destructive", when: { subject: "aria", path: [{ kind: "self" }], propName: "invalid", equals: true }, evidenceRefs: ["source"] },
    ])
  })

  test("combines recipe and utility conditions without losing either predicate", () => {
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "RecipeAndUtilityConditionFixture")).toEqual(expect.arrayContaining([
      {
        tokenId: "color.background",
        when: { all: [{ propName: "tone", equals: "default" }, { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "open" }] },
        evidenceRefs: ["source"],
      },
      {
        tokenId: "color.destructive",
        when: { all: [{ propName: "tone", equals: "danger" }, { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "closed" }] },
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
    const spacing = valueDrift.find((dependency) => dependency.when?.propName === "spacing")!.when!
    spacing.equals = 1
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "ConditionalUtilityFixture", valueDrift as never)).toEqual(expect.arrayContaining([
      expect.stringContaining('"propName":"spacing","equals":0'),
      expect.stringContaining('"propName":"spacing","equals":1'),
    ]))
  })

  test("fails closed for malformed, dynamic, unsupported data-like, and ambiguous arbitrary prefixes", () => {
    expect(analyzer.analyzeTailwindTokenDependencies(
      "data-[size=sm:rounded-md data-[${dimension}=sm]:rounded-lg mystery-data-[size=sm]:bg-background [&:has([data-size=sm])]:bg-destructive data-[size=sm]/named-self:rounded-md",
    )).toEqual([
      { tokenId: "color.destructive", evidenceRefs: ["source"] },
    ])
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "MalformedUtilityFixture")).toEqual([
      { tokenId: "color.destructive", evidenceRefs: ["source"] },
    ])
  })

  test("deduplicates repeated conditions and rejects contradictory conjunctions", () => {
    expect(analyzer.analyzeTailwindTokenDependencies("data-[size=sm]:data-[size=sm]:rounded-md")).toEqual([
      { tokenId: "radius.md", when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "sm" }, evidenceRefs: ["source"] },
    ])
    expect(analyzer.analyzeTailwindTokenDependencies("data-[size=sm]:data-[size=lg]:rounded-md")).toEqual([])
  })

  test("preserves attribute subject, scope, relation, optional name, and escaped values", () => {
    const valid = [
      "group-data-[size=sm]/root:data-[size=lg]:rounded-md",
      "group-aria-[expanded=true]/root:rounded-lg",
      "peer-aria-checked/item:rounded-lg",
      "in-aria-[busy=true]:rounded-lg",
      "has-aria-[label=x]:rounded-lg",
      "group-has-data-[slot=media]/root:rounded-lg",
      "data-[label=some\\_value]:rounded-lg",
    ]
    expect(valid.map((candidate) => tailwind.candidatesToCss([candidate])[0])).not.toContain(null)

    expect(analyzer.analyzeTailwindTokenDependencies(valid.join(" "))).toEqual([
      {
        tokenId: "radius.md",
        sourceContext: { applicability: ["group-data-[size=sm]/root"] },
        when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "lg" },
        evidenceRefs: ["source"],
      },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "group", name: "root" }], propName: "expanded", equals: true }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "peer", name: "item" }], propName: "checked", equals: true }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "in" }], propName: "busy", equals: true }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "has" }], propName: "label", equals: "x" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "has" }], propName: "slot", equals: "media" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "some_value" }, evidenceRefs: ["source"] },
    ])
  })

  test("preserves ordered compound relationship paths and escaped bracket values", () => {
    const valid = [
      "has-group-data-[state=open]/root:rounded-lg",
      "group-has-data-[state=open]/root:rounded-lg",
      "has-peer-data-[state=open]/item:rounded-lg",
      "group-in-data-[state=open]/root:rounded-lg",
      "has-in-data-[state=open]:rounded-lg",
      "data-[label=a\\[b]:rounded-lg",
      "data-[label=a\\]b]:rounded-lg",
    ]
    expect(valid.map((candidate) => tailwind.candidatesToCss([candidate])[0])).not.toContain(null)

    expect(analyzer.analyzeTailwindTokenDependencies(valid.join(" "))).toEqual([
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "group", name: "root" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "has" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "peer", name: "item" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "in" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "in" }], propName: "state", equals: "open" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "a[b" }, evidenceRefs: ["source"] },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "a]b" }, evidenceRefs: ["source"] },
    ])
  })

  test("keeps pseudo-element targets in source context and self attributes in token conditions", () => {
    expect(analyzer.analyzeTailwindTokenDependencies("after:aria-[expanded=true]:rounded-lg data-[state=open]:before:rounded-md")).toEqual([
      {
        tokenId: "radius.lg",
        sourceContext: { applicability: [], target: { kind: "pseudo-element", name: "after" } },
        when: { subject: "aria", path: [{ kind: "self" }], propName: "expanded", equals: true },
        evidenceRefs: ["source"],
      },
      {
        tokenId: "radius.md",
        sourceContext: { applicability: [], target: { kind: "pseudo-element", name: "before" } },
        when: { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "open" },
        evidenceRefs: ["source"],
      },
    ])
  })

  test("matches Tailwind validity while failing closed for negative, named in, and trailing escapes", () => {
    expect(tailwind.candidatesToCss(["in-data-[state=open]/root:rounded-md"])[0]).toBeNull()
    expect(tailwind.candidatesToCss(["not-data-[state=open]:rounded-md"])[0]).not.toBeNull()
    expect(analyzer.analyzeTailwindTokenDependencies(
      "in-data-[state=open]/root:rounded-md not-data-[state=open]:rounded-md rounded-md\\",
    )).toEqual([])
  })

  test("keeps repository operational placeholder variants without inventing a condition", () => {
    expect(tailwind.candidatesToCss(["placeholder:text-sm"])[0]).not.toBeNull()
    expect(analyzer.analyzeTailwindTokenDependencies("placeholder:text-sm")).toEqual([
      { tokenId: "font-size.sm", evidenceRefs: ["source"] },
    ])

    expect(analyzeComponentTokenDependenciesForExport(join(process.cwd(), "src/components/ui/input.tsx"), "Input")).toContainEqual({
      tokenId: "color.muted-foreground",
      evidenceRefs: ["source"],
    })
  })

  test("keeps safe structural selectors as bare token evidence without decoding ambiguous data predicates", () => {
    expect(analyzer.analyzeTailwindTokenDependencies(
      "[&>svg]:gap-2 [&_p]:text-sm [&>a:hover]:bg-background [&_[cmdk-group-heading]]:rounded-lg has-[[data-state=checked]]:bg-destructive",
    )).toEqual([
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 }, evidenceRefs: ["source"] },
      { tokenId: "font-size.sm", evidenceRefs: ["source"] },
      { tokenId: "color.background", evidenceRefs: ["source"] },
      { tokenId: "radius.lg", evidenceRefs: ["source"] },
      { tokenId: "color.destructive", evidenceRefs: ["source"] },
    ])
  })

  test("compares token conditions with stable object-key ordering and ordered conjunctions", () => {
    const exact = analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "RecipeAndUtilityConditionFixture")
    const reordered = structuredClone(exact)
    for (const dependency of reordered) {
      if (!dependency.when || !dependency.when.all) continue
      const all = dependency.when.all
      for (let index = 0; index < all.length; index += 1) {
        const { propName, equals, ...metadata } = all[index]
        all[index] = { equals, propName, ...metadata } as typeof all[number]
      }
    }
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "RecipeAndUtilityConditionFixture", reordered)).toEqual([])

    const reversed = structuredClone(reordered)
    const conjunction = reversed.find((dependency) => dependency.when && "all" in dependency.when)!.when!
    if (!conjunction.all) throw new Error("Expected a conjunction")
    conjunction.all.reverse()
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "RecipeAndUtilityConditionFixture", reversed)).not.toEqual([])
  })
})
