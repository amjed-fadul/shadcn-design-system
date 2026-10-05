import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ComponentProps } from "react"
import { expect, userEvent, waitFor } from "storybook/test"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Chart } from "@/components/ui/chart"

type ChartProps = ComponentProps<typeof Chart>

const revenue = [
  { month: "Jan", thisYear: 42000, lastYear: 30000 },
  { month: "Feb", thisYear: 48000, lastYear: 34000 },
  { month: "Mar", thisYear: 45000, lastYear: 37000 },
  { month: "Apr", thisYear: 61000, lastYear: 41000 },
  { month: "May", thisYear: 58000, lastYear: 44000 },
  { month: "Jun", thisYear: 72000, lastYear: 47000 },
]
const channels = [
  { month: "Jan", direct: 186, referral: 80, social: 45 },
  { month: "Feb", direct: 305, referral: 200, social: 98 },
  { month: "Mar", direct: 237, referral: 120, social: 110 },
  { month: "Apr", direct: 173, referral: 190, social: 76 },
  { month: "May", direct: 209, referral: 130, social: 142 },
  { month: "Jun", direct: 214, referral: 140, social: 168 },
]
const plans = [
  { plan: "Free", customers: 620 },
  { plan: "Pro", customers: 310 },
  { plan: "Team", customers: 140 },
  { plan: "Enterprise", customers: 60 },
]
const yearSeries = [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }]
const channelSeries = [{ key: "direct", label: "Direct" }, { key: "referral", label: "Referral" }, { key: "social", label: "Social" }]

const meta = {
  title: "Components/Chart",
  component: Chart,
  args: { type: "bar", title: "Revenue by month", data: revenue, categoryKey: "month", series: yearSeries, valueFormat: "currency", currency: "USD", height: 260 },
  parameters: { controls: { include: ["type", "layout", "orientation", "curve", "valueFormat", "xAxis", "yAxis", "grid", "legend", "animation"] } },
  decorators: [(Story, { parameters }) => <div className={parameters.wide ? "w-full max-w-5xl" : "w-full max-w-2xl"}><Story /></div>],
} satisfies Meta<typeof Chart>
export default meta
type Story = StoryObj<typeof meta>

async function waitForReady(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart-plot"]')?.getAttribute("data-chart-state")).toBe("ready"), { timeout: 3000 })
}

// Ready means drawn: once the chart reports ready, no mark moves by a visible amount. Bars and
// sectors animate their paths, lines their dash pattern and areas a clip rectangle.
async function expectSettledAtReady(canvasElement: HTMLElement) {
  const numbers = (value: string | null) => (value ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const coordinates = () => [
    ...[...canvasElement.querySelectorAll(".recharts-rectangle, .recharts-curve, .recharts-sector")].flatMap((mark) => [...numbers(mark.getAttribute("d")), ...numbers(mark.getAttribute("stroke-dasharray"))]),
    ...[...canvasElement.querySelectorAll("clipPath rect")].flatMap((rect) => [...numbers(rect.getAttribute("width")), ...numbers(rect.getAttribute("height"))]),
  ]
  const atReady = coordinates()
  await new Promise((resolve) => setTimeout(resolve, 600))
  const later = coordinates()
  await expect(later).toHaveLength(atReady.length)
  await expect(Math.max(0, ...later.map((value, index) => Math.abs(value - atReady[index])))).toBeLessThan(0.01)
}

// Every axis and centre label must sit inside its chart surface: the surface clips overflow.
async function expectNoClippedText(canvasElement: HTMLElement) {
  for (const surface of canvasElement.querySelectorAll("svg.recharts-surface")) {
    const bounds = surface.getBoundingClientRect()
    const clipped = [...surface.querySelectorAll("text")].filter((text) => {
      const box = text.getBoundingClientRect()
      return box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5 || box.top < bounds.top - 0.5 || box.bottom > bounds.bottom + 0.5
    })
    await expect(clipped.map((text) => text.textContent)).toEqual([])
  }
}

// The centre total and caption must lie inside the hole: every corner of each text box sits within the
// hole radius, read from the rendered sector paths, and the total's computed size is its token's size.
const CENTER_PX: Record<string, number> = { "text-2xl": 24, "text-xl": 20, "text-lg": 18, "text-base": 16, "text-sm": 14 }
async function expectCentreInsideHole(canvasElement: HTMLElement) {
  await canvasElement.ownerDocument.fonts.ready
  for (const figure of canvasElement.querySelectorAll('figure[data-slot="chart"]')) {
    const centre = figure.querySelector('[data-slot="chart-center"]')
    if (!centre) continue
    const surface = figure.querySelector("svg.recharts-surface") as SVGSVGElement
    const { width, height } = surface.viewBox.baseVal
    // The hole is the smallest arc radius among the sectors around it; the 4px corner arcs are ignored.
    const radii = [...figure.querySelectorAll(".recharts-pie-sector path, path.recharts-radial-bar-background-sector")]
      .flatMap((path) => [...(path.getAttribute("d") ?? "").matchAll(/A\s*([\d.]+)\s*,/g)].map((match) => Number(match[1])).filter((radius) => radius > 10))
    const hole = Math.min(...radii)
    for (const text of centre.querySelectorAll("text")) {
      const box = (text as SVGTextElement).getBBox()
      const farthest = Math.max(...[[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => Math.hypot(x - width / 2, y - height / 2)))
      await expect(farthest, `"${text.textContent}" in ${figure.getAttribute("aria-label")} (hole ${hole.toFixed(1)})`).toBeLessThanOrEqual(hole - 1)
    }
    const total = centre.querySelector("text")!
    const token = [...total.classList].find((name) => name in CENTER_PX)
    await expect(token, `size class on "${total.textContent}"`).toBeDefined()
    await expect(getComputedStyle(total).fontSize).toBe(`${CENTER_PX[token!]}px`)
  }
}

const checkChart: Story["play"] = async ({ canvasElement }) => {
  await waitForReady(canvasElement)
  await expectSettledAtReady(canvasElement)
  const figure = canvasElement.querySelector('figure[data-slot="chart"]')!
  await expect(figure.getAttribute("aria-label")).toBeTruthy()
  const description = canvasElement.ownerDocument.getElementById(figure.getAttribute("aria-describedby")!)!
  await expect(description.querySelector("p")?.textContent).toMatch(/\.$/)
  await expect(description.querySelectorAll("tbody tr").length).toBeGreaterThan(0)
  await expect(canvasElement.querySelectorAll('[tabindex="0"]').length).toBe(1)
  await expect(canvasElement.querySelector("svg.recharts-surface")).not.toBeNull()
  await expectNoClippedText(canvasElement)
  await expectCentreInsideHole(canvasElement)
  // Keyboard: the chart is one tab stop, and arrow keys move the tooltip between data points.
  canvasElement.querySelector<HTMLElement>('[tabindex="0"]')!.focus()
  await userEvent.keyboard("{ArrowRight}")
  await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart-tooltip"]')?.textContent).toBeTruthy())
  // Escape dismisses the tooltip.
  await userEvent.keyboard("{Escape}")
  await waitFor(() => expect(getComputedStyle(canvasElement.querySelector(".recharts-tooltip-wrapper")!).visibility).toBe("hidden"))
}

export const Bar: Story = { play: checkChart }
export const BarStacked: Story = { args: { title: "Visitors by channel", data: channels, series: channelSeries, layout: "stacked", valueFormat: "number", currency: undefined }, play: checkChart }
export const BarHorizontal: Story = { args: { title: "Visitors by channel", data: channels, series: [channelSeries[0]], orientation: "horizontal", valueFormat: "compact", currency: undefined }, play: checkChart }
export const Area: Story = { args: { type: "area", curve: "monotone" }, play: checkChart }
export const AreaStacked: Story = { args: { type: "area", title: "Visitors by channel", data: channels, series: channelSeries, layout: "stacked", valueFormat: "number", currency: undefined }, play: checkChart }
export const Line: Story = { args: { type: "line", curve: "monotone" }, play: checkChart }
export const LineStep: Story = { args: { type: "line", curve: "step", title: "Visitors by channel", data: channels, series: channelSeries, valueFormat: "number", currency: undefined }, play: checkChart }
export const Donut: Story = {
  args: { type: "donut", title: "Customers by plan", data: plans, categoryKey: "plan", series: undefined, valueKey: "customers", centerLabel: "Customers", valueFormat: "number", currency: undefined, height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  play: checkChart,
}
export const Radial: Story = {
  args: { type: "radial", title: "Customers by plan", data: plans, categoryKey: "plan", series: undefined, valueKey: "customers", centerLabel: "Customers", valueFormat: "number", currency: undefined, height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  play: checkChart,
}
const revenueByPlan = [
  { plan: "Free", revenue: 184500 },
  { plan: "Pro", revenue: 612300 },
  { plan: "Team", revenue: 298700 },
  { plan: "Enterprise", revenue: 139067 },
]
const fiveParts = [...plans, { plan: "Partner", customers: 35 }]

// Canvas's case: a currency total in a 180px donut, which overflowed the ring in Release 012.
export const DonutSmall: Story = {
  args: { type: "donut", title: "Revenue by plan", data: revenueByPlan, categoryKey: "plan", series: undefined, valueKey: "revenue", centerLabel: "Revenue", valueFormat: "currency", currency: "USD", height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-[180px]"><Story /></div>],
  play: checkChart,
}
export const RadialSmall: Story = {
  args: { type: "radial", title: "Customers by plan", data: fiveParts, categoryKey: "plan", series: undefined, valueKey: "customers", centerLabel: "Customers", valueFormat: "number", currency: undefined, height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-[180px]"><Story /></div>],
  play: checkChart,
}

// Grouped bars pack at each size with a 4px gap inside each group.
export const BarSizes: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="grid gap-6">
      {(["sm", "md", "lg"] as const).map((barSize) => <Chart key={barSize} {...args} title={`Revenue by month (${barSize})`} barSize={barSize} animation="off" height={200} />)}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect([...canvasElement.querySelectorAll('[data-slot="chart-plot"]')].every((plot) => plot.getAttribute("data-chart-state") === "ready")).toBe(true), { timeout: 3000 })
    // Each size is a maximum: sm and md apply here, and lg is capped by the automatic slot when that is narrower.
    const widths: Record<string, number> = {}
    for (const figure of canvasElement.querySelectorAll('figure[data-slot="chart"]')) {
      const size = figure.getAttribute("aria-label")!.match(/\((\w+)\)/)![1]
      const bars = [...figure.querySelectorAll(".recharts-bar-rectangle path")].map((path) => ({ width: Number(path.getAttribute("width")), x: Number(path.getAttribute("x")) }))
      await expect(new Set(bars.map((bar) => bar.width)).size, size).toBe(1)
      widths[size] = bars[0].width
      await expect(bars[revenue.length].x - (bars[0].x + bars[0].width), size).toBe(4)
    }
    await expect(widths.sm).toBe(12)
    await expect(widths.md).toBe(24)
    await expect(widths.lg).toBeGreaterThan(24)
    await expect(widths.lg).toBeLessThanOrEqual(40)
    await expectNoClippedText(canvasElement)
  },
}

// The rerun case: a revenue line from 31k to 48k that looked flat against zero.
const rerun = [31000, 36000, 34000, 41000, 39000, 48000].map((value, index) => ({ month: revenue[index].month, revenue: value }))
export const LineRaisedMinimum: Story = {
  args: { type: "line", title: "Revenue by month", data: rerun, series: [{ key: "revenue", label: "Revenue" }], valueMin: 30000 },
  play: async (context) => {
    await checkChart(context)
    const ticks = [...context.canvasElement.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent)
    await expect(ticks).toEqual(["$30K", "$35K", "$40K", "$45K", "$50K"])
  },
}

// A KPI sparkline: no axes, grid or legend, and a raised minimum so the trend is visible.
export const Sparkline: Story = {
  args: { type: "area", title: "Weekly revenue", data: rerun, series: [{ key: "revenue", label: "Revenue" }], valueMin: 30000, xAxis: false, yAxis: false, grid: false, legend: false, height: 60 },
  decorators: [(Story) => <div className="w-48"><Story /></div>],
  play: async ({ canvasElement }) => {
    await waitForReady(canvasElement)
    await expectSettledAtReady(canvasElement)
    await expectNoClippedText(canvasElement)
    await expect(canvasElement.querySelectorAll(".recharts-cartesian-axis-tick-value")).toHaveLength(0)
  },
}

export const LocaleGerman: Story = {
  args: { locale: "de-DE", currency: "EUR" },
  play: async (context) => {
    await checkChart(context)
    const ticks = [...context.canvasElement.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map((tick) => tick.textContent ?? "")
    await expect(ticks.at(-1)).toMatch(/^80\.000\s€$/u)
  },
}
export const LocaleJapanese: Story = {
  args: { type: "line", locale: "ja-JP", currency: "JPY", data: revenue.map((row) => ({ ...row, thisYear: row.thisYear * 150, lastYear: row.lastYear * 150 })) },
  play: checkChart,
}
export const LocaleArabic: Story = {
  args: { type: "donut", title: "Revenue by plan", locale: "ar", data: revenueByPlan, categoryKey: "plan", series: undefined, valueKey: "revenue", centerLabel: "Revenue", height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-[220px]"><Story /></div>],
  play: checkChart,
}

// #22's criterion: the centre stays inside its hole down to a 160px plot, for every value format.
const centreTotals: Array<{ name: string; props: Partial<ChartProps>; value: number }> = [
  { name: "en-US USD millions", props: { valueFormat: "currency", currency: "USD" }, value: 1234567 },
  { name: "en-GB USD", props: { valueFormat: "currency", currency: "USD", locale: "en-GB" }, value: 12345 },
  { name: "de-DE EUR", props: { valueFormat: "currency", currency: "EUR", locale: "de-DE" }, value: 123456 },
  { name: "ja-JP JPY", props: { valueFormat: "currency", currency: "JPY", locale: "ja-JP" }, value: 1234567 },
  { name: "ar USD", props: { valueFormat: "currency", currency: "USD", locale: "ar" }, value: 12345 },
  { name: "percent", props: { valueFormat: "percent" }, value: 1 },
  { name: "number", props: { valueFormat: "number" }, value: 1130 },
  { name: "compact", props: { valueFormat: "compact" }, value: 987654321 },
]
export const CenterFit: Story = {
  parameters: { controls: { disable: true }, wide: true },
  render: () => (
    <div className="flex flex-wrap items-start gap-3">
      {[160, 180, 220, 320].flatMap((size) => (["donut", "radial"] as const).flatMap((type) => centreTotals.flatMap((total) => [undefined, "Revenue"].map((caption) => (
        <div key={`${size}-${type}-${total.name}-${caption}`} style={{ width: size }}>
          <Chart
            type={type} title={`${type} ${size}px ${total.name}${caption ? " with caption" : ""}`} categoryKey="part" valueKey="value" aspectRatio="1/1" legend={false} animation="off"
            data={[{ part: "A", value: total.value * 0.6 }, { part: "B", value: total.value * 0.4 }]} centerLabel={caption} {...total.props}
          />
        </div>
      )))))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect([...canvasElement.querySelectorAll('[data-slot="chart-plot"]')].every((plot) => plot.getAttribute("data-chart-state") === "ready")).toBe(true), { timeout: 10000 })
    await expectCentreInsideHole(canvasElement)
    await expectNoClippedText(canvasElement)
    // The fit hides the total only where nothing fits; at 320px every total shows.
    const large = [...canvasElement.querySelectorAll('figure[data-slot="chart"]')].filter((figure) => figure.getAttribute("aria-label")!.includes(" 320px "))
    await expect(large.every((figure) => figure.querySelector('[data-slot="chart-center"]'))).toBe(true)
  },
}

export const Empty: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    await waitForReady(canvasElement)
    await expect(canvasElement.querySelector('[data-slot="chart-empty"]')?.textContent).toBe("No data")
  },
}
export const Rtl: Story = {
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
  play: checkChart,
}

const gallery: Array<{ name: string; description: string; props: ChartProps }> = [
  { name: "Area", description: "Gradient fill, monotone curve", props: { type: "area", title: "Revenue by month", data: revenue, categoryKey: "month", series: yearSeries, valueFormat: "compact", height: 200 } },
  { name: "Bar", description: "Grouped, rounded data ends", props: { type: "bar", title: "Revenue by month", data: revenue, categoryKey: "month", series: yearSeries, valueFormat: "compact", height: 200 } },
  { name: "Bar stacked", description: "Three channels", props: { type: "bar", title: "Visitors by channel", data: channels, categoryKey: "month", series: channelSeries, layout: "stacked", height: 200 } },
  { name: "Line", description: "Two series, active dot on hover", props: { type: "line", title: "Revenue by month", data: revenue, categoryKey: "month", series: yearSeries, valueFormat: "compact", height: 200 } },
  { name: "Donut", description: "Part to whole with total", props: { type: "donut", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", centerLabel: "Customers", height: 220 } },
  { name: "Radial", description: "Share of total, with total", props: { type: "radial", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", centerLabel: "Customers", height: 220 } },
]

export const Gallery: Story = {
  parameters: { controls: { disable: true }, wide: true },
  render: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {gallery.map((entry) => (
        <Card key={entry.name}>
          <CardHeader>
            <CardTitle>{entry.name}</CardTitle>
            <CardDescription>{entry.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Chart {...entry.props} animation="off" />
          </CardContent>
        </Card>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect([...canvasElement.querySelectorAll('[data-slot="chart-plot"]')].every((plot) => plot.getAttribute("data-chart-state") === "ready")).toBe(true), { timeout: 3000 })
    await expectNoClippedText(canvasElement)
    await expectCentreInsideHole(canvasElement)
  },
}
