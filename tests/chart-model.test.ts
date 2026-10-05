import { execFileSync } from "node:child_process"
import path from "node:path"
import { describe, expect, test } from "vitest"

import { ChartPropsError, createChartModel, type ChartModelInput } from "../src/components/ui/chart-model"

const revenue = [
  { month: "Jan", thisYear: 42000, lastYear: 30000 },
  { month: "Feb", thisYear: 48000, lastYear: 34000 },
  { month: "Mar", thisYear: 55000, lastYear: 37000 },
]
const base: ChartModelInput = { type: "bar", title: "Revenue by month", data: revenue, categoryKey: "month", height: 240, series: [{ key: "thisYear", label: "2026" }] }
const twoSeries = [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }]

describe("chart model", () => {
  test("assigns chart-1..5 in slot order", () => {
    const model = createChartModel({ ...base, series: twoSeries })
    expect(model.series.map((entry) => entry.color)).toEqual(["var(--chart-1)", "var(--chart-2)"])
  })

  test("rejects a sixth series instead of inventing a colour", () => {
    const series = Array.from({ length: 6 }, (_, index) => ({ key: `s${index}`, label: `S${index}` }))
    const data = [Object.fromEntries([["month", "Jan"], ...series.map((entry) => [entry.key, 1])])]
    expect(() => createChartModel({ ...base, data, series })).toThrow(ChartPropsError)
    expect(() => createChartModel({ ...base, data, series })).toThrow(/at most 5 series/)
  })

  test.each<[string, Partial<ChartModelInput>, RegExp]>([
    ["no size", { height: undefined, aspectRatio: undefined }, /exactly one of height or aspectRatio/],
    ["both sizes", { height: 240, aspectRatio: "16/9" }, /exactly one of height or aspectRatio/],
    ["non-positive height", { height: 0 }, /height/],
    ["missing series key", { series: [{ key: "missing", label: "Missing" }] }, /"missing"/],
    ["missing category key", { categoryKey: "quarter" }, /"quarter"/],
    ["currency without code", { valueFormat: "currency" }, /currency/],
    ["invalid currency code", { valueFormat: "currency", currency: "DOLLARS" }, /ISO 4217/],
    ["blank title", { title: "  " }, /title/],
    ["donut without valueKey", { type: "donut", series: undefined }, /valueKey/],
    ["donut with series", { type: "donut", valueKey: "thisYear" }, /series/],
    ["stacked donut", { type: "donut", series: undefined, valueKey: "thisYear", layout: "stacked" }, /layout/],
    ["stacked lines", { type: "line", layout: "stacked" }, /layout applies only to area and bar/],
    ["repeated donut parts", { type: "donut", series: undefined, valueKey: "thisYear", data: [{ month: "Jan", thisYear: 1 }, { month: "Jan", thisYear: 2 }] }, /categories must not repeat/],
    ["negative donut part", { type: "donut", series: undefined, valueKey: "thisYear", data: [{ month: "Jan", thisYear: 5 }, { month: "Feb", thisYear: -1 }] }, /must not be negative/],
    ["curve on bars", { curve: "step" }, /curve/],
    ["orientation on lines", { type: "line", orientation: "horizontal" }, /orientation/],
    ["no series on bars", { series: [] }, /series/],
    ["duplicate series keys", { series: [{ key: "thisYear", label: "A" }, { key: "thisYear", label: "B" }] }, /duplicate/],
  ])("rejects %s", (_name, patch, message) => {
    expect(() => createChartModel({ ...base, ...patch })).toThrow(message)
  })

  test("rejects non-numeric values but treats null as a gap", () => {
    expect(() => createChartModel({ ...base, data: [{ month: "Jan", thisYear: "42k" }] })).toThrow(/number/)
    const gap = createChartModel({ ...base, data: [{ month: "Jan", thisYear: null }, { month: "Feb", thisYear: 5 }] })
    expect(gap.table.rows).toEqual([["Jan", "—"], ["Feb", "5"]])
    expect(gap.empty).toBe(false)
  })

  test("formats values with named formats", () => {
    expect(createChartModel({ ...base, valueFormat: "currency", currency: "USD", locale: "en-US" }).format(42000)).toBe("$42,000")
    expect(createChartModel({ ...base, valueFormat: "compact", locale: "en-US" }).format(42000)).toBe("42K")
    expect(createChartModel({ ...base, valueFormat: "percent", locale: "en-US" }).format(0.124)).toBe("12.4%")
    expect(createChartModel({ ...base, locale: "en-US" }).format(42000.4)).toBe("42,000")
  })

  test("formats axis ticks compactly so they fit the axis", () => {
    expect(createChartModel({ ...base, valueFormat: "currency", currency: "USD", locale: "en-US" }).formatTick(80000)).toBe("$80K")
    expect(createChartModel({ ...base, locale: "en-US" }).formatTick(80000)).toBe("80K")
    expect(createChartModel({ ...base, valueFormat: "percent", locale: "en-US" }).formatTick(0.25)).toBe("25%")
  })

  test("summarises range and extremes in one sentence", () => {
    const model = createChartModel({ ...base, valueFormat: "currency", currency: "USD", series: twoSeries, locale: "en-US" })
    expect(model.summary).toBe("Revenue by month, Jan to Mar: 2026 from $42,000 to $55,000; 2025 from $30,000 to $37,000.")
  })

  test("summarises part-to-whole charts by share", () => {
    const plans = [{ plan: "Free", customers: 600 }, { plan: "Pro", customers: 300 }, { plan: "Team", customers: 100 }]
    const model = createChartModel({ type: "donut", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", aspectRatio: "1/1", locale: "en-US" })
    expect(model.summary).toBe("Customers by plan, 3 parts totalling 1,000: Free 600 (60%), Pro 300 (30%), Team 100 (10%).")
    expect(model.series.map((entry) => [entry.key, entry.color])).toEqual([["Free", "var(--chart-1)"], ["Pro", "var(--chart-2)"], ["Team", "var(--chart-3)"]])
    expect(model.total).toBe(1000)
  })

  test("builds a data table with formatted values", () => {
    const model = createChartModel({ ...base, series: twoSeries, locale: "en-US" })
    expect(model.table).toEqual({ columns: ["month", "2026", "2025"], rows: [["Jan", "42,000", "30,000"], ["Feb", "48,000", "34,000"], ["Mar", "55,000", "37,000"]] })
  })

  test("reports empty for no rows and for all-zero or all-gap values", () => {
    expect(createChartModel({ ...base, data: [] }).empty).toBe(true)
    expect(createChartModel({ ...base, data: [{ month: "Jan", thisYear: 0 }] }).empty).toBe(true)
    expect(createChartModel({ ...base, data: [{ month: "Jan", thisYear: null }] }).empty).toBe(true)
    expect(createChartModel({ ...base, data: [] }).summary).toBe("Revenue by month: no data.")
  })

  test("applies documented defaults", () => {
    const model = createChartModel({ ...base })
    expect(model).toMatchObject({ layout: "grouped", orientation: "vertical", curve: "monotone", valueFormat: "number", size: { kind: "height", height: 240 } })
    expect(createChartModel({ ...base, height: undefined, aspectRatio: "16/9" }).size).toEqual({ kind: "aspect-ratio", aspectRatio: "16/9" })
  })

  test("formats in en-US unless a locale is passed, and canonicalises the tag", () => {
    expect(createChartModel({ ...base }).locale).toBe("en-US")
    expect(createChartModel({ ...base }).format(42000)).toBe("42,000")
    expect(createChartModel({ ...base, locale: "de-DE" }).format(42000)).toBe("42.000")
    expect(createChartModel({ ...base, locale: "en-us" }).locale).toBe("en-US")
    expect(createChartModel({ ...base, locale: "de-DE", valueFormat: "currency", currency: "EUR" }).summary).toMatch(/42\.000\s€/u)
  })

  test("builds every formatter with en-US when no locale is passed", () => {
    const Original = Intl.NumberFormat
    const locales: unknown[] = []
    const recording = Object.assign(function NumberFormat(tag?: string | string[], options?: Intl.NumberFormatOptions) {
      locales.push(tag)
      return new Original(tag, options)
    }, { supportedLocalesOf: Original.supportedLocalesOf })
    Intl.NumberFormat = recording as unknown as typeof Intl.NumberFormat
    try {
      createChartModel({ ...base, valueFormat: "currency", currency: "USD", series: twoSeries })
      createChartModel({ type: "donut", title: "Plans", data: [{ plan: "Free", n: 1 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" })
      expect(locales.length).toBeGreaterThan(0)
      expect(new Set(locales)).toEqual(new Set(["en-US"]))
    } finally {
      Intl.NumberFormat = Original
    }
  })

  test("still formats in en-US when the host's default locale is German", () => {
    const root = path.resolve(import.meta.dirname, "..")
    const script = `
      const { runnerImport } = await import(${JSON.stringify(path.join(root, "node_modules/vite/dist/node/index.js"))});
      const { module } = await runnerImport(${JSON.stringify(path.join(root, "src/components/ui/chart-model.ts"))}, { configFile: false, resolve: { alias: { "@": ${JSON.stringify(path.join(root, "src"))} } } });
      const model = module.createChartModel({ type: "bar", title: "T", data: [{ m: "Jan", v: 42000 }], categoryKey: "m", series: [{ key: "v", label: "V" }], height: 100 });
      console.log(JSON.stringify({ host: new Intl.NumberFormat().resolvedOptions().locale, value: model.format(42000) }));`
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, encoding: "utf8", env: { ...process.env, LC_ALL: "de_DE.UTF-8", LANG: "de_DE.UTF-8" } })
    const result = JSON.parse(output.trim().split("\n").pop()!)
    expect(result.host).toBe("de-DE")
    expect(result.value).toBe("42,000")
  }, 60000)

  test.each<[string, unknown]>([["und", "und"], ["zz", "zz"], ["empty", ""], ["a number", 1], ["null", null], ["malformed", "en_US"]])("rejects the locale %s", (_name, locale) => {
    expect(() => createChartModel({ ...base, locale } as unknown as ChartModelInput)).toThrow(/is not a supported BCP 47 language tag/)
  })

  test("defaults barSize to md on bar charts only, and checks it", () => {
    expect(createChartModel({ ...base }).barSize).toBe("md")
    expect(createChartModel({ ...base, barSize: "lg" }).barSize).toBe("lg")
    expect(createChartModel({ ...base, type: "line" }).barSize).toBeUndefined()
    expect(() => createChartModel({ ...base, type: "line", barSize: "sm" })).toThrow("Chart barSize applies only to bar charts.")
    expect(() => createChartModel({ ...base, barSize: "xl" } as unknown as ChartModelInput)).toThrow("Chart barSize must be one of sm, md, lg.")
  })

  test("defaults centerValue to total on donut and radial charts, and checks the centre rules", () => {
    const plans = { type: "donut" as const, title: "Plans", data: [{ plan: "Free", n: 1 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" as const }
    expect(createChartModel(plans)).toMatchObject({ centerValue: "total", centerLabel: undefined })
    expect(createChartModel({ ...plans, type: "radial", centerLabel: "Customers" })).toMatchObject({ centerValue: "total", centerLabel: "Customers" })
    expect(createChartModel({ ...plans, centerValue: "none" }).centerValue).toBe("none")
    expect(createChartModel({ ...base }).centerValue).toBeUndefined()
    expect(() => createChartModel({ ...base, centerValue: "total" })).toThrow("Chart centerValue applies only to donut and radial charts.")
    expect(() => createChartModel({ ...base, centerLabel: "Revenue" })).toThrow("Chart centerLabel applies only to donut and radial charts.")
    expect(() => createChartModel({ ...plans, centerValue: "none", centerLabel: "Customers" })).toThrow('Chart centerLabel needs centerValue "total".')
    expect(() => createChartModel({ ...plans, centerValue: "hide" } as unknown as ChartModelInput)).toThrow("Chart centerValue must be one of total, none.")
    // A blank caption counts as absent, the way Canvas inspectors clear a field.
    expect(createChartModel({ ...base, centerLabel: "  " }).centerLabel).toBeUndefined()
    expect(createChartModel({ ...plans, centerValue: "none", centerLabel: "" }).centerLabel).toBeUndefined()
  })

  test.each<[string, Record<string, unknown>, string]>([
    ["layout", { layout: "stack" }, "Chart layout must be one of grouped, stacked."],
    ["orientation", { orientation: "sideways" }, "Chart orientation must be one of vertical, horizontal."],
    ["curve", { type: "line", curve: "smooth" }, "Chart curve must be one of linear, monotone, step."],
    ["valueFormat", { valueFormat: "money" }, "Chart valueFormat must be one of number, currency, percent, compact."],
    ["animation", { animation: "on" }, "Chart animation must be one of auto, off."],
    ["xAxis", { xAxis: "yes" }, "Chart xAxis must be true or false."],
    ["legend", { legend: 1 }, "Chart legend must be true or false."],
    ["centerLabel", { type: "donut", series: undefined, valueKey: "thisYear", centerLabel: 5 }, "Chart centerLabel must be text."],
  ])("checks the %s vocabulary", (_name, patch, message) => {
    expect(() => createChartModel({ ...base, ...patch } as unknown as ChartModelInput)).toThrow(message)
  })

  test.each<[string, Record<string, unknown>, string]>([
    ["range on a donut", { type: "donut", series: undefined, valueKey: "thisYear", valueMax: 10 }, "Chart valueMin and valueMax apply only to area, bar and line charts."],
    ["a non-finite bound", { type: "line", valueMin: Number.NaN }, "Chart valueMin and valueMax must be finite numbers."],
    ["a string bound", { type: "line", valueMax: "100" }, "Chart valueMin and valueMax must be finite numbers."],
    ["min not below max", { type: "line", valueMin: 5, valueMax: 5 }, "Chart valueMin must be below valueMax."],
    ["a raised minimum on bars", { valueMin: 10 }, "Chart valueMin and valueMax must include zero on bar charts and stacked charts."],
    ["a negative maximum on bars", { valueMax: -10 }, "Chart valueMin and valueMax must include zero on bar charts and stacked charts."],
    ["a raised minimum on a stacked area", { type: "area", layout: "stacked", valueMin: 10 }, "Chart valueMin and valueMax must include zero on bar charts and stacked charts."],
    ["a value below valueMin", { type: "line", valueMin: 45000 }, 'Chart value 42000 for "2026" at "Jan" is below valueMin 45000.'],
    ["a value above valueMax", { type: "line", valueMax: 50000 }, 'Chart value 55000 for "2026" at "Mar" is above valueMax 50000.'],
    ["a stack total above valueMax", { layout: "stacked", series: twoSeries, valueMax: 80000 }, 'Chart stack total 82000 at "Feb" is above valueMax 80000.'],
  ])("rejects %s with an exact message", (_name, patch, message) => {
    expect(() => createChartModel({ ...base, ...patch } as unknown as ChartModelInput)).toThrow(message)
  })

  test("accepts data equal to a bound with more than 12 significant digits, and rounds bounds before ordering them", () => {
    const thirds = [{ month: "Jan", thisYear: 2 / 3 }, { month: "Feb", thisYear: 1 / 3 }]
    expect(() => createChartModel({ ...base, type: "line", data: thirds, valueMax: 2 / 3, valueMin: 1 / 3 })).not.toThrow()
    expect(() => createChartModel({ ...base, type: "line", valueMin: 0.3, valueMax: 0.1 + 0.2 })).toThrow("Chart valueMin must be below valueMax.")
  })

  test.each<[string, Record<string, string | number | null>[], Record<string, unknown>, string]>([
    ["an intermediate dip in a mixed-sign stack", [{ month: "Jan", a: 100, b: -150, c: 100 }], { valueMin: -40 }, 'Chart stack total -50 at "Jan" is below valueMin -40.'],
    ["an all-negative stack", [{ month: "Jan", a: -50, b: -30, c: 0 }], { valueMin: -60 }, 'Chart stack total -80 at "Jan" is below valueMin -60.'],
    ["a stack with a null in the middle", [{ month: "Jan", a: 60, b: null, c: 50 }], { valueMax: 100 }, 'Chart stack total 110 at "Jan" is above valueMax 100.'],
  ])("checks running stack totals: %s", (_name, data, range, message) => {
    const series = [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }]
    expect(() => createChartModel({ ...base, data, series, layout: "stacked", ...range } as unknown as ChartModelInput)).toThrow(message)
  })

  test("checks that currency is text", () => {
    expect(() => createChartModel({ ...base, valueFormat: "currency", currency: ["USD"] } as unknown as ChartModelInput)).toThrow("Chart currency must be an ISO 4217 code.")
  })

  test("names the centre caption in the summary, so screen readers hear it", () => {
    const plans = { type: "donut" as const, title: "Plans", data: [{ plan: "Free", n: 600 }, { plan: "Pro", n: 400 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" as const }
    expect(createChartModel({ ...plans, centerLabel: "Customers" }).summary).toBe("Plans, 2 parts totalling 1,000 (Customers): Free 600 (60%), Pro 400 (40%).")
    expect(createChartModel({ ...plans }).summary).toBe("Plans, 2 parts totalling 1,000: Free 600 (60%), Pro 400 (40%).")
  })

  test("compares float stack totals at 12 significant digits", () => {
    const shares = [{ q: "Q1", a: 0.33, b: 0.56, c: 0.11 }]
    const series = [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }]
    const model = createChartModel({ type: "bar", title: "Share", data: shares, categoryKey: "q", series, layout: "stacked", valueFormat: "percent", valueMax: 1, height: 200 })
    expect(model.valueScale?.ticks).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(createChartModel({ type: "bar", title: "Share", data: shares, categoryKey: "q", series, layout: "stacked", valueFormat: "percent", height: 200 }).valueScale?.domain).toEqual([0, 1])
  })

  test("lets an empty chart win over the range check", () => {
    expect(createChartModel({ ...base, type: "line", valueMin: 30000, data: [{ month: "Jan", thisYear: 0 }] }).empty).toBe(true)
  })

  test("derives the value scale and exact tick labels (the rerun case)", () => {
    const rerun = [31000, 36000, 34000, 41000, 39000, 48000].map((value, index) => ({ month: `M${index + 1}`, revenue: value }))
    const model = createChartModel({ type: "line", title: "Revenue", data: rerun, categoryKey: "month", series: [{ key: "revenue", label: "Revenue" }], valueFormat: "currency", currency: "USD", valueMin: 30000, height: 200 })
    expect(model.valueScale).toEqual({ domain: [30000, 50000], ticks: [30000, 35000, 40000, 45000, 50000], labels: ["$30K", "$35K", "$40K", "$45K", "$50K"] })
    expect(createChartModel({ type: "donut", title: "Plans", data: [{ plan: "Free", n: 1 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" }).valueScale).toBeUndefined()
  })

  test("offers a compact form for the centre total", () => {
    const plans = { type: "donut" as const, title: "Plans", data: [{ plan: "Free", n: 12345 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" as const, valueFormat: "currency" as const, currency: "USD" }
    expect(createChartModel(plans).formatCompact(12345)).toBe("$12.3K")
    expect(createChartModel({ ...plans, locale: "en-GB" }).format(12345)).toBe("US$12,345")
  })
})

