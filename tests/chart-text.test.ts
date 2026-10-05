import { describe, expect, test } from "vitest"

import { CENTER_SIZE_PX, estimateTextWidth, fitCenter, type CenterLayout, type TextWeight } from "../src/components/ui/chart-text"

// Re-checks a layout against the hole: every line's half-width plus padding must sit inside the chord at
// its farthest vertical edge.
function fits(layout: CenterLayout, radius: number): boolean {
  const lines: Array<{ text: string; px: number; y: number; weight: TextWeight }> = [{ text: layout.value, px: CENTER_SIZE_PX[layout.size], y: layout.valueY, weight: "semibold" }]
  if (layout.caption) lines.push({ text: layout.caption, px: 12, y: layout.captionY!, weight: "regular" })
  return lines.every((line) => {
    const edge = Math.abs(line.y) + (line.px * 1.17) / 2
    return edge < radius && estimateTextWidth(line.text, line.px, line.weight) / 2 + 2 <= Math.sqrt(radius ** 2 - edge ** 2)
  })
}

describe("estimateTextWidth", () => {
  test("uses per-character advances", () => {
    expect(estimateTextWidth("$12,345", 24, "semibold")).toBeCloseTo((0.78 + 5 * 0.63 + 0.25) * 24, 5)
    expect(estimateTextWidth("12,345", 10, "regular")).toBeCloseTo((5 * 0.63 + 0.25) * 10 * 0.95, 5)
  })

  test("budgets wide East Asian characters at 1 em and marks at 0", () => {
    expect(estimateTextWidth("10万", 10, "semibold")).toBeCloseTo((2 * 0.63 + 1) * 10, 5)
    expect(estimateTextWidth("‏12 US$", 10, "semibold")).toBeCloseTo((2 * 0.63 + 0.25 + 2 * 0.75 + 0.78) * 10, 5)
  })
})

describe("fitCenter", () => {
  test("uses the largest size that fits, keeping the caption", () => {
    const layout = fitCenter({ full: "1,130", compact: "1.1K", caption: "Customers", radius: 96 })!
    expect(layout).toMatchObject({ value: "1,130", size: "2xl", caption: "Customers" })
    expect(fits(layout, 96)).toBe(true)
  })

  test("shrinks before switching to the compact form, and never overflows", () => {
    const layout = fitCenter({ full: "$12,345", compact: "$12.3K", radius: 51 })!
    expect(layout.value).toBe("$12,345")
    expect(["xl", "lg", "base"]).toContain(layout.size)
    expect(fits(layout, 51)).toBe(true)
  })

  test("uses the compact form only when it is shorter", () => {
    expect(fitCenter({ full: "$12,345,678", compact: "$12.3M", radius: 40 })!.value).toBe("$12.3M")
    // de-DE: the compact form of 12.345 € is no shorter, so the full value stays.
    expect(fitCenter({ full: "12.345 €", compact: "12.345 €", radius: 40 })!.value).toBe("12.345 €")
    // es-ES: the compact form is longer.
    expect(fitCenter({ full: "12.345 €", compact: "12,3 mil €", radius: 40 })!.value).toBe("12.345 €")
  })

  test("keeps the full Arabic value when its compact form is longer (one of Canvas's Page locales)", () => {
    const layout = fitCenter({ full: "\u200F١٢٬٣٤٥ US$", compact: "\u200F١٢٫٣ ألف US$", radius: 51 })!
    expect(layout.value).toBe("\u200F١٢٬٣٤٥ US$")
    expect(fits(layout, 51)).toBe(true)
  })

  test("keeps the caption at a smaller size when that fits, and drops it only when nothing fits with it", () => {
    const withCaption = fitCenter({ full: "1,130", compact: "1.1K", caption: "Customers", radius: 42 })
    expect(withCaption).toMatchObject({ caption: "Customers", value: "1,130" })
    expect(withCaption!.size).not.toBe("2xl")
    expect(fits(withCaption!, 42)).toBe(true)
    const crowded = fitCenter({ full: "1,130", compact: "1.1K", caption: "Customers this quarter", radius: 30 })!
    expect(crowded.caption).toBeUndefined()
    expect(fits(crowded, 30)).toBe(true)
  })

  test("hides the total rather than overflow", () => {
    expect(fitCenter({ full: "$12,345,678", compact: "$12.3M", caption: "Revenue", radius: 12 })).toBeNull()
  })

  test("every candidate it returns fits, across sizes and values", () => {
    const values: Array<[string, string]> = [["US$12,345", "US$12.3K"], ["$1,234,567", "$1.2M"], ["100%", "100%"], ["‏١٢٬٣٤٥ US$", "‏١٢٫٣ ألف US$"], ["￥1,234,567", "￥123.5万"]]
    for (const radius of [30, 40, 51, 64, 96]) {
      for (const [full, compact] of values) {
        for (const caption of [undefined, "Revenue"]) {
          const layout = fitCenter({ full, compact, caption, radius })
          if (layout) expect(fits(layout, radius), `${full} r=${radius}`).toBe(true)
        }
      }
    }
  })
})
