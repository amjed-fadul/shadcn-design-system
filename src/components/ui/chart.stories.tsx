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

// Ready means drawn: once the chart reports ready, no mark moves by a visible amount.
async function expectSettledAtReady(canvasElement: HTMLElement) {
  const coordinates = () => [...canvasElement.querySelectorAll(".recharts-rectangle, .recharts-curve, .recharts-sector")].flatMap((mark) => (mark.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [])
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
  // Keyboard: the chart is one tab stop, and arrow keys move the tooltip between data points.
  canvasElement.querySelector<HTMLElement>('[tabindex="0"]')!.focus()
  await userEvent.keyboard("{ArrowRight}")
  await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart-tooltip"]')?.textContent).toBeTruthy())
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
  args: { type: "radial", title: "Customers by plan", data: plans, categoryKey: "plan", series: undefined, valueKey: "customers", valueFormat: "number", currency: undefined, height: undefined, aspectRatio: "1/1" },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  play: checkChart,
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
  { name: "Radial", description: "Part to whole, radial bars", props: { type: "radial", title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", height: 220 } },
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
  },
}
