import { describe, expect, test } from "vitest"

import { normalize, tickLabels, valueExtent, valueScale } from "../src/components/ui/chart-scale"

describe("valueExtent", () => {
  test("includes zero and ignores gaps", () => {
    expect(valueExtent([[42000, null, 55000], [30000, 37000, null]], false)).toEqual([0, 55000])
    expect(valueExtent([[-5, 3]], false)).toEqual([-5, 3])
  })

  test("uses running stack totals, so mixed-sign stacks are covered", () => {
    // Row 0 runs 5, 2, 12; row 1 runs 5, -3, -1. Row totals alone would miss the -3.
    expect(valueExtent([[5, 5], [-3, -8], [10, 2]], true)).toEqual([-3, 12])
  })

  test("normalises float sums to 12 significant digits", () => {
    expect(valueExtent([[0.33], [0.56], [0.11]], true)).toEqual([0, 1])
    expect(normalize(0.1 + 0.2)).toBe(0.3)
  })
})

describe("valueScale", () => {
  test("keeps Release 012's ticks when no bounds are given", () => {
    expect(valueScale([0, 55000], {})).toEqual({ domain: [0, 60000], ticks: [0, 20000, 40000, 60000] })
    expect(valueScale([0, 92000], {}).ticks).toEqual([0, 25000, 50000, 75000, 100000])
    expect(valueScale([0, 0], {}).ticks).toEqual([0, 0.25])
  })

  test("steps over the span left by a raised valueMin (the rerun case)", () => {
    expect(valueScale([31000, 48000], { min: 30000 })).toEqual({ domain: [30000, 50000], ticks: [30000, 35000, 40000, 45000, 50000] })
  })

  test("moves a free bound one step beyond an explicit bound it would equal", () => {
    expect(valueScale([30000, 30000], { min: 30000 })).toEqual({ domain: [30000, 40000], ticks: [30000, 40000] })
    expect(valueScale([-40000, -40000], { max: -40000 })).toEqual({ domain: [-50000, -40000], ticks: [-50000, -40000] })
  })

  test("uses explicit bounds as the domain edges and keeps exact fractional bounds", () => {
    expect(valueScale([0, 0.25], { max: 0.3 })).toEqual({ domain: [0, 0.3], ticks: [0, 0.1, 0.2, 0.3] })
    expect(valueScale([0, 0.5], { max: 0.6 }).ticks).toEqual([0, 0.2, 0.4, 0.6])
    // 0.7 is not a multiple of the 0.2 step, so it is the unlabelled plot edge.
    expect(valueScale([0, 0.5], { max: 0.7 })).toEqual({ domain: [0, 0.7], ticks: [0, 0.2, 0.4, 0.6] })
    expect(valueScale([0, 1], { max: 1.1 }).domain).toEqual([0, 1.1])
  })

  test("ends a 100% stack at 100%", () => {
    expect(valueScale(valueExtent([[0.33], [0.56], [0.11]], true), {}).ticks).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})

describe("tickLabels", () => {
  const labels = (ticks: number[], format: "number" | "currency" | "percent" | "compact", locale = "en-US", currency?: string) => tickLabels(ticks, { locale, valueFormat: format, currency }).labels

  test("keeps Release 012's compact labels where they were exact", () => {
    expect(labels([0, 20000, 40000, 60000], "number")).toEqual(["0", "20K", "40K", "60K"])
    expect(labels([0, 25000, 50000, 75000, 100000], "currency", "en-US", "USD")).toEqual(["$0", "$25K", "$50K", "$75K", "$100K"])
    expect(labels([0, 0.25, 0.5, 0.75, 1], "percent")).toEqual(["0%", "25%", "50%", "75%", "100%"])
  })

  test("adds precision until every label is exact", () => {
    expect(labels([0, 0.025, 0.05, 0.075, 0.1], "percent")).toEqual(["0%", "2.5%", "5%", "7.5%", "10%"])
    expect(labels([0, 2500, 5000], "number")).toEqual(["0", "2.5K", "5K"])
    expect(labels([1250000, 1500000], "compact")).toEqual(["1.25M", "1.5M"])
  })

  test("falls back to the full format when compact cannot be exact", () => {
    expect(labels([48000, 48025, 48050, 48075, 48100], "currency", "en-US", "USD")).toEqual(["$48,000", "$48,025", "$48,050", "$48,075", "$48,100"])
    expect(labels([1234000, 1234250, 1234500], "number")).toEqual(["1,234,000", "1,234,250", "1,234,500"])
  })

  test("labels stay exact and distinct in other locales", () => {
    for (const locale of ["de-DE", "ja-JP", "ar", "hi-IN", "es-ES"]) {
      const result = labels([1200000, 1225000, 1250000, 1275000, 1300000], "currency", locale, "EUR")
      expect(new Set(result).size, locale).toBe(5)
    }
    expect(labels([0, 10000, 20000], "number", "ja-JP")).toEqual(["0", "1万", "2万"])
  })
})
