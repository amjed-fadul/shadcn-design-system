/** Colour-vision-deficiency separation for categorical palettes, in OKLab ×100. */

import type { LinearRgb } from "./oklch-contrast"

// Machado, Oliveira & Fernandes (2009) dichromacy transforms at severity 1.0, applied to linear sRGB.
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const

export type Vision = "normal" | keyof typeof MACHADO

export function simulate(rgb: LinearRgb, vision: Vision): LinearRgb {
  if (vision === "normal") return rgb
  return MACHADO[vision].map((row) =>
    Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
  ) as unknown as LinearRgb
}

export function linearSrgbToOklab([r, g, b]: LinearRgb): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Euclidean OKLab distance ×100 between two colours as seen with the given vision. */
export function deltaE(first: LinearRgb, second: LinearRgb, vision: Vision): number {
  const [l1, a1, b1] = linearSrgbToOklab(simulate(first, vision))
  const [l2, a2, b2] = linearSrgbToOklab(simulate(second, vision))
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}
