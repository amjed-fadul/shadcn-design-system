import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import type { TokenContract } from "../src/contracts/tokens/types"
import { composite, contrastRatio, oklchToLinearSrgb, parseOklch, type LinearRgb } from "./helpers/oklch-contrast"

const AA_TEXT = 4.5
const HOVER_ALPHA = 0.8 // Button and Badge hover: `bg-primary/80`.
const modes = ["light", "dark"] as const

const contract = JSON.parse(
  readFileSync(new URL("../contracts/tokens/token-contract.json", import.meta.url), "utf8"),
) as TokenContract

function colour(id: string, mode: (typeof modes)[number]): string {
  const token = contract.tokens.find((candidate) => candidate.id === id)
  if (!token || token.value.kind !== "modes") throw new Error(`Missing mode colour token: ${id}`)
  return token.value.values[mode]
}

const rgb = (id: string, mode: (typeof modes)[number]): LinearRgb => oklchToLinearSrgb(colour(id, mode))

describe("oklch contrast helper", () => {
  test("matches known WCAG ratios", () => {
    const white = oklchToLinearSrgb("oklch(1 0 0)")
    const black = oklchToLinearSrgb("oklch(0 0 0)")
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5)
    expect(contrastRatio(oklchToLinearSrgb("oklch(0.488 0.243 264.376)"), white)).toBeCloseTo(6.824, 3)
    expect(contrastRatio(oklchToLinearSrgb("oklch(70.7% 0.165 254.624)"), oklchToLinearSrgb("oklch(0.145 0 0)"))).toBeCloseTo(7.506, 3)
  })

  test("does not round a sub-threshold contrast ratio into an AA pass", () => {
    const justBelowAa: LinearRgb = [0.6183445468540216, 0.011645430905844125, 0.6038273388553378]

    expect(contrastRatio(justBelowAa, [1, 1, 1])).toBe(4.499)
    expect(contrastRatio(justBelowAa, [1, 1, 1])).toBeLessThan(AA_TEXT)
  })

  test("rejects colour syntaxes it cannot measure", () => {
    expect(() => parseOklch("oklch(1 0 0 / 10%)")).toThrow("Unsupported colour value")
    expect(() => parseOklch("#1447e6")).toThrow("Unsupported colour value")
  })
})

describe.each(modes)("brand colour contrast floor (%s)", (mode) => {
  test("applies a chromatic brand colour to primary", () => {
    expect(parseOklch(colour("color.primary", mode)).c).toBeGreaterThan(0)
    expect(colour("color.sidebar-primary", mode)).toBe(colour("color.primary", mode))
  })

  test("primary-foreground on primary", () => {
    expect(contrastRatio(rgb("color.primary-foreground", mode), rgb("color.primary", mode))).toBeGreaterThanOrEqual(AA_TEXT)
  })

  test("primary-foreground on the primary/80 hover over background", () => {
    const hover = composite(rgb("color.primary", mode), HOVER_ALPHA, rgb("color.background", mode))
    expect(contrastRatio(rgb("color.primary-foreground", mode), hover)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  test("primary text on background", () => {
    expect(contrastRatio(rgb("color.primary", mode), rgb("color.background", mode))).toBeGreaterThanOrEqual(AA_TEXT)
  })

  test("sidebar-primary-foreground on sidebar-primary", () => {
    expect(contrastRatio(rgb("color.sidebar-primary-foreground", mode), rgb("color.sidebar-primary", mode))).toBeGreaterThanOrEqual(AA_TEXT)
  })
})
