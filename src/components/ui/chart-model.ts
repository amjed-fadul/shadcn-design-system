/**
 * Closed chart model: validates Chart props, assigns governed colours and derives the
 * value formatters, value scale, accessible summary and data table. It has no React or
 * Recharts dependency, so every rule is testable on its own.
 */

import { normalize, tickLabels, valueExtent, valueScale } from "@/components/ui/chart-scale"

export type ChartType = "area" | "bar" | "line" | "donut" | "radial"
export type ChartValueFormat = "number" | "currency" | "percent" | "compact"
export type ChartAspectRatio = "16/9" | "4/3" | "1/1" | "2/1"
export type ChartLayout = "grouped" | "stacked"
export type ChartOrientation = "vertical" | "horizontal"
export type ChartCurve = "linear" | "monotone" | "step"
export type ChartBarSize = "sm" | "md" | "lg"
export type ChartCenterValue = "total" | "none"
export type ChartAnimation = "auto" | "off"
export type ChartDatum = Readonly<Record<string, string | number | null>>
export type ChartSeries = Readonly<{ key: string; label: string }>

export type ChartModelInput = {
  type: ChartType
  title: string
  data: readonly ChartDatum[]
  categoryKey: string
  series?: readonly ChartSeries[]
  valueKey?: string
  layout?: ChartLayout
  orientation?: ChartOrientation
  curve?: ChartCurve
  valueFormat?: ChartValueFormat
  currency?: string
  height?: number
  aspectRatio?: ChartAspectRatio
  locale?: string
  barSize?: ChartBarSize
  valueMin?: number
  valueMax?: number
  centerValue?: ChartCenterValue
  centerLabel?: string
  // Display options, validated here so every rule lives in one place.
  xAxis?: boolean
  yAxis?: boolean
  grid?: boolean
  legend?: boolean
  animation?: ChartAnimation
}

export type ChartSize = { kind: "height"; height: number } | { kind: "aspect-ratio"; aspectRatio: ChartAspectRatio }
export type ChartModelSeries = { key: string; label: string; color: `var(--chart-${1 | 2 | 3 | 4 | 5})` }
export type ChartValueScale = { domain: [number, number]; ticks: number[]; labels: string[] }

export type ChartModel = {
  type: ChartType
  title: string
  categoryKey: string
  valueKey?: string
  layout: ChartLayout
  orientation: ChartOrientation
  curve: ChartCurve
  valueFormat: ChartValueFormat
  size: ChartSize
  /** Canonical BCP 47 tag every formatter uses; en-US unless a locale was passed. */
  locale: string
  /** Bar charts only; md by default. */
  barSize?: ChartBarSize
  /** Donut and radial charts only; total by default. */
  centerValue?: ChartCenterValue
  /** A non-blank caption for the centre total, donut and radial charts only. */
  centerLabel?: string
  data: ChartDatum[]
  series: ChartModelSeries[]
  total?: number
  /** Area, bar and line charts: the value-axis domain, ticks and their exact labels. */
  valueScale?: ChartValueScale
  format: (value: number) => string
  /** Compact form, offered for the centre total when it is shorter than the full value. */
  formatCompact: (value: number) => string
  /** Value-axis labels: the precision that shows every tick exactly. */
  formatTick: (value: number) => string
  empty: boolean
  summary: string
  table: { columns: string[]; rows: string[][] }
}

export class ChartPropsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChartPropsError"
  }
}

const MAX_SERIES = 5
const CHART_TYPES: readonly ChartType[] = ["area", "bar", "line", "donut", "radial"]
const ASPECT_RATIOS: readonly ChartAspectRatio[] = ["16/9", "4/3", "1/1", "2/1"]
const PART_TO_WHOLE: readonly ChartType[] = ["donut", "radial"]
const VOCABULARIES = {
  layout: ["grouped", "stacked"],
  orientation: ["vertical", "horizontal"],
  curve: ["linear", "monotone", "step"],
  valueFormat: ["number", "currency", "percent", "compact"],
  animation: ["auto", "off"],
  barSize: ["sm", "md", "lg"],
  centerValue: ["total", "none"],
} as const
const BOOLEANS = ["xAxis", "yAxis", "grid", "legend"] as const
const DEFAULT_LOCALE = "en-US"

function fail(message: string): never {
  throw new ChartPropsError(message)
}

// Every formatter is built with a validated, supported tag, so output never depends on the host language.
function resolveLocale(tag: unknown): string {
  const reject = (): never => fail(`Chart locale "${String(tag)}" is not a supported BCP 47 language tag.`)
  if (typeof tag !== "string") return reject()
  let canonical: string | undefined
  try {
    canonical = Intl.getCanonicalLocales(tag)[0]
  } catch {
    return reject()
  }
  if (!canonical || Intl.NumberFormat.supportedLocalesOf(canonical).length !== 1) return reject()
  return canonical
}

function createFormatter(valueFormat: ChartValueFormat, currency: string | undefined, locale: string, compact = false) {
  try {
    const options: Intl.NumberFormatOptions =
      valueFormat === "currency" ? { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: "compact" as const } : {}) }
        : valueFormat === "percent" ? { style: "percent", maximumFractionDigits: 1 }
          : valueFormat === "compact" || compact ? { notation: "compact", maximumFractionDigits: 1 }
            : { maximumFractionDigits: 0 }
    const formatter = new Intl.NumberFormat(locale, options)
    return (value: number) => formatter.format(value)
  } catch (error) {
    if (error instanceof RangeError && valueFormat === "currency") fail("Chart currency must be an ISO 4217 code.")
    throw error
  }
}

function numericValue(datum: ChartDatum, key: string): number | null {
  const value = datum[key]
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`Chart value "${key}" must be a finite number or null.`)
  return value
}

function validateSize(input: ChartModelInput): ChartSize {
  const hasHeight = input.height !== undefined
  const hasRatio = input.aspectRatio !== undefined
  if (hasHeight === hasRatio) fail("Chart needs exactly one of height or aspectRatio.")
  if (hasHeight) {
    if (typeof input.height !== "number" || !Number.isFinite(input.height) || input.height <= 0) fail("Chart height must be a positive number of pixels.")
    return { kind: "height", height: input.height }
  }
  if (!ASPECT_RATIOS.includes(input.aspectRatio!)) fail(`Chart aspectRatio must be one of ${ASPECT_RATIOS.join(", ")}.`)
  return { kind: "aspect-ratio", aspectRatio: input.aspectRatio! }
}

function validateVocabulary(input: ChartModelInput) {
  for (const [prop, values] of Object.entries(VOCABULARIES) as Array<[keyof typeof VOCABULARIES, readonly string[]]>) {
    const value = input[prop]
    if (value !== undefined && !values.includes(value as string)) fail(`Chart ${prop} must be one of ${values.join(", ")}.`)
  }
  for (const prop of BOOLEANS) {
    if (input[prop] !== undefined && typeof input[prop] !== "boolean") fail(`Chart ${prop} must be true or false.`)
  }
  if (input.centerLabel !== undefined && typeof input.centerLabel !== "string") fail("Chart centerLabel must be text.")
}

function categoryLabel(datum: ChartDatum, categoryKey: string): string {
  const value = datum[categoryKey]
  if (typeof value !== "string" && typeof value !== "number") fail(`Chart categoryKey "${categoryKey}" must be present as text or a number in every row.`)
  return String(value)
}

function color(index: number): ChartModelSeries["color"] {
  return `var(--chart-${(index + 1) as 1 | 2 | 3 | 4 | 5})`
}

// Bounds are compared at 12 significant digits, like the data, so data equal to a bound is in range.
type Range = { min?: number; max?: number }

function validateRange(input: ChartModelInput, partToWhole: boolean): Range {
  if (input.valueMin === undefined && input.valueMax === undefined) return {}
  if (partToWhole) fail("Chart valueMin and valueMax apply only to area, bar and line charts.")
  for (const bound of [input.valueMin, input.valueMax]) {
    if (bound !== undefined && (typeof bound !== "number" || !Number.isFinite(bound))) fail("Chart valueMin and valueMax must be finite numbers.")
  }
  const min = input.valueMin === undefined ? undefined : normalize(input.valueMin)
  const max = input.valueMax === undefined ? undefined : normalize(input.valueMax)
  if (min !== undefined && max !== undefined && !(min < max)) fail("Chart valueMin must be below valueMax.")
  // Bars and stacks encode magnitude from zero, so a range that leaves out zero would exaggerate differences.
  if ((input.type === "bar" || input.layout === "stacked") && ((min !== undefined && min > 0) || (max !== undefined && max < 0))) fail("Chart valueMin and valueMax must include zero on bar charts and stacked charts.")
  return { min, max }
}

// Out-of-range data is refused, never clipped. Stacked charts check every running total in series
// order (nulls count as 0), as drawn. Comparisons use 12 significant digits; messages print the raw
// numbers the author supplied, so they never contradict themselves.
function checkDataInRange(range: Range, input: ChartModelInput, stacked: boolean, series: readonly ChartSeries[], columns: ReadonlyArray<ReadonlyArray<number | null>>, categories: readonly string[]) {
  const outside = (value: number) => range.min !== undefined && normalize(value) < range.min ? `below valueMin ${input.valueMin}` : range.max !== undefined && normalize(value) > range.max ? `above valueMax ${input.valueMax}` : undefined
  categories.forEach((category, row) => {
    let running = 0
    series.forEach((entry, index) => {
      const value = columns[index][row]
      if (value === null) return
      if (stacked) {
        running += value
        const where = outside(running)
        if (where) fail(`Chart stack total ${running} at "${category}" is ${where}.`)
      } else {
        const where = outside(value)
        if (where) fail(`Chart value ${value} for "${entry.label}" at "${category}" is ${where}.`)
      }
    })
  })
}

export function createChartModel(input: ChartModelInput): ChartModel {
  if (typeof input.title !== "string" || !input.title.trim()) fail("Chart title must be non-empty text.")
  if (!CHART_TYPES.includes(input.type)) fail(`Chart type must be one of ${CHART_TYPES.join(", ")}.`)
  validateVocabulary(input)
  const size = validateSize(input)
  const locale = resolveLocale(input.locale === undefined ? DEFAULT_LOCALE : input.locale)
  const partToWhole = PART_TO_WHOLE.includes(input.type)
  const data = [...input.data]
  const categories = data.map((datum) => categoryLabel(datum, input.categoryKey))

  if (partToWhole) {
    if (input.series !== undefined) fail("Chart series applies to area, bar and line charts; donut and radial charts use valueKey.")
    if (!input.valueKey) fail("Donut and radial charts need a valueKey.")
  } else {
    if (input.valueKey !== undefined) fail("Chart valueKey applies only to donut and radial charts.")
    if (!input.series || input.series.length === 0) fail("Area, bar and line charts need at least one series.")
    if (input.series.length > MAX_SERIES) fail(`Chart supports at most ${MAX_SERIES} series; fold the rest into "Other" or use small multiples.`)
    const keys = input.series.map((entry) => entry.key)
    if (new Set(keys).size !== keys.length) fail("Chart series keys must not contain duplicates.")
  }
  // Stacked lines read as independent trends, so only areas and bars stack.
  if (input.layout !== undefined && input.type !== "area" && input.type !== "bar") fail("Chart layout applies only to area and bar charts.")
  if (input.curve !== undefined && input.type !== "area" && input.type !== "line") fail("Chart curve applies only to area and line charts.")
  if (input.orientation !== undefined && input.type !== "bar") fail("Chart orientation applies only to bar charts.")
  if (input.barSize !== undefined && input.type !== "bar") fail("Chart barSize applies only to bar charts.")
  // A blank caption counts as absent, the way inspectors clear a field.
  const centerLabel = input.centerLabel?.trim() ? input.centerLabel : undefined
  if (input.centerValue !== undefined && !partToWhole) fail("Chart centerValue applies only to donut and radial charts.")
  if (centerLabel !== undefined && !partToWhole) fail("Chart centerLabel applies only to donut and radial charts.")
  const centerValue = partToWhole ? input.centerValue ?? "total" : undefined
  if (centerLabel !== undefined && centerValue === "none") fail('Chart centerLabel needs centerValue "total".')
  if (input.currency !== undefined && typeof input.currency !== "string") fail("Chart currency must be an ISO 4217 code.")
  if (input.valueFormat === "currency" && !input.currency) fail("Chart valueFormat \"currency\" needs a currency code.")
  if (input.valueFormat !== "currency" && input.currency !== undefined) fail("Chart currency applies only with valueFormat \"currency\".")
  const range = validateRange(input, partToWhole)

  const valueFormat = input.valueFormat ?? "number"
  const format = createFormatter(valueFormat, input.currency, locale)
  const formatCompact = createFormatter(valueFormat, input.currency, locale, true)
  const cell = (value: number | null) => (value === null ? "—" : format(value))
  const options = { locale, valueFormat, size, centerValue, centerLabel: partToWhole ? centerLabel : undefined }

  if (partToWhole) {
    const valueKey = input.valueKey!
    if (data.length > 0 && data.every((datum) => !(valueKey in datum))) fail(`Chart valueKey "${valueKey}" is missing from every row.`)
    if (data.length > MAX_SERIES) fail(`Donut and radial charts support at most ${MAX_SERIES} parts; fold the rest into "Other".`)
    if (new Set(categories).size !== categories.length) fail("Donut and radial categories must not repeat; each part is one row.")
    const values = data.map((datum) => numericValue(datum, valueKey))
    if (values.some((value) => value !== null && value < 0)) fail("Donut and radial values must not be negative.")
    const total = normalize(values.reduce<number>((sum, value) => sum + (value ?? 0), 0))
    const empty = total === 0
    const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })
    const parts = categories.map((category, index) => `${category} ${cell(values[index])}${values[index] === null || empty ? "" : ` (${share.format(values[index]! / total)})`}`)
    return {
      type: input.type, title: input.title, categoryKey: input.categoryKey, valueKey,
      layout: "grouped", orientation: "vertical", curve: "monotone", ...options, data,
      series: categories.map((category, index) => ({ key: category, label: category, color: color(index) })),
      total, format, formatCompact, formatTick: format, empty,
      // The centre caption is drawn aria-hidden, so the summary carries it for screen readers.
      summary: empty ? `${input.title}: no data.` : `${input.title}, ${data.length} parts totalling ${format(total)}${centerValue === "total" && centerLabel ? ` (${centerLabel})` : ""}: ${parts.join(", ")}.`,
      table: { columns: [input.categoryKey, valueKey], rows: categories.map((category, index) => [category, cell(values[index])]) },
    }
  }

  const series = input.series!
  for (const entry of series) {
    if (data.length > 0 && data.every((datum) => !(entry.key in datum))) fail(`Chart series key "${entry.key}" is missing from every row.`)
  }
  const columns = series.map((entry) => data.map((datum) => numericValue(datum, entry.key)))
  const empty = columns.every((values) => values.every((value) => value === null || value === 0))
  const layout = input.layout ?? "grouped"
  const stacked = layout === "stacked"
  // An empty chart shows its empty state, so the range is only checked against real data.
  if (!empty) checkDataInRange(range, input, stacked, series, columns, categories)
  const scale = valueScale(valueExtent(columns, stacked), range)
  const ticks = tickLabels(scale.ticks, { locale, valueFormat, currency: input.currency })
  const clauses = series.map((entry, index) => {
    const present = columns[index].filter((value): value is number => value !== null)
    return present.length === 0 ? `${entry.label} has no values` : `${entry.label} from ${format(Math.min(...present))} to ${format(Math.max(...present))}`
  })
  return {
    type: input.type, title: input.title, categoryKey: input.categoryKey,
    layout, orientation: input.orientation ?? "vertical", curve: input.curve ?? "monotone",
    ...options, barSize: input.type === "bar" ? input.barSize ?? "md" : undefined, data,
    series: series.map((entry, index) => ({ key: entry.key, label: entry.label, color: color(index) })),
    valueScale: { ...scale, labels: ticks.labels },
    format, formatCompact, formatTick: ticks.format, empty,
    summary: empty ? `${input.title}: no data.` : `${input.title}, ${categories[0]} to ${categories[categories.length - 1]}: ${clauses.join("; ")}.`,
    table: {
      columns: [input.categoryKey, ...series.map((entry) => entry.label)],
      rows: categories.map((category, row) => [category, ...columns.map((values) => cell(values[row]))]),
    },
  }
}
