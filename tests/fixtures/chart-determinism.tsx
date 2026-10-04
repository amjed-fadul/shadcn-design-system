import * as React from "react"
import { createRoot } from "react-dom/client"
import "../../src/index.css"
import type { ChartProps } from "../../src/package/charts"

// Load the chart the way Canvas does: lazily, through the public charts entry.
const Chart = React.lazy(() => import("../../src/package/charts").then((module) => ({ default: module.Chart })))

const revenue = [
  { month: "Jan", thisYear: 42000, lastYear: 30000 },
  { month: "Feb", thisYear: 48000, lastYear: 34000 },
  { month: "Mar", thisYear: 45000, lastYear: 37000 },
  { month: "Apr", thisYear: 61000, lastYear: 41000 },
  { month: "May", thisYear: 58000, lastYear: 44000 },
  { month: "Jun", thisYear: 72000, lastYear: 47000 },
]
const plans = [
  { plan: "Free", customers: 620 },
  { plan: "Pro", customers: 310 },
  { plan: "Team", customers: 140 },
  { plan: "Enterprise", customers: 60 },
]
const yearSeries = [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }]
const cartesian = { title: "Revenue by month", data: revenue, categoryKey: "month", series: yearSeries, valueFormat: "currency", currency: "USD", height: 260 } as const
const partToWhole = { title: "Customers by plan", data: plans, categoryKey: "plan", valueKey: "customers", aspectRatio: "1/1" } as const

const charts: Record<string, ChartProps> = {
  bar: { ...cartesian, type: "bar" },
  "bar-stacked": { ...cartesian, type: "bar", layout: "stacked" },
  "bar-horizontal": { ...cartesian, type: "bar", orientation: "horizontal", series: [yearSeries[0]] },
  area: { ...cartesian, type: "area" },
  "area-stacked": { ...cartesian, type: "area", layout: "stacked" },
  line: { ...cartesian, type: "line", curve: "step" },
  donut: { ...partToWhole, type: "donut", centerLabel: "Customers" },
  radial: { ...partToWhole, type: "radial" },
}

const query = new URLSearchParams(location.search)
document.documentElement.classList.toggle("dark", query.get("theme") === "dark")
const props = charts[query.get("kind") ?? "bar"]

createRoot(document.getElementById("root")!).render(
  <div className="min-h-screen bg-background p-6">
    <div id="frame" className="w-[480px] rounded-xl border bg-card p-6">
      <React.Suspense fallback={null}><Chart {...props} /></React.Suspense>
    </div>
  </div>,
)
