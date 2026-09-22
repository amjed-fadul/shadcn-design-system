import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { analyzeComponentTokenDependenciesForExport, analyzeComponentTokenSourceForExport } from "../src/contracts/components/canonical-token-source-analysis"
import { createTokenSourceAnalyzer } from "../src/contracts/components/token-source-analysis"

const fixturePath = join(process.cwd(), "tests/fixtures/token-arithmetic-fixture.tsx")

const analyzer = createTokenSourceAnalyzer({
  resolveUtility: () => undefined,
  resolveCssVariable: (variable: string, multiplier: number) => variable === "--spacing"
    ? { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier } }
    : undefined,
})

type ArithmeticSource = {
  tokenId: string
  viaDerivedRule: { id: string; multiplier: number }
  when?: unknown
  source: { sourcePath: string; start: number; end: number; expressionKind: string; sourceText: string }
}

function arithmeticSources(exportName: string) {
  const analysis = analyzer.analyzeComponentTokenSourceForExport(fixturePath, exportName)
  return { tokenExpressions: analysis.tokenExpressions as ArithmeticSource[], unresolved: analysis.unresolved }
}

describe("CSS-variable token arithmetic source analysis", () => {
  test("resolves exact zero, positive, negative, fractional, and static template multipliers", () => {
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "ExactArithmeticFixture")).toEqual(expect.arrayContaining([
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 }, evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 }, evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: -1.5 }, evidenceRefs: ["source"] },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0.25 }, evidenceRefs: ["source"] },
      {
        tokenId: "spacing.unit",
        when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "sm" },
        viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 },
        evidenceRefs: ["source"],
      },
    ]))
    expect(arithmeticSources("ExactArithmeticFixture").unresolved).toEqual([])
  })

  test("retains exact authored provenance for literal and interpolated expressions", () => {
    const sources = arithmeticSources("ExactArithmeticFixture").tokenExpressions
    expect(sources).toContainEqual(expect.objectContaining({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 },
      source: {
        sourcePath: fixturePath,
        start: 215,
        end: 241,
        expressionKind: "StringLiteral",
        sourceText: '"calc(var(--spacing) * 0)"',
      },
    }))
    expect(sources).toContainEqual(expect.objectContaining({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 0.25 },
      source: {
        sourcePath: fixturePath,
        start: 350,
        end: 393,
        expressionKind: "TemplateExpression",
        sourceText: "`calc(var(--spacing) * ${STATIC_FRACTION})`",
      },
    }))
  })

  test("rejects exact multiplier mutations while leaving source evidence authoritative", () => {
    const exact = analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, "ExactArithmeticFixture")
    const mutated = structuredClone(exact)
    mutated.find((dependency) => dependency.viaDerivedRule?.multiplier === 0)!.viaDerivedRule!.multiplier = 9
    expect(analyzer.compareComponentTokenDependenciesForExport(fixturePath, "ExactArithmeticFixture", mutated)).toEqual(expect.arrayContaining([
      expect.stringContaining('"multiplier":0'),
      expect.stringContaining('"multiplier":9'),
    ]))
    expect(arithmeticSources("ExactArithmeticFixture").tokenExpressions).toContainEqual(expect.objectContaining({
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 },
      source: expect.objectContaining({ sourceText: '"calc(var(--spacing) * 0)"' }),
    }))
  })

  test.each([
    ["UnsupportedOperatorFixture", "Unsupported CSS token arithmetic operator."],
    ["MultipleVariablesFixture", "CSS token arithmetic must reference exactly one variable."],
    ["UnknownVariableFixture", "CSS token arithmetic references an unapproved variable."],
    ["NonnumericOperandFixture", "CSS token arithmetic operand is not numeric."],
    ["DynamicOperandFixture", "Dynamic CSS token arithmetic operand."],
    ["AmbiguousInterpolationFixture", "Ambiguous CSS token arithmetic interpolation."],
    ["DivisionByZeroFixture", "CSS token arithmetic divides by zero."],
    ["ReversedShapeFixture", "CSS token arithmetic expression shape is not equivalent."],
  ])("fails closed for %s with explicit evidence and no partial facts", (exportName, reason) => {
    const { tokenExpressions, unresolved } = arithmeticSources(exportName)
    expect(tokenExpressions).toEqual([])
    expect(analyzer.analyzeComponentTokenDependenciesForExport(fixturePath, exportName)).toEqual([])
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0]).toEqual(expect.objectContaining({
      sourcePath: fixturePath,
      expressionKind: expect.stringMatching(/^(?:StringLiteral|TemplateExpression)$/),
      sourceText: expect.stringContaining("calc("),
      reason,
    }))
    expect(unresolved[0].end).toBeGreaterThan(unresolved[0].start)
  })

  test("keeps the canonical dynamic spacing operand unresolved without inventing a default fact", () => {
    const source = join(process.cwd(), "src/components/ui/toggle-group.tsx")
    const analysis = analyzeComponentTokenSourceForExport(source, "ToggleGroup")
    expect(analysis.tokenExpressions).toEqual([])
    expect(analysis.unresolved).toContainEqual(expect.objectContaining({
      sourcePath: source,
      expressionKind: "TemplateExpression",
      sourceText: "`calc(var(--spacing) * ${spacing})`",
      reason: "Dynamic CSS token arithmetic operand.",
    }))
    expect(analyzeComponentTokenDependenciesForExport(source, "ToggleGroup")).not.toContainEqual(expect.objectContaining({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 },
    }))
  })

  test.each([
    "ReassignedBindingFixture",
    "UpdatedBindingFixture",
    "StaleBindingFixture",
  ])("rejects mutable or written interpolation binding in %s", (exportName) => {
    const { tokenExpressions, unresolved } = arithmeticSources(exportName)
    expect(tokenExpressions).toEqual([])
    expect(unresolved).toEqual([
      expect.objectContaining({ reason: "Dynamic CSS token arithmetic operand." }),
    ])
  })

  test("resolves the nearest immutable shadow without using a stale outer binding", () => {
    const { tokenExpressions, unresolved } = arithmeticSources("ShadowedBindingFixture")
    expect(unresolved).toEqual([])
    expect(tokenExpressions).toEqual([
      expect.objectContaining({
        viaDerivedRule: { id: "spacing.multiplier", multiplier: 3 },
        source: expect.objectContaining({ sourceText: "`calc(var(--spacing) * ${SHADOW_MULTIPLIER})`" }),
      }),
    ])
  })

  test.each([
    "OverflowNumericFixture",
    "ScientificNumericFixture",
    "NaNNumericFixture",
    "InfinityNumericFixture",
  ])("rejects non-finite or non-decimal numeric spelling in %s", (exportName) => {
    const { tokenExpressions, unresolved } = arithmeticSources(exportName)
    expect(tokenExpressions).toEqual([])
    expect(unresolved).toEqual([
      expect.objectContaining({ reason: "CSS token arithmetic operand is not a finite decimal." }),
    ])
  })

  test("canonicalizes negative zero to positive zero", () => {
    const { tokenExpressions, unresolved } = arithmeticSources("NegativeZeroFixture")
    expect(unresolved).toEqual([])
    expect(tokenExpressions).toHaveLength(1)
    expect(tokenExpressions[0].viaDerivedRule.multiplier).toBe(0)
    expect(Object.is(tokenExpressions[0].viaDerivedRule.multiplier, -0)).toBe(false)
  })
})
