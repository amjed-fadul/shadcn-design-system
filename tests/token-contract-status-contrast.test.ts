import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import type { TokenContract } from "../src/contracts/tokens/types"
import { composite, contrastRatio, oklchToLinearSrgb, parseOklch, type LinearRgb } from "./helpers/oklch-contrast"

const AA_TEXT = 4.5
// Badge status variants rest on a 10% tint and link badges hover on a 15% tint.
const TINTS = [0.1, 0.15] as const
const modes = ["light", "dark"] as const
const statuses = ["success", "warning", "info"] as const
const surfaces = ["background", "card", "muted"] as const

const contract = JSON.parse(
  readFileSync(new URL("../contracts/tokens/token-contract.json", import.meta.url), "utf8"),
) as TokenContract

function colour(id: string, mode: (typeof modes)[number]): string {
  const token = contract.tokens.find((candidate) => candidate.id === id)
  if (!token || token.value.kind !== "modes") throw new Error(`Missing mode colour token: ${id}`)
  return token.value.values[mode]
}

const rgb = (id: string, mode: (typeof modes)[number]): LinearRgb => oklchToLinearSrgb(colour(id, mode))

describe.each(modes)("status colour contrast floor (%s)", (mode) => {
  describe.each(statuses)("%s", (status) => {
    test("is chromatic and distinct from the brand and destructive colours", () => {
      expect(parseOklch(colour(`color.${status}`, mode)).c).toBeGreaterThan(0.1)
      expect(colour(`color.${status}`, mode)).not.toBe(colour("color.primary", mode))
      expect(colour(`color.${status}`, mode)).not.toBe(colour("color.destructive", mode))
    })

    test("foreground on the solid fill", () => {
      expect(contrastRatio(rgb(`color.${status}-foreground`, mode), rgb(`color.${status}`, mode))).toBeGreaterThanOrEqual(AA_TEXT)
    })

    test.each(surfaces)("text on %s", (surface) => {
      expect(contrastRatio(rgb(`color.${status}`, mode), rgb(`color.${surface}`, mode))).toBeGreaterThanOrEqual(AA_TEXT)
    })

    test.each(TINTS.flatMap((alpha) => (["background", "card"] as const).map((surface) => [alpha, surface] as const)))(
      "text on its %s tint over %s",
      (alpha, surface) => {
        const tint = composite(rgb(`color.${status}`, mode), alpha, rgb(`color.${surface}`, mode))
        expect(contrastRatio(rgb(`color.${status}`, mode), tint)).toBeGreaterThanOrEqual(AA_TEXT)
      },
    )
  })
})

test("status foregrounds follow the brand foreground rule", () => {
  for (const status of statuses) {
    expect(colour(`color.${status}-foreground`, "light")).toBe("oklch(1 0 0)")
    expect(colour(`color.${status}-foreground`, "dark")).toBe(colour("color.primary-foreground", "dark"))
  }
})
