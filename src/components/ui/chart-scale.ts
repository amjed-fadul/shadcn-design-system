/**
 * Value-axis scale for the closed chart: the data extent, the domain and ticks (nice steps of 1, 2,
 * 2.5 or 5 × 10ⁿ inside any explicit valueMin/valueMax), and tick labels that show every tick
 * exactly. Pure functions with no React or Recharts dependency.
 */

export type ScaleFormat = { locale: string; valueFormat: "number" | "currency" | "percent" | "compact"; currency?: string }
export type ValueScale = { domain: [number, number]; ticks: number[] }

const NICE_FACTORS = [1, 2, 2.5, 5]
const EPSILON = 1e-9
const MAX_STEP_SHRINKS = 8

/** Rounds to 12 significant digits, so float noise such as 0.33 + 0.56 + 0.11 = 1.0000000000000002 reads as 1. */
export function normalize(value: number): number {
  return Number(value.toPrecision(12))
}

/**
 * The value extent, always including zero. For stacked charts it covers every running total in series
 * order (nulls count as 0), which is what Recharts' sequential stacking draws, so mixed-sign stacks are
 * covered too.
 */
export function valueExtent(columns: ReadonlyArray<ReadonlyArray<number | null>>, stacked: boolean): [number, number] {
  let low = 0
  let high = 0
  const rows = Math.max(0, ...columns.map((column) => column.length))
  for (let row = 0; row < rows; row += 1) {
    let running = 0
    for (const column of columns) {
      const value = column[row] ?? null
      if (value === null) continue
      const point = stacked ? normalize((running += value)) : normalize(value)
      low = Math.min(low, point)
      high = Math.max(high, point)
    }
  }
  return [low, high]
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw))
  return (NICE_FACTORS.find((factor) => raw <= factor * power + EPSILON * power) ?? 10) * power
}

function smallerStep(step: number): number {
  const power = 10 ** Math.floor(Math.log10(step) + EPSILON)
  const factor = normalize(step / power)
  const index = NICE_FACTORS.indexOf(factor)
  return index > 0 ? NICE_FACTORS[index - 1] * power : 5 * (power / 10)
}

function multiples(low: number, high: number, step: number): number[] {
  const first = Math.ceil(low / step - EPSILON)
  const last = Math.floor(high / step + EPSILON)
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => normalize((first + index) * step))
}

/**
 * The domain and ticks for a value axis. Explicit bounds are the domain edges exactly; a free bound
 * steps over the span the explicit bound leaves and rounds outward, moving one step beyond an explicit
 * bound it would otherwise equal. With no bounds this is Release 012's tick rule.
 */
export function valueScale(extent: readonly [number, number], bounds: { min?: number; max?: number }): ValueScale {
  const spanLow = bounds.min ?? extent[0]
  const spanHigh = bounds.max ?? extent[1]
  const width = spanHigh - spanLow
  let step = niceStep((width > 0 ? width : Math.abs(spanHigh) || 1) / 4)
  let low = bounds.min ?? normalize(Math.floor(spanLow / step + EPSILON) * step)
  let high = bounds.max ?? normalize(Math.ceil(spanHigh / step - EPSILON) * step)
  if (high <= low) {
    if (bounds.max === undefined) high = normalize(low + step)
    else low = normalize(high - step)
  }
  let ticks = multiples(low, high, step)
  for (let shrink = 0; ticks.length < 2 && shrink < MAX_STEP_SHRINKS; shrink += 1) {
    step = smallerStep(step)
    ticks = multiples(low, high, step)
  }
  if (ticks.length < 2) ticks = [low, high]
  return { domain: [low, high], ticks }
}

function formatter(format: ScaleFormat, options: Intl.NumberFormatOptions, numberingSystem?: string): Intl.NumberFormat {
  const currency = format.valueFormat === "currency" ? { style: "currency" as const, currency: format.currency } : {}
  return new Intl.NumberFormat(format.locale, { ...currency, ...options, ...(numberingSystem ? { numberingSystem } : {}) })
}

// A compact label is exact when its number, scaled by the compact unit, equals the value. The unit is
// the power of ten the value divided by the label's number rounds to, so this works for every locale's
// units (K, Mio., 万, लाख). The label's number is read from a Latin-digit twin of the same formatter.
function compactIsExact(value: number, latin: Intl.NumberFormat): boolean {
  if (value === 0) return true
  const number = Number(latin.formatToParts(value).map((part) => (part.type === "integer" || part.type === "fraction" ? part.value : part.type === "decimal" ? "." : part.type === "minusSign" ? "-" : "")).join(""))
  if (!Number.isFinite(number) || number === 0) return false
  const unit = 10 ** Math.round(Math.log10(Math.abs(value / number)))
  return Math.abs(number * unit - value) <= EPSILON * Math.max(1, Math.abs(value))
}

function decimalsOf(value: number): number {
  let decimals = 0
  while (decimals < 6 && Math.abs(normalize(value * 10 ** decimals) - Math.round(value * 10 ** decimals)) > EPSILON) decimals += 1
  return decimals
}

/**
 * Tick labels that render every tick exactly: compact with 0, 1 or 2 fraction digits when that is
 * exact, otherwise the full format with the ticks' decimal places (percent: 0 to 3 fraction digits).
 * Exact labels are necessarily distinct.
 */
export function tickLabels(ticks: readonly number[], format: ScaleFormat): { labels: string[]; format: (value: number) => string } {
  const pick = (chosen: Intl.NumberFormat) => ({ labels: ticks.map((tick) => chosen.format(tick)), format: (value: number) => chosen.format(value) })
  if (format.valueFormat === "percent") {
    const decimals = Math.min(3, Math.max(0, ...ticks.map((tick) => decimalsOf(normalize(tick * 100)))))
    return pick(formatter(format, { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: decimals }))
  }
  for (let digits = 0; digits <= 2; digits += 1) {
    const options: Intl.NumberFormatOptions = { notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: digits }
    const latin = formatter(format, options, "latn")
    if (ticks.every((tick) => compactIsExact(tick, latin))) return pick(formatter(format, options))
  }
  const decimals = Math.max(0, ...ticks.map(decimalsOf))
  return pick(formatter(format, { minimumFractionDigits: 0, maximumFractionDigits: decimals }))
}
