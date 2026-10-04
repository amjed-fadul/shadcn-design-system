// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import * as charts from "../src/package/charts"

// Start through the public charts entry so a missing export fails as an assertion.
const Chart = (charts as unknown as { Chart: React.ComponentType<Record<string, unknown>> }).Chart

class TestResizeObserver {
  static instances: TestResizeObserver[] = []
  constructor(private readonly callback: ResizeObserverCallback) { TestResizeObserver.instances.push(this) }
  observe() {}
  unobserve() {}
  disconnect() {}
  resize(width: number) {
    this.callback([{ contentRect: { width, height: 0 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

let reducedMotion = false
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  reducedMotion = false
  TestResizeObserver.instances = []
  vi.stubGlobal("ResizeObserver", TestResizeObserver)
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reducedMotion : false, media: query, addEventListener() {}, removeEventListener() {} }))
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const revenue = [
  { month: "Jan", thisYear: 42000, lastYear: 30000 },
  { month: "Feb", thisYear: 48000, lastYear: 34000 },
  { month: "Mar", thisYear: 55000, lastYear: 37000 },
]
const barProps = { type: "bar", title: "Revenue by month", data: revenue, categoryKey: "month", series: [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }], height: 240 }

function render(props: Record<string, unknown>) {
  act(() => root.render(<Chart {...props} />))
  return container
}
function resize(width: number) {
  act(() => { for (const observer of TestResizeObserver.instances) observer.resize(width) })
}
const plot = () => container.querySelector<HTMLElement>('[data-slot="chart-plot"]')!

describe("Chart", () => {
  test("is a figure named by its title and described by a summary and data table", () => {
    render({ ...barProps, valueFormat: "currency", currency: "USD" })
    const figure = container.querySelector('figure[data-slot="chart"]')!
    expect(figure.getAttribute("aria-label")).toBe("Revenue by month")
    expect(figure.getAttribute("data-chart-type")).toBe("bar")
    const description = document.getElementById(figure.getAttribute("aria-describedby")!)!
    expect(description.getAttribute("data-slot")).toBe("chart-description")
    expect(description.textContent).toContain("2026 from")
    expect([...description.querySelectorAll("tbody tr")].map((row) => [...row.children].map((cell) => cell.textContent))).toHaveLength(3)
    expect(description.querySelector("th")?.textContent).toBe("month")
  })

  test("reserves its size before measuring and stays measuring at zero width", () => {
    render(barProps)
    expect(plot().style.height).toBe("240px")
    expect(plot().getAttribute("data-chart-state")).toBe("measuring")
    expect(container.querySelector('[data-slot="chart-skeleton"]')).not.toBeNull()
    resize(0)
    expect(plot().getAttribute("data-chart-state")).toBe("measuring")
  })

  test("sizes by aspect ratio when asked", () => {
    render({ ...barProps, height: undefined, aspectRatio: "16/9" })
    expect(plot().style.aspectRatio).toBe("16 / 9")
  })

  test("is ready right after layout when animation is off", () => {
    render({ ...barProps, animation: "off" })
    resize(600)
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull()
  })

  test("skips animation under reduced motion", () => {
    reducedMotion = true
    render(barProps)
    resize(600)
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
  })

  test("animates by default and signals ready once drawing finishes", () => {
    vi.useFakeTimers()
    render(barProps)
    resize(600)
    expect(plot().getAttribute("data-chart-state")).toBe("drawing")
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
  })

  test("draws again, and only then signals ready, when the data changes", () => {
    vi.useFakeTimers()
    render(barProps)
    resize(600)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    render({ ...barProps, data: revenue.map((row) => ({ ...row, thisYear: row.thisYear * 2 })) })
    expect(plot().getAttribute("data-chart-state")).toBe("drawing")
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    render({ ...barProps, data: revenue.map((row) => ({ ...row, thisYear: row.thisYear * 2 })) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
  })

  test("shows an explicit empty state and still signals ready", () => {
    render({ ...barProps, data: [], animation: "auto" })
    resize(600)
    expect(container.querySelector('[data-slot="chart-empty"]')?.textContent).toBe("No data")
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
  })

  test("colours series only with the governed chart tokens, in slot order", () => {
    render({ ...barProps, animation: "off" })
    resize(600)
    const fills = [...container.querySelectorAll(".recharts-bar")].map((layer) => [...new Set([...layer.querySelectorAll("path")].map((path) => path.getAttribute("fill")))])
    expect(fills).toEqual([["var(--chart-1)"], ["var(--chart-2)"]])
    expect([...container.querySelectorAll('[data-slot="chart-legend-item"] span')].map((swatch) => (swatch as HTMLElement).style.background)).toEqual(["var(--chart-1)", "var(--chart-2)"])
    expect(container.innerHTML.match(/(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()[^"]{0,24}/gi) ?? []).toEqual([])
  })

  test("separates stacked bar segments with a 2px surface gap", () => {
    const strokes = () => [...container.querySelectorAll(".recharts-bar-rectangle path")].map((path) => [path.getAttribute("stroke"), path.getAttribute("stroke-width")])
    render({ ...barProps, layout: "stacked", animation: "off" })
    resize(600)
    expect(new Set(strokes().map(String))).toEqual(new Set(["var(--card),2"]))
    render({ ...barProps, animation: "off" })
    expect(strokes().every(([stroke]) => stroke === null || stroke === "none")).toBe(true)
  })

  test("colours donut parts with the governed chart tokens, in slot order", () => {
    render({ ...barProps, type: "donut", series: undefined, categoryKey: "plan", valueKey: "customers", data: [{ plan: "Free", customers: 600 }, { plan: "Pro", customers: 300 }, { plan: "Team", customers: 100 }], animation: "off" })
    resize(600)
    expect([...container.querySelectorAll(".recharts-pie-sector path")].map((path) => path.getAttribute("fill"))).toEqual(["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"])
    expect(container.innerHTML.match(/(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()[^"]{0,24}/gi) ?? []).toEqual([])
  })

  test("shows a legend for two or more series by default and hides it for one", () => {
    render({ ...barProps, animation: "off" })
    resize(600)
    expect([...container.querySelectorAll('[data-slot="chart-legend-item"]')].map((item) => item.textContent)).toEqual(["2026", "2025"])
    render({ ...barProps, series: [{ key: "thisYear", label: "2026" }], animation: "off" })
    expect(container.querySelector('[data-slot="chart-legend"]')).toBeNull()
  })

  test("draws value ticks at nice steps it chose itself", () => {
    render({ ...barProps, animation: "off" })
    resize(600)
    const ticks = () => [...container.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent?.toUpperCase())
    expect(ticks()).toEqual(["0", "20K", "40K", "60K"])
    render({ ...barProps, layout: "stacked", animation: "off" })
    expect(ticks()).toEqual(["0", "25K", "50K", "75K", "100K"])
  })

  test("fits the centre total to the hole with a token size, and leaves it out when nothing fits", () => {
    const parts = { type: "donut", title: "Revenue by plan", categoryKey: "plan", valueKey: "revenue", aspectRatio: "1/1", animation: "off", valueFormat: "currency", currency: "USD" }
    const centre = () => container.querySelector('[data-slot="chart-center"] text')
    render({ ...parts, data: [{ plan: "Free", revenue: 1130 }] })
    resize(600)
    expect(centre()?.textContent).toBe("$1,130")
    expect(centre()?.getAttribute("class")).toContain("text-2xl")
    render({ ...parts, data: [{ plan: "Free", revenue: 12345678 }] })
    resize(180)
    const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm"]
    expect(sizes.filter((size) => centre()?.getAttribute("class")?.split(" ").includes(size))).toHaveLength(1)
    expect(["$12,345,678", "$12.3M"]).toContain(centre()?.textContent)
    resize(40)
    expect(container.querySelector('[data-slot="chart-center"]')).toBeNull()
  })

  test("leaves the centre out with centerValue none", () => {
    render({ type: "donut", title: "Plans", data: [{ plan: "Free", n: 600 }, { plan: "Pro", n: 300 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1", animation: "off", centerValue: "none" })
    resize(400)
    expect(container.querySelector('[data-slot="chart-center"]')).toBeNull()
  })

  test("sweeps each radial ring by its share of the total, and shows the total", () => {
    const plans = [{ plan: "Free", n: 620 }, { plan: "Pro", n: 310 }, { plan: "Team", n: 140 }, { plan: "Enterprise", n: 60 }]
    render({ type: "radial", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "n", aspectRatio: "1/1", animation: "off", centerLabel: "Customers" })
    resize(600)
    const centre = 300
    // Each sector's outer arc starts at 0° (3 o'clock) and ends at its share of 360°, minus the corner rounding.
    const sweeps = [...container.querySelectorAll(".recharts-radial-bar-sectors path")].map((path) => {
      const arc = [...(path.getAttribute("d") ?? "").matchAll(/A\s*([\d.]+),[\d.]+,0,[01],[01],([\d.]+),([\d.]+)/g)].find((match) => Number(match[1]) > 10)!
      return (Math.atan2(centre - Number(arc[3]), Number(arc[2]) - centre) * 180 / Math.PI + 360) % 360
    })
    const total = 1130
    plans.forEach((part, index) => expect(Math.abs(sweeps[index] - (part.n / total) * 360), part.plan).toBeLessThan(3))
    expect([...container.querySelectorAll('[data-slot="chart-center"] text')].map((text) => text.textContent)).toEqual(["1,130", "Customers"])
  })

  test("packs grouped bars at the bar size, 4px apart", () => {
    const geometry = () => [...container.querySelectorAll(".recharts-bar-rectangle path")].map((path) => ({ width: Number(path.getAttribute("width")), x: Number(path.getAttribute("x")) }))
    for (const [barSize, width] of [["sm", 12], ["md", 24], ["lg", 40]] as const) {
      render({ ...barProps, barSize, animation: "off" })
      resize(600)
      const bars = geometry()
      expect(new Set(bars.map((bar) => bar.width)), barSize).toEqual(new Set([width]))
      // Bars render series by series, so the first bar of series 2 sits beside the first bar of series 1.
      expect(bars[3].x - (bars[0].x + bars[0].width), barSize).toBe(4)
    }
  })

  test("caps single-series bars at the bar size, md by default", () => {
    render({ ...barProps, series: [{ key: "thisYear", label: "2026" }], animation: "off" })
    resize(600)
    expect(new Set([...container.querySelectorAll(".recharts-bar-rectangle path")].map((path) => Number(path.getAttribute("width"))))).toEqual(new Set([24]))
  })

  test("draws value ticks inside an explicit range (the rerun case)", () => {
    const rerun = [31000, 36000, 34000, 41000, 39000, 48000].map((revenue, index) => ({ month: `M${index + 1}`, revenue }))
    render({ type: "line", title: "Revenue", data: rerun, categoryKey: "month", series: [{ key: "revenue", label: "Revenue" }], valueFormat: "currency", currency: "USD", valueMin: 30000, height: 200, animation: "off" })
    resize(600)
    expect([...container.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent)).toEqual(["$30K", "$35K", "$40K", "$45K", "$50K"])
  })

  test("draws a sparkline edge to edge when both axes are hidden", () => {
    render({ type: "area", title: "Weekly revenue", data: revenue, categoryKey: "month", series: [{ key: "thisYear", label: "2026" }], valueMin: 40000, xAxis: false, yAxis: false, grid: false, legend: false, height: 60, animation: "off" })
    resize(240)
    // Only the 8px edge margin is reserved: no room for category labels that are not drawn.
    expect(container.querySelector(".recharts-area-curve")?.getAttribute("d")).toMatch(/^M8,/)
  })

  test("formats ticks in the chart's locale, and in en-US by default", () => {
    const ticks = () => [...container.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent)
    render({ ...barProps, locale: "de-DE", animation: "off" })
    resize(600)
    expect(ticks()).toEqual(["0", "20.000", "40.000", "60.000"])
    render({ ...barProps, animation: "off" })
    expect(ticks()).toEqual(["0", "20K", "40K", "60K"])
  })

  test.each<[string, Record<string, unknown>]>([
    ["valueMax", { valueMax: 100000 }],
    ["barSize", { barSize: "lg" }],
    ["locale", { locale: "de-DE" }],
    ["data values that format the same", { data: revenue.map((row) => ({ ...row, thisYear: row.thisYear + 0.4 })) }],
  ])("draws again when only %s changes", (_name, patch) => {
    vi.useFakeTimers()
    render(barProps)
    resize(600)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    render({ ...barProps, ...patch })
    expect(plot().getAttribute("data-chart-state")).toBe("drawing")
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
  })

  test("draws again when only centerValue changes", () => {
    vi.useFakeTimers()
    const donut = { type: "donut", title: "Plans", data: [{ plan: "Free", n: 600 }, { plan: "Pro", n: 300 }], categoryKey: "plan", valueKey: "n", aspectRatio: "1/1" }
    render(donut)
    resize(400)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    render({ ...donut, centerValue: "none" })
    expect(plot().getAttribute("data-chart-state")).toBe("drawing")
  })

  test("is a single keyboard stop", () => {
    render({ ...barProps, animation: "off" })
    resize(600)
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
  })

  test.each([
    ["area", { type: "area", curve: "monotone" }],
    ["line", { type: "line", curve: "step" }],
    ["stacked bar", { type: "bar", layout: "stacked" }],
    ["horizontal bar", { type: "bar", orientation: "horizontal" }],
    ["donut", { type: "donut", data: [{ plan: "Free", customers: 600 }, { plan: "Pro", customers: 300 }], categoryKey: "plan", series: undefined, valueKey: "customers", centerLabel: "Customers" }],
    ["radial", { type: "radial", data: [{ plan: "Free", customers: 600 }, { plan: "Pro", customers: 300 }], categoryKey: "plan", series: undefined, valueKey: "customers" }],
  ])("renders a %s chart", (_name, patch) => {
    render({ ...barProps, ...patch, animation: "off" })
    resize(600)
    expect(plot().getAttribute("data-chart-state")).toBe("ready")
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull()
  })

  test("ignores props outside the closed API", () => {
    render({ ...barProps, className: "size-96", style: { color: "red" }, onClick: () => {}, children: "x", fill: "#ff0000" })
    const figure = container.querySelector('figure[data-slot="chart"]')!
    expect(figure.classList.contains("size-96")).toBe(false)
    expect(figure.hasAttribute("style")).toBe(false)
    expect(container.innerHTML).not.toContain("#ff0000")
  })

  test("rejects invalid combinations with a governed error", () => {
    expect(() => render({ ...barProps, series: undefined })).toThrow(/series/)
  })
})
