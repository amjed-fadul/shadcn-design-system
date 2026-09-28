/** WCAG 2.x contrast for CSS oklch() colours, via OKLab → linear sRGB (clamped to the sRGB gamut). */

export type LinearRgb = readonly [number, number, number]

const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/

export function parseOklch(value: string): { l: number; c: number; h: number } {
  const match = OKLCH_PATTERN.exec(value.trim())
  if (!match) throw new Error(`Unsupported colour value: ${value}`)
  const lightness = Number(match[1]) / (match[2] === "%" ? 100 : 1)
  return { l: lightness, c: Number(match[3]), h: Number(match[4]) }
}

export function oklchToLinearSrgb(value: string): LinearRgb {
  const { l, c, h } = parseOklch(value)
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ]
  const rgb = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
  return rgb.map((channel) => Math.min(1, Math.max(0, channel))) as unknown as LinearRgb
}

const toGamma = (channel: number) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055)
const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

/** Composites `foreground` at `alpha` over `background` in gamma-encoded sRGB, as browsers do. */
export function composite(foreground: LinearRgb, alpha: number, background: LinearRgb): LinearRgb {
  return foreground.map((channel, index) =>
    toLinear(toGamma(channel) * alpha + toGamma(background[index]) * (1 - alpha)),
  ) as unknown as LinearRgb
}

export function relativeLuminance([r, g, b]: LinearRgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(first: LinearRgb, second: LinearRgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}
