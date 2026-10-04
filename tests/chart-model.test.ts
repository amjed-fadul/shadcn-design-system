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
    expect(createChartModel({ ...base, valueFormat: "currency", currency: "USD" }, "en-US").format(42000)).toBe("$42,000")
    expect(createChartModel({ ...base, valueFormat: "compact" }, "en-US").format(42000)).toBe("42K")
    expect(createChartModel({ ...base, valueFormat: "percent" }, "en-US").format(0.124)).toBe("12.4%")
    expect(createChartModel({ ...base }, "en-US").format(42000.4)).toBe("42,000")
  })

  test("formats axis ticks compactly so they fit the axis", () => {
    expect(createChartModel({ ...base, valueFormat: "currency", currency: "USD" }, "en-US").formatTick(80000)).toBe("$80K")
    expect(createChartModel({ ...base }, "en-US").formatTick(80000)).toBe("80K")
    expect(createChartModel({ ...base, valueFormat: "percent" }, "en-US").formatTick(0.25)).toBe("25%")
  })

  test("summarises range and extremes in one sentence", () => {
    const model = createChartModel({ ...base, valueFormat: "currency", currency: "USD", series: twoSeries }, "en-US")
    expect(model.summary).toBe("Revenue by month, Jan to Mar: 2026 from $42,000 to $55,000; 2025 from $30,000 to $37,000.")
  })

  test("summarises part-to-whole charts by share", () => {
    const plans = [{ plan: "Free", customers: 600 }, { plan: "Pro", customers: 300 }, { plan: "Team", customers: 100 }]
    const model = createChartModel({ type: "donut", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", aspectRatio: "1/1" }, "en-US")
    expect(model.summary).toBe("Customers by plan, 3 parts totalling 1,000: Free 600 (60%), Pro 300 (30%), Team 100 (10%).")
    expect(model.series.map((entry) => [entry.key, entry.color])).toEqual([["Free", "var(--chart-1)"], ["Pro", "var(--chart-2)"], ["Team", "var(--chart-3)"]])
    expect(model.total).toBe(1000)
  })

  test("builds a data table with formatted values", () => {
    const model = createChartModel({ ...base, series: twoSeries }, "en-US")
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
})
