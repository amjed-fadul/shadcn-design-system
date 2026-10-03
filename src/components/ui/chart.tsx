import * as React from "react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, Tooltip, XAxis, YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import {
  createChartModel,
  type ChartAspectRatio, type ChartCurve, type ChartDatum, type ChartLayout, type ChartModel,
  type ChartOrientation, type ChartSeries, type ChartType, type ChartValueFormat,
} from "@/components/ui/chart-model"

type ChartProps = {
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
  xAxis?: boolean
  yAxis?: boolean
  grid?: boolean
  legend?: boolean
  animation?: "auto" | "off"
  centerLabel?: string
}

type ChartOptions = { xAxis: boolean; yAxis: boolean; grid: boolean; legend: boolean; animation: "auto" | "off"; centerLabel?: string }

// Series colours come only from the governed chart tokens, in slot order. Marks use
// currentColor so the colour is carried by these static, auditable classes.
const SERIES_CLASSES = ["text-chart-1", "text-chart-2", "text-chart-3", "text-chart-4", "text-chart-5"] as const
const ANIMATION_MS = 400
const RATIOS: Record<ChartAspectRatio, number> = { "16/9": 16 / 9, "4/3": 4 / 3, "1/1": 1, "2/1": 2 }
const AXIS_TICK = { className: "fill-muted-foreground text-xs" }

function seriesClass(index: number): string {
  return SERIES_CLASSES[index]
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

type TooltipEntry = { name?: string | number; value?: number | string; dataKey?: string | number; payload?: Record<string, unknown> }

function ChartTooltipContent({ active, payload, label, model }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; model: ChartModel }) {
  if (!active || !payload?.length) return null
  const partToWhole = model.type === "donut" || model.type === "radial"
  return (
    <div data-slot="chart-tooltip" className="grid min-w-32 gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
      {partToWhole ? null : <div className="font-medium">{label}</div>}
      {payload.map((entry) => {
        const key = partToWhole ? String(entry.payload?.[model.categoryKey] ?? entry.name) : String(entry.dataKey)
        const index = model.series.findIndex((series) => series.key === key)
        const value = typeof entry.value === "number" ? model.format(entry.value) : "—"
        return (
          <div key={key} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px] bg-current", seriesClass(Math.max(index, 0)))} />
            <span className="text-muted-foreground">{model.series[index]?.label ?? key}</span>
            <span className="ms-auto font-medium text-foreground tabular-nums">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

function ChartLegendContent({ model }: { model: ChartModel }) {
  return (
    <ul data-slot="chart-legend" className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs text-muted-foreground">
      {model.series.map((series, index) => (
        <li key={series.key} data-slot="chart-legend-item" className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px] bg-current", seriesClass(index))} />
          {series.label}
        </li>
      ))}
    </ul>
  )
}

function ChartPlot({ model, options, width, height, animate, onDrawn }: { model: ChartModel; options: ChartOptions; width: number; height: number; animate: boolean; onDrawn: () => void }) {
  const gradientPrefix = React.useId().replace(/:/g, "")
  const remaining = React.useRef(0)
  remaining.current = model.series.length
  const handleAnimationEnd = () => {
    remaining.current -= 1
    if (remaining.current <= 0) onDrawn()
  }
  const animation = { isAnimationActive: animate, animationDuration: ANIMATION_MS, onAnimationEnd: handleAnimationEnd }
  const tooltip = <Tooltip cursor={model.type === "bar" ? { className: "fill-muted" } : { className: "stroke-border" }} content={<ChartTooltipContent model={model} />} />
  const legend = options.legend ? <Legend content={<ChartLegendContent model={model} />} /> : null
  const stacked = model.layout === "stacked"
  const horizontal = model.type === "bar" && model.orientation === "horizontal"
  const grid = options.grid ? <CartesianGrid className="text-border" stroke="currentColor" strokeDasharray="3 3" strokeOpacity={0.5} vertical={horizontal} horizontal={!horizontal} /> : null
  const categoryAxis = { dataKey: model.categoryKey, tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK }
  const valueAxis = { tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK, tickFormatter: model.format, width: 56 }
  const xAxis = horizontal
    ? <XAxis type="number" {...valueAxis} hide={!options.xAxis} />
    : <XAxis type="category" {...categoryAxis} hide={!options.xAxis} />
  const yAxis = horizontal
    ? <YAxis type="category" {...categoryAxis} width={72} hide={!options.yAxis} />
    : <YAxis type="number" {...valueAxis} hide={!options.yAxis} />
  const chart = { width, height, data: model.data as Record<string, unknown>[], accessibilityLayer: true, margin: { top: 8, right: 8, bottom: 0, left: 0 } }
  const last = model.series.length - 1

  if (model.type === "bar") {
    return (
      <BarChart {...chart} layout={horizontal ? "vertical" : "horizontal"}>
        {grid}{xAxis}{yAxis}{tooltip}{legend}
        {model.series.map((series, index) => (
          <Bar
            key={series.key} dataKey={series.key} name={series.label} className={seriesClass(index)} fill="currentColor"
            stackId={stacked ? "stack" : undefined} {...animation}
            radius={stacked && index !== last ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    )
  }
  if (model.type === "area") {
    return (
      <AreaChart {...chart}>
        <defs>
          {model.series.map((series, index) => (
            <linearGradient key={series.key} id={`${gradientPrefix}-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" className={seriesClass(index)} stopColor="currentColor" stopOpacity={0.4} />
              <stop offset="95%" className={seriesClass(index)} stopColor="currentColor" stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        {grid}{xAxis}{yAxis}{tooltip}{legend}
        {model.series.map((series, index) => (
          <Area
            key={series.key} dataKey={series.key} name={series.label} type={model.curve} className={seriesClass(index)}
            stroke="currentColor" strokeWidth={2} fill={`url(#${gradientPrefix}-${index})`} stackId={stacked ? "stack" : undefined}
            activeDot={{ r: 4, strokeWidth: 2, className: cn(seriesClass(index), "fill-current stroke-card") }} {...animation}
          />
        ))}
      </AreaChart>
    )
  }
  if (model.type === "line") {
    return (
      <LineChart {...chart}>
        {grid}{xAxis}{yAxis}{tooltip}{legend}
        {model.series.map((series, index) => (
          <Line
            key={series.key} dataKey={series.key} name={series.label} type={model.curve} className={seriesClass(index)}
            stroke="currentColor" strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, className: cn(seriesClass(index), "fill-current stroke-card") }} {...animation}
          />
        ))}
      </LineChart>
    )
  }
  const valueKey = model.valueKey!
  if (model.type === "donut") {
    return (
      <PieChart width={width} height={height} accessibilityLayer>
        {tooltip}{legend}
        <Pie
          data={model.data as Record<string, unknown>[]} dataKey={valueKey} nameKey={model.categoryKey}
          innerRadius="60%" outerRadius="80%" paddingAngle={2} cornerRadius={4} className="stroke-card" strokeWidth={2} {...animation}
        >
          {model.series.map((series, index) => <Cell key={series.key} className={seriesClass(index)} fill="currentColor" />)}
          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx = 0, cy = 0 } = (viewBox ?? {}) as { cx?: number; cy?: number }
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={cx} dy={options.centerLabel ? "-0.4em" : 0} className="fill-foreground text-2xl font-semibold">{model.format(model.total ?? 0)}</tspan>
                  {options.centerLabel ? <tspan x={cx} dy="1.6em" className="fill-muted-foreground text-xs">{options.centerLabel}</tspan> : null}
                </text>
              )
            }}
          />
        </Pie>
      </PieChart>
    )
  }
  return (
    <RadialBarChart width={width} height={height} data={model.data as Record<string, unknown>[]} innerRadius="30%" outerRadius="100%" accessibilityLayer>
      {tooltip}{legend}
      <RadialBar dataKey={valueKey} cornerRadius={4} background={{ className: "fill-muted" }} {...animation}>
        {model.series.map((series, index) => <Cell key={series.key} className={seriesClass(index)} fill="currentColor" />)}
      </RadialBar>
    </RadialBarChart>
  )
}

function ChartFrame({ model, options }: { model: ChartModel; options: ChartOptions }) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [drawn, setDrawn] = React.useState(false)
  const animate = options.animation === "auto" && !model.empty && !prefersReducedMotion()

  React.useEffect(() => {
    const node = plotRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (width <= 0 || drawn) return
    if (!animate) {
      setDrawn(true)
      return
    }
    // Recharts reports onAnimationEnd per series; the timer is the backstop when a
    // series has nothing to animate, so headless capture never waits forever.
    const timer = setTimeout(() => setDrawn(true), ANIMATION_MS + 150)
    return () => clearTimeout(timer)
  }, [width, animate, drawn])

  const state = width <= 0 ? "measuring" : drawn ? "ready" : "drawing"
  const height = model.size.kind === "height" ? model.size.height : Math.round(width / RATIOS[model.size.aspectRatio])
  const style: React.CSSProperties = model.size.kind === "height" ? { height: model.size.height } : { aspectRatio: model.size.aspectRatio.replace("/", " / ") }

  let content: React.ReactNode
  if (width <= 0) content = <div data-slot="chart-skeleton" aria-hidden className="size-full rounded-lg bg-muted" />
  else if (model.empty) content = <div data-slot="chart-empty" className="flex size-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No data</div>
  else content = <ChartPlot model={model} options={options} width={width} height={height} animate={animate} onDrawn={() => setDrawn(true)} />

  return (
    <div ref={plotRef} data-slot="chart-plot" data-chart-state={state} className="relative w-full" style={style}>
      {content}
    </div>
  )
}

function ChartDescription({ id, model }: { id: string; model: ChartModel }) {
  return (
    <div id={id} data-slot="chart-description" className="sr-only">
      <p>{model.summary}</p>
      <table>
        <thead>
          <tr>{model.table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>
          {model.table.rows.map((row, index) => (
            <tr key={index}>{row.map((cell, column) => column === 0 ? <th key={column} scope="row">{cell}</th> : <td key={column}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Chart({
  type, title, data, categoryKey, series, valueKey, layout, orientation, curve, valueFormat, currency,
  height, aspectRatio, xAxis = true, yAxis = true, grid = true, legend, animation = "auto", centerLabel,
}: ChartProps) {
  const model = createChartModel({ type, title, data, categoryKey, series, valueKey, layout, orientation, curve, valueFormat, currency, height, aspectRatio })
  const descriptionId = React.useId()
  const options: ChartOptions = { xAxis, yAxis, grid, legend: legend ?? model.series.length > 1, animation, centerLabel }

  return (
    <figure data-slot="chart" data-chart-type={type} aria-label={title} aria-describedby={descriptionId} className="m-0 flex w-full flex-col">
      <ChartFrame model={model} options={options} />
      <ChartDescription id={descriptionId} model={model} />
    </figure>
  )
}

export { Chart }
export type { ChartProps }
