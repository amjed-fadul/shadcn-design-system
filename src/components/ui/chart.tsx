import * as React from "react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, Tooltip, XAxis, YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import {
  createChartModel,
  type ChartAspectRatio, type ChartCurve, type ChartLayout, type ChartModel,
  type ChartOrientation, type ChartType, type ChartValueFormat,
} from "@/components/ui/chart-model"

// Data and series are written out structurally, not through aliases, so the contract's
// type text states the exact JSON shape an author supplies.
type ChartProps = {
  type: ChartType
  title: string
  data: ReadonlyArray<Readonly<Record<string, string | number | null>>>
  categoryKey: string
  series?: ReadonlyArray<Readonly<{ key: string; label: string }>>
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

// Series colours come only from the governed chart tokens, in slot order: the model
// assigns var(--chart-1) to var(--chart-5) and marks use those values directly.
const ANIMATION_MS = 400
// Frames of unchanged marks that count as finished, and the most frames to wait for them.
const SETTLED_FRAMES = 2
const MAX_SETTLE_FRAMES = 180
const RATIOS: Record<ChartAspectRatio, number> = { "16/9": 16 / 9, "4/3": 4 / 3, "1/1": 1, "2/1": 2 }
const AXIS_TICK = { className: "text-xs tabular-nums", fill: "var(--muted-foreground)" }
// Label room comes from the longest label at the 12px tick size (a generous 0.63em per
// glyph), so it is deterministic in headless capture and never waits for the web font.
// Recharts offsets each tick label by its tick size (6) and tick margin (8) even with
// tick lines off.
const TICK_GLYPH_PX = 7.6
const TICK_OFFSET_PX = 6 + 8
const TICK_SLACK_PX = 2
const EDGE_PX = 8
const VALUE_TICK_COUNT = 5

function labelWidth(labels: readonly string[]): number {
  return Math.ceil(Math.max(0, ...labels.map((label) => label.length)) * TICK_GLYPH_PX)
}

function axisWidth(labels: readonly string[]): number {
  return labelWidth(labels) + TICK_OFFSET_PX + TICK_SLACK_PX
}

// Room for a label centred on the plot edge, as the first and last ticks are.
function edgeRoom(labels: readonly string[]): number {
  return Math.max(EDGE_PX, Math.ceil(labelWidth(labels) / 2) + TICK_SLACK_PX)
}

// The value ticks are chosen here at nice steps (1, 2, 2.5 or 5 times a power
// of ten), so the axis is sized from exactly the labels it draws.
function valueTicks(model: ChartModel): number[] {
  const [min, max] = valueExtent(model)
  const raw = (max - min || 1) / (VALUE_TICK_COUNT - 1)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5].find((nice) => raw <= nice * power) ?? 10) * power
  const first = Math.floor(min / step)
  const last = Math.max(Math.ceil(max / step), first + 1)
  return Array.from({ length: last - first + 1 }, (_, index) => Number(((first + index) * step).toPrecision(12)))
}

function valueExtent(model: ChartModel): [number, number] {
  const rows = model.data.map((datum) => model.series.map((series) => (typeof datum[series.key] === "number" ? (datum[series.key] as number) : 0)))
  const totals = model.layout === "stacked" ? rows.map((row) => row.reduce((sum, value) => sum + value, 0)) : rows.flat()
  return [Math.min(0, ...totals), Math.max(0, ...totals)]
}

function markGeometry(plot: HTMLElement | null): string {
  if (!plot) return ""
  return [...plot.querySelectorAll(".recharts-rectangle, .recharts-curve, .recharts-sector")].map((mark) => mark.getAttribute("d")).join("|")
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
            <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: model.series[Math.max(index, 0)]?.color }} />
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
    <ul data-slot="chart-legend" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {model.series.map((series) => (
        <li key={series.key} data-slot="chart-legend-item" className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: series.color }} />
          {series.label}
        </li>
      ))}
    </ul>
  )
}

type ChartPlotProps = { model: ChartModel; options: ChartOptions; width: number; height: number; animate: boolean; signature: string }

function ChartPlotContent({ model, options, width, height, animate }: ChartPlotProps) {
  const gradientPrefix = React.useId().replace(/:/g, "")
  // Every mark starts at once and runs for ANIMATION_MS, so the frame knows when drawing ends.
  // Recharts' onAnimationEnd also fires on effect cleanup, so it is not a finished signal.
  const animation = { isAnimationActive: animate, animationBegin: 0, animationDuration: ANIMATION_MS }
  const tooltip = <Tooltip cursor={model.type === "bar" ? { fill: "var(--muted)" } : { stroke: "var(--border)" }} content={<ChartTooltipContent model={model} />} />
  const stacked = model.layout === "stacked"
  const horizontal = model.type === "bar" && model.orientation === "horizontal"
  const grid = options.grid ? <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.5} vertical={horizontal} horizontal={!horizontal} /> : null
  const ticks = valueTicks(model)
  const valueLabels = ticks.map(model.formatTick)
  const categoryLabels = model.table.rows.map((row) => row[0])
  const categoryAxis = { dataKey: model.categoryKey, tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK }
  const valueAxis = { tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK, tickFormatter: model.formatTick, ticks, domain: [ticks[0], ticks[ticks.length - 1]], interval: 0 as const }
  const xAxis = horizontal
    ? <XAxis type="number" {...valueAxis} hide={!options.xAxis} />
    : <XAxis type="category" {...categoryAxis} hide={!options.xAxis} />
  const yAxis = horizontal
    ? <YAxis type="category" {...categoryAxis} width={axisWidth(categoryLabels)} hide={!options.yAxis} />
    : <YAxis type="number" {...valueAxis} width={axisWidth(valueLabels)} hide={!options.yAxis} />
  // Area and line charts put the first and last category on the plot edges; a horizontal
  // bar chart puts its first and last value ticks there.
  const edgeLabels = horizontal ? valueLabels : model.type === "bar" ? [] : categoryLabels
  const margin = { top: EDGE_PX, right: edgeRoom(edgeLabels), bottom: options.xAxis ? 0 : EDGE_PX, left: options.yAxis ? 0 : edgeRoom(horizontal ? valueLabels.slice(0, 1) : edgeLabels) }
  const chart = { width, height, data: model.data as Record<string, unknown>[], accessibilityLayer: true, margin }
  const last = model.series.length - 1

  if (model.type === "bar") {
    // In a stack, a card-coloured stroke leaves a 2px surface gap between segments.
    return (
      <BarChart {...chart} layout={horizontal ? "vertical" : "horizontal"}>
        {grid}{xAxis}{yAxis}{tooltip}
        {model.series.map((series, index) => (
          <Bar
            key={series.key} dataKey={series.key} name={series.label} fill={series.color}
            stroke={stacked ? "var(--card)" : undefined} strokeWidth={stacked ? 2 : undefined}
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
              <stop offset="5%" stopColor={series.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={series.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        {grid}{xAxis}{yAxis}{tooltip}
        {model.series.map((series, index) => (
          <Area
            key={series.key} dataKey={series.key} name={series.label} type={model.curve}
            stroke={series.color} strokeWidth={2} fill={`url(#${gradientPrefix}-${index})`} stackId={stacked ? "stack" : undefined}
            activeDot={{ r: 4, strokeWidth: 2, fill: series.color, stroke: "var(--card)" }} {...animation}
          />
        ))}
      </AreaChart>
    )
  }
  if (model.type === "line") {
    return (
      <LineChart {...chart}>
        {grid}{xAxis}{yAxis}{tooltip}
        {model.series.map((series, index) => (
          <Line
            key={series.key} dataKey={series.key} name={series.label} type={model.curve}
            stroke={series.color} strokeWidth={2} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: series.color, stroke: "var(--card)" }} {...animation}
          />
        ))}
      </LineChart>
    )
  }
  const valueKey = model.valueKey!
  if (model.type === "donut") {
    return (
      <PieChart width={width} height={height} accessibilityLayer>
        {tooltip}
        <Pie
          data={model.data as Record<string, unknown>[]} dataKey={valueKey} nameKey={model.categoryKey}
          innerRadius="60%" outerRadius="80%" paddingAngle={2} cornerRadius={4} stroke="var(--card)" strokeWidth={2} rootTabIndex={-1} {...animation}
        >
          {model.series.map((series) => <Cell key={series.key} fill={series.color} />)}
          <Label
            position="center"
            content={() => (
              // The legend renders outside the plot, so the pie centre is the plot centre.
              <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle">
                <tspan x={width / 2} dy={options.centerLabel ? "-0.4em" : 0} className="fill-foreground text-2xl font-semibold">{model.format(model.total ?? 0)}</tspan>
                {options.centerLabel ? <tspan x={width / 2} dy="1.6em" className="fill-muted-foreground text-xs">{options.centerLabel}</tspan> : null}
              </text>
            )}
          />
        </Pie>
      </PieChart>
    )
  }
  return (
    <RadialBarChart width={width} height={height} data={model.data as Record<string, unknown>[]} innerRadius="30%" outerRadius="100%" accessibilityLayer>
      {tooltip}
      <RadialBar dataKey={valueKey} cornerRadius={4} background={{ fill: "var(--muted)" }} {...animation}>
        {model.series.map((series) => <Cell key={series.key} fill={series.color} />)}
      </RadialBar>
    </RadialBarChart>
  )
}

// Recharts starts a new animation whenever a mark re-renders, so the plot renders again only
// when what it draws changes.
const ChartPlot = React.memo(ChartPlotContent, (previous, next) => previous.signature === next.signature && previous.animate === next.animate)

function ChartFrame({ model, options }: { model: ChartModel; options: ChartOptions }) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  // Ready belongs to what was drawn: any change to the plot size, type, options, series or
  // data starts a new drawing, so a screenshot never captures a chart mid-animation.
  const signature = JSON.stringify([width, options, model.type, model.layout, model.orientation, model.curve, model.valueFormat, model.size, model.series, model.table])
  const [drawnSignature, setDrawnSignature] = React.useState<string | null>(null)
  const drawn = drawnSignature === signature
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
      setDrawnSignature(signature)
      return
    }
    // Recharts lays marks out a render after mount and animates them by time from there, so
    // after ANIMATION_MS the frame watches the marks and reports ready once they draw the
    // same on consecutive frames. The frame cap keeps a chart from waiting forever.
    let frame = 0
    let frames = 0
    let settled = 0
    let previous = markGeometry(plotRef.current)
    const watch = () => {
      const current = markGeometry(plotRef.current)
      settled = current === previous ? settled + 1 : 0
      previous = current
      frames += 1
      if (settled >= SETTLED_FRAMES || frames >= MAX_SETTLE_FRAMES) setDrawnSignature(signature)
      else frame = requestAnimationFrame(watch)
    }
    const timer = setTimeout(() => {
      previous = markGeometry(plotRef.current)
      frame = requestAnimationFrame(watch)
    }, ANIMATION_MS)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [width, animate, drawn, signature])

  const state = width <= 0 ? "measuring" : drawn ? "ready" : "drawing"
  const height = model.size.kind === "height" ? model.size.height : Math.round(width / RATIOS[model.size.aspectRatio])
  const style: React.CSSProperties = model.size.kind === "height" ? { height: model.size.height } : { aspectRatio: model.size.aspectRatio.replace("/", " / ") }

  let content: React.ReactNode
  if (width <= 0) content = <div data-slot="chart-skeleton" aria-hidden className="size-full rounded-lg bg-muted" />
  else if (model.empty) content = <div data-slot="chart-empty" className="flex size-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No data</div>
  else content = <ChartPlot model={model} options={options} width={width} height={height} animate={animate} signature={signature} />

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={plotRef} data-slot="chart-plot" data-chart-state={state} className="relative w-full" style={style}>
        {content}
      </div>
      {options.legend && !model.empty ? <ChartLegendContent model={model} /> : null}
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
