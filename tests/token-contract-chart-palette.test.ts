import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import type { TokenContract } from "../src/contracts/tokens/types"
import { deltaE } from "./helpers/cvd"
import { contrastRatio, oklchToLinearSrgb, parseOklch, type LinearRgb } from "./helpers/oklch-contrast"

// WCAG 1.4.11 non-text contrast for chart marks.
const NON_TEXT = 3
// Categorical palette checks (OKLab ΔE ×100, Machado 2009 severity 1.0).
const CVD_TARGET = 8
const NORMAL_FLOOR = 15
const CHROMA_FLOOR = 0.1
const LIGHTNESS_BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] } as const
const modes = ["light", "dark"] as const
const slots = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const

const contract = JSON.parse(
  readFileSync(new URL("../contracts/tokens/token-contract.json", import.meta.url), "utf8"),
) as TokenContract

function colour(id: string, mode: (typeof modes)[number]): string {
  const token = contract.tokens.find((candidate) => candidate.id === id)
  if (!token || token.value.kind !== "modes") throw new Error(`Missing mode colour token: ${id}`)
  return token.value.values[mode]
}

const rgb = (id: string, mode: (typeof modes)[number]): LinearRgb => oklchToLinearSrgb(colour(id, mode))

// Adjacent pairs, including the 5 → 1 wrap that a donut chart puts side by side.
const adjacentPairs = slots.map((slot, index) => [slot, slots[(index + 1) % slots.length]] as const)

describe.each(modes)("chart palette (%s)", (mode) => {
  test.each(slots)("%s sits in the lightness band with enough chroma", (slot) => {
    const { l, c } = parseOklch(colour(`color.${slot}`, mode))
    expect(l).toBeGreaterThanOrEqual(LIGHTNESS_BAND[mode][0])
    expect(l).toBeLessThanOrEqual(LIGHTNESS_BAND[mode][1])
    expect(c).toBeGreaterThanOrEqual(CHROMA_FLOOR)
  })

  test.each(slots.flatMap((slot) => (["card", "background"] as const).map((surface) => [slot, surface] as const)))(
    "%s against %s meets non-text contrast",
    (slot, surface) => {
      expect(contrastRatio(rgb(`color.${slot}`, mode), rgb(`color.${surface}`, mode))).toBeGreaterThanOrEqual(NON_TEXT)
    },
  )

  test.each(adjacentPairs)("%s and %s stay apart for protanopia, deuteranopia and normal vision", (first, second) => {
    const a = rgb(`color.${first}`, mode)
    const b = rgb(`color.${second}`, mode)
    expect(deltaE(a, b, "protan")).toBeGreaterThanOrEqual(CVD_TARGET)
    expect(deltaE(a, b, "deutan")).toBeGreaterThanOrEqual(CVD_TARGET)
    expect(deltaE(a, b, "normal")).toBeGreaterThanOrEqual(NORMAL_FLOOR)
  })

  test("no series colour repeats a status or brand-destructive colour", () => {
    const reserved = ["success", "warning", "info", "destructive"].map((id) => colour(`color.${id}`, mode))
    for (const slot of slots) expect(reserved).not.toContain(colour(`color.${slot}`, mode))
  })
})

test("light chart-1 is the brand blue", () => {
  expect(colour("color.chart-1", "light")).toBe(colour("color.primary", "light"))
})

test("cvd helper separates a known confusable pair less than a distinct pair", () => {
  const red = oklchToLinearSrgb("oklch(0.577 0.245 27.325)")
  const green = oklchToLinearSrgb("oklch(0.627 0.194 149.214)")
  const blue = oklchToLinearSrgb("oklch(0.488 0.243 264.376)")
  expect(deltaE(red, green, "deutan")).toBeLessThan(deltaE(red, green, "normal"))
  expect(deltaE(red, blue, "deutan")).toBeGreaterThan(deltaE(red, green, "deutan"))
  expect(deltaE(red, red, "protan")).toBe(0)
})
