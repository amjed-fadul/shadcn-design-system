/**
 * Deterministic text measurement for the closed chart: a per-character advance-width estimate (Geist,
 * weight 600, tabular figures) and the centre-total fit for donut and radial holes. Nothing here waits
 * for the web font, so headless and browser renders choose the same sizes.
 */

export type TextWeight = "regular" | "semibold"
export type CenterSize = "2xl" | "xl" | "lg" | "base" | "sm"
export type CenterLayout = { value: string; size: CenterSize; valueY: number; caption?: string; captionY?: number }

/** The contract's font-size tokens the centre total may use, largest first. */
export const CENTER_SIZE_PX: Record<CenterSize, number> = { "2xl": 24, xl: 20, lg: 18, base: 16, sm: 14 }
export const CAPTION_PX = 12

const SIZES: readonly CenterSize[] = ["2xl", "xl", "lg", "base", "sm"]
const FULL_SIZES: readonly CenterSize[] = ["2xl", "xl", "lg", "base"]
const LINE_BOX = 0.8
const CAPTION_GAP = 0.25
const PADDING_PX = 2
const REGULAR_FACTOR = 0.95

const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩؜\p{M}]/u
const SEPARATOR = /[\s  ,.'’٫٬]/u
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]/u

function advance(character: string): number {
  if (ZERO_WIDTH.test(character)) return 0
  if (WIDE.test(character)) return 1
  if (/\p{Nd}/u.test(character)) return 0.63
  if (SEPARATOR.test(character)) return 0.25
  if (character === "%" || character === "٪") return 0.85
  if (/\p{Sc}/u.test(character)) return 0.78
  if (character === "M" || character === "W") return 0.95
  if (/[A-Z]/.test(character)) return 0.75
  if (/[a-z]/.test(character)) return 0.62
  if (/[\p{P}\p{S}]/u.test(character)) return 0.32
  return 0.8
}

/** Estimated rendered width in pixels. Regular weight is 0.95× semibold. */
export function estimateTextWidth(text: string, fontPx: number, weight: TextWeight = "regular"): number {
  let ems = 0
  for (const character of text) ems += advance(character)
  return ems * fontPx * (weight === "semibold" ? 1 : REGULAR_FACTOR)
}

type Line = { text: string; px: number; weight: TextWeight }

// Stacks the lines centred on the hole and checks each against the chord at its farthest edge.
function place(lines: readonly Line[], radius: number): number[] | null {
  const heights = lines.map((line) => line.px * LINE_BOX)
  const gap = lines.length > 1 ? lines[0].px * CAPTION_GAP : 0
  let top = -(heights.reduce((sum, height) => sum + height, 0) + gap) / 2
  const centres: number[] = []
  for (const [index, line] of lines.entries()) {
    const bottom = top + heights[index]
    const edge = Math.max(Math.abs(top), Math.abs(bottom))
    if (edge >= radius || estimateTextWidth(line.text, line.px, line.weight) / 2 + PADDING_PX > Math.sqrt(radius ** 2 - edge ** 2)) return null
    centres.push((top + bottom) / 2)
    top = bottom + gap
  }
  return centres
}

/**
 * Fits the centre total (and an optional caption) inside a hole of the given radius. It tries the full
 * value from 2xl down to base, then whichever of the full and compact forms is shorter from 2xl down to
 * sm, and returns null (hide) rather than overflow. A caption is kept whenever any candidate fits with
 * it; only then is the total fitted alone.
 */
export function fitCenter(input: { full: string; compact: string; caption?: string; radius: number }): CenterLayout | null {
  const shorter = estimateTextWidth(input.compact, 1, "semibold") < estimateTextWidth(input.full, 1, "semibold") ? input.compact : input.full
  const candidates = [...FULL_SIZES.map((size) => ({ value: input.full, size })), ...SIZES.map((size) => ({ value: shorter, size }))]
  const captions = input.caption ? [input.caption, undefined] : [undefined]
  for (const caption of captions) {
    for (const { value, size } of candidates) {
      const lines: Line[] = [{ text: value, px: CENTER_SIZE_PX[size], weight: "semibold" }]
      if (caption) lines.push({ text: caption, px: CAPTION_PX, weight: "regular" })
      const centres = place(lines, input.radius)
      if (centres) return caption ? { value, size, valueY: centres[0], caption, captionY: centres[1] } : { value, size, valueY: centres[0] }
    }
  }
  return null
}
