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
