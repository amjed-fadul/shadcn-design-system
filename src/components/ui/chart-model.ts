/**
 * Closed chart model: validates Chart props, assigns governed colours and derives the
 * value formatter, accessible summary and data table. It has no React or Recharts
 * dependency, so every rule is testable on its own.
 */

export type ChartType = "area" | "bar" | "line" | "donut" | "radial"
export type ChartValueFormat = "number" | "currency" | "percent" | "compact"
export type ChartAspectRatio = "16/9" | "4/3" | "1/1" | "2/1"
export type ChartLayout = "grouped" | "stacked"
export type ChartOrientation = "vertical" | "horizontal"
export type ChartCurve = "linear" | "monotone" | "step"
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
}

export type ChartSize = { kind: "height"; height: number } | { kind: "aspect-ratio"; aspectRatio: ChartAspectRatio }
export type ChartModelSeries = { key: string; label: string; color: `var(--chart-${1 | 2 | 3 | 4 | 5})` }

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
  data: ChartDatum[]
  series: ChartModelSeries[]
  total?: number
  format: (value: number) => string
  /** Compact variant for axis ticks, so labels fit a narrow axis. */
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

function fail(message: string): never {
  throw new ChartPropsError(message)
}

function createFormatter(valueFormat: ChartValueFormat, currency: string | undefined, locale: string | undefined, tick = false) {
  try {
    const options: Intl.NumberFormatOptions =
      valueFormat === "currency" ? { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: tick ? 1 : 0, ...(tick ? { notation: "compact" as const } : {}) }
        : valueFormat === "percent" ? { style: "percent", maximumFractionDigits: tick ? 0 : 1 }
          : valueFormat === "compact" || tick ? { notation: "compact", maximumFractionDigits: 1 }
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

function categoryLabel(datum: ChartDatum, categoryKey: string): string {
  const value = datum[categoryKey]
  if (typeof value !== "string" && typeof value !== "number") fail(`Chart categoryKey "${categoryKey}" must be present as text or a number in every row.`)
  return String(value)
}

function color(index: number): ChartModelSeries["color"] {
  return `var(--chart-${(index + 1) as 1 | 2 | 3 | 4 | 5})`
}

export function createChartModel(input: ChartModelInput, locale?: string): ChartModel {
  if (typeof input.title !== "string" || !input.title.trim()) fail("Chart title must be non-empty text.")
  if (!CHART_TYPES.includes(input.type)) fail(`Chart type must be one of ${CHART_TYPES.join(", ")}.`)
  const size = validateSize(input)
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
  if (input.valueFormat === "currency" && !input.currency) fail("Chart valueFormat \"currency\" needs a currency code.")
  if (input.valueFormat !== "currency" && input.currency !== undefined) fail("Chart currency applies only with valueFormat \"currency\".")

  const valueFormat = input.valueFormat ?? "number"
  const format = createFormatter(valueFormat, input.currency, locale)
  const formatTick = createFormatter(valueFormat, input.currency, locale, true)
  const cell = (value: number | null) => (value === null ? "—" : format(value))

  if (partToWhole) {
    const valueKey = input.valueKey!
    if (data.length > 0 && data.every((datum) => !(valueKey in datum))) fail(`Chart valueKey "${valueKey}" is missing from every row.`)
    if (data.length > MAX_SERIES) fail(`Donut and radial charts support at most ${MAX_SERIES} parts; fold the rest into "Other".`)
    const values = data.map((datum) => numericValue(datum, valueKey))
    const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    const empty = total === 0
    const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })
    const parts = categories.map((category, index) => `${category} ${cell(values[index])}${values[index] === null || empty ? "" : ` (${share.format(values[index]! / total)})`}`)
    return {
      type: input.type, title: input.title, categoryKey: input.categoryKey, valueKey,
      layout: "grouped", orientation: "vertical", curve: "monotone", valueFormat, size, data,
      series: categories.map((category, index) => ({ key: category, label: category, color: color(index) })),
      total, format, formatTick, empty,
      summary: empty ? `${input.title}: no data.` : `${input.title}, ${data.length} parts totalling ${format(total)}: ${parts.join(", ")}.`,
      table: { columns: [input.categoryKey, valueKey], rows: categories.map((category, index) => [category, cell(values[index])]) },
    }
  }

  const series = input.series!
  for (const entry of series) {
    if (data.length > 0 && data.every((datum) => !(entry.key in datum))) fail(`Chart series key "${entry.key}" is missing from every row.`)
  }
  const columns = series.map((entry) => data.map((datum) => numericValue(datum, entry.key)))
  const empty = columns.every((values) => values.every((value) => value === null || value === 0))
  const clauses = series.map((entry, index) => {
    const present = columns[index].filter((value): value is number => value !== null)
    return present.length === 0 ? `${entry.label} has no values` : `${entry.label} from ${format(Math.min(...present))} to ${format(Math.max(...present))}`
  })
  return {
    type: input.type, title: input.title, categoryKey: input.categoryKey,
    layout: input.layout ?? "grouped", orientation: input.orientation ?? "vertical", curve: input.curve ?? "monotone",
    valueFormat, size, data,
    series: series.map((entry, index) => ({ key: entry.key, label: entry.label, color: color(index) })),
    format, formatTick, empty,
    summary: empty ? `${input.title}: no data.` : `${input.title}, ${categories[0]} to ${categories[categories.length - 1]}: ${clauses.join("; ")}.`,
    table: {
      columns: [input.categoryKey, ...series.map((entry) => entry.label)],
      rows: categories.map((category, row) => [category, ...columns.map((values) => cell(values[row]))]),
    },
  }
}
