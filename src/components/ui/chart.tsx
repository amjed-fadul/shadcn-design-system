import * as React from "react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, Tooltip, XAxis, YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import {
  createChartModel,
  type ChartAspectRatio, type ChartBarSize, type ChartCenterValue, type ChartCurve, type ChartLayout,
  type ChartModel, type ChartOrientation, type ChartType, type ChartValueFormat,
} from "@/components/ui/chart-model"
import { estimateTextWidth, fitCenter } from "@/components/ui/chart-text"

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
  locale?: string
  height?: number
  aspectRatio?: ChartAspectRatio
  barSize?: ChartBarSize
  valueMin?: number
  valueMax?: number
  xAxis?: boolean
  yAxis?: boolean
  grid?: boolean
  legend?: boolean
  animation?: "auto" | "off"
  centerValue?: ChartCenterValue
  centerLabel?: string
}

type ChartOptions = { xAxis: boolean; yAxis: boolean; grid: boolean; legend: boolean; animation: "auto" | "off" }

// Series colours come only from the governed chart tokens, in slot order: the model
// assigns var(--chart-1) to var(--chart-5) and marks use those values directly.
const ANIMATION_MS = 400
// Frames of unchanged marks that count as finished, and the most frames to wait for them.
const SETTLED_FRAMES = 2
const MAX_SETTLE_FRAMES = 180
const RATIOS: Record<ChartAspectRatio, number> = { "16/9": 16 / 9, "4/3": 4 / 3, "1/1": 1, "2/1": 2 }
const AXIS_TICK = { className: "text-xs tabular-nums", fill: "var(--muted-foreground)" }
const TICK_PX = 12
// Recharts offsets each tick label by its tick size (6) and tick margin (8) even with
// tick lines off.
const TICK_OFFSET_PX = 6 + 8
const TICK_SLACK_PX = 2
const EDGE_PX = 8
// Recharts' defaults for the band and group geometry the bar packing repeats.
const BAR_CATEGORY_GAP = 0.1
const BAR_GAP_PX = 4
const X_AXIS_HEIGHT_PX = 30
const BAR_MAX_PX: Record<ChartBarSize, number> = { sm: 12, md: 24, lg: 40 }
// Recharts' default polar margin, passed explicitly so the hole radius is computed exactly.
const POLAR_MARGIN_PX = 5
const DONUT_INNER = 0.6
const RADIAL_INNER = 0.5
// The radial draws from a copy of each row in which a missing value is 0, so a part with no value
// sweeps nothing (Recharts would otherwise draw it as a full ring). Tooltips read the original value.
const RADIAL_DRAWN_KEY = "__chartDrawnValue"

// Label room comes from the per-character estimate at semibold width, a generous budget
// for the regular-weight ticks, so it never waits for the web font.
function labelWidth(labels: readonly string[]): number {
  return Math.ceil(Math.max(0, ...labels.map((label) => estimateTextWidth(label, TICK_PX, "semibold"))))
}

function axisWidth(labels: readonly string[]): number {
  return labelWidth(labels) + TICK_OFFSET_PX + TICK_SLACK_PX
}

// Room for a label centred on the plot edge, as the first and last ticks are.
function edgeRoom(labels: readonly string[]): number {
  return Math.max(EDGE_PX, Math.ceil(labelWidth(labels) / 2) + TICK_SLACK_PX)
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
        const raw = partToWhole ? entry.payload?.[model.valueKey!] : entry.value
        const value = typeof raw === "number" ? model.format(raw) : "—"
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

// The centre total, fitted to the hole: its size is one of the contract's font-size tokens, chosen
// by a deterministic estimate, and it is left out rather than drawn over the ring.
function ChartCenter({ model, width, height, inner }: { model: ChartModel; width: number; height: number; inner: number }) {
  if (model.centerValue !== "total") return null
  const total = model.total ?? 0
  const radius = inner * ((Math.min(width, height) - 2 * POLAR_MARGIN_PX) / 2)
  const layout = fitCenter({ full: model.format(total), compact: model.formatCompact(total), caption: model.centerLabel, radius })
  if (!layout) return null
  const cx = width / 2
  const cy = height / 2
  return (
    <g data-slot="chart-center" aria-hidden>
      <text
        x={cx} y={cy + layout.valueY} textAnchor="middle" dominantBaseline="central"
        className={cn("fill-foreground font-semibold tabular-nums", layout.size === "2xl" ? "text-2xl" : layout.size === "xl" ? "text-xl" : layout.size === "lg" ? "text-lg" : layout.size === "base" ? "text-base" : "text-sm")}
      >
        {layout.value}
      </text>
      {layout.caption ? <text x={cx} y={cy + layout.captionY!} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-xs">{layout.caption}</text> : null}
    </g>
  )
}

type ChartPlotProps = { model: ChartModel; options: ChartOptions; width: number; height: number; animate: boolean; signature: string }

function ChartPlotContent({ model, options, width, height, animate }: ChartPlotProps) {
  const gradientPrefix = React.useId().replace(/:/g, "")
  // Every mark starts at once and runs for ANIMATION_MS, so the frame knows when drawing ends.
  // Recharts' onAnimationEnd also fires on effect cleanup, so it is not a finished signal.
  const animation = { isAnimationActive: animate, animationBegin: 0, animationDuration: ANIMATION_MS }
  const tooltip = <Tooltip cursor={model.type === "bar" ? { fill: "var(--muted)" } : { stroke: "var(--border)" }} content={<ChartTooltipContent model={model} />} />
  const valueKey = model.valueKey!
  const polarMargin = { top: POLAR_MARGIN_PX, right: POLAR_MARGIN_PX, bottom: POLAR_MARGIN_PX, left: POLAR_MARGIN_PX }

  if (model.type === "donut") {
    return (
      <PieChart width={width} height={height} margin={polarMargin} accessibilityLayer>
        {tooltip}
        <Pie
          data={model.data as Record<string, unknown>[]} dataKey={valueKey} nameKey={model.categoryKey}
          innerRadius={`${DONUT_INNER * 100}%`} outerRadius="80%" paddingAngle={2} cornerRadius={4} stroke="var(--card)" strokeWidth={2} rootTabIndex={-1} {...animation}
        >
          {model.series.map((series) => <Cell key={series.key} fill={series.color} />)}
        </Pie>
        <ChartCenter model={model} width={width} height={height} inner={DONUT_INNER} />
      </PieChart>
    )
  }
  if (model.type === "radial") {
    // The angle axis spans the total, so each ring sweeps its share and the full circle is the total.
    return (
      <RadialBarChart width={width} height={height} margin={polarMargin} data={model.data.map((row) => ({ ...row, [RADIAL_DRAWN_KEY]: typeof row[valueKey] === "number" ? row[valueKey] : 0 }))} innerRadius={`${RADIAL_INNER * 100}%`} outerRadius="100%" accessibilityLayer>
        <PolarAngleAxis type="number" domain={[0, model.total ?? 0]} tick={false} tickLine={false} axisLine={false} />
        {tooltip}
        <RadialBar dataKey={RADIAL_DRAWN_KEY} cornerRadius={4} background={{ fill: "var(--muted)" }} {...animation}>
          {model.series.map((series) => <Cell key={series.key} fill={series.color} />)}
        </RadialBar>
        <ChartCenter model={model} width={width} height={height} inner={RADIAL_INNER} />
      </RadialBarChart>
    )
  }

  const scale = model.valueScale!
  const stacked = model.layout === "stacked"
  const horizontal = model.type === "bar" && model.orientation === "horizontal"
  const grid = options.grid ? <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.5} vertical={horizontal} horizontal={!horizontal} /> : null
  const categoryLabels = model.table.rows.map((row) => row[0])
  const categoryAxis = { dataKey: model.categoryKey, tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK }
  // The model guarantees every value and running stack total lies inside the domain, so Recharts
  // keeps it as given. allowDataOverflow would also clip lines, areas and their active dots at the
  // plot edge, so it stays off.
  const valueAxis = { tickLine: false, axisLine: false, tickMargin: 8, tick: AXIS_TICK, tickFormatter: model.formatTick, ticks: scale.ticks, domain: scale.domain, interval: 0 as const }
  const categoryAxisWidth = axisWidth(categoryLabels)
  const valueAxisWidth = axisWidth(scale.labels)
  const xAxis = horizontal
    ? <XAxis type="number" {...valueAxis} hide={!options.xAxis} />
    : <XAxis type="category" {...categoryAxis} hide={!options.xAxis} />
  const yAxis = horizontal
    ? <YAxis type="category" {...categoryAxis} width={categoryAxisWidth} hide={!options.yAxis} />
    : <YAxis type="number" {...valueAxis} width={valueAxisWidth} hide={!options.yAxis} />
  // Area and line charts put the first and last category on the plot edges; a horizontal
  // bar chart puts its first and last value ticks there. Both are x-axis labels, so a hidden
  // x-axis needs only the plain edge margin (a sparkline runs edge to edge).
  const edgeLabels = !options.xAxis ? [] : horizontal ? scale.labels : model.type === "bar" ? [] : categoryLabels
  const margin = { top: EDGE_PX, right: edgeRoom(edgeLabels), bottom: options.xAxis ? 0 : EDGE_PX, left: options.yAxis ? 0 : edgeRoom(horizontal ? edgeLabels.slice(0, 1) : edgeLabels) }
  const chart = { width, height, data: model.data as Record<string, unknown>[], accessibilityLayer: true, margin }
  const last = model.series.length - 1

  if (model.type === "bar") {
    const cap = BAR_MAX_PX[model.barSize ?? "md"]
    // Recharts centres a capped bar in its uncapped slot, which pushes grouped bars apart. For
    // grouped bars the size is the cap or the automatic slot, whichever is smaller, so each
    // group stays packed with the 4px bar gap. A slightly high estimate is safe: Recharts
    // shrinks bars that would overflow their band.
    let groupedSize: number | undefined
    if (!stacked && model.series.length > 1) {
      const plot = horizontal
        ? height - margin.top - margin.bottom - (options.xAxis ? X_AXIS_HEIGHT_PX : 0)
        : width - margin.left - margin.right - (options.yAxis ? valueAxisWidth : 0)
      const band = plot / Math.max(1, model.data.length)
      const slot = (band * (1 - 2 * BAR_CATEGORY_GAP) - (model.series.length - 1) * BAR_GAP_PX) / model.series.length
      groupedSize = Math.max(1, Math.floor(Math.min(cap, slot)))
    }
    // In a stack, a card-coloured stroke leaves a 2px surface gap between segments.
    return (
      <BarChart {...chart} layout={horizontal ? "vertical" : "horizontal"} barGap={BAR_GAP_PX} barSize={groupedSize}>
        {grid}{xAxis}{yAxis}{tooltip}
        {model.series.map((series, index) => (
          <Bar
            key={series.key} dataKey={series.key} name={series.label} fill={series.color}
            maxBarSize={groupedSize === undefined ? cap : undefined}
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
  return (
    <LineChart {...chart}>
      {grid}{xAxis}{yAxis}{tooltip}
      {model.series.map((series) => (
        <Line
          key={series.key} dataKey={series.key} name={series.label} type={model.curve}
          stroke={series.color} strokeWidth={2} dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: series.color, stroke: "var(--card)" }} {...animation}
        />
      ))}
    </LineChart>
  )
}

// Recharts starts a new animation whenever a mark re-renders, so the plot renders again only
// when what it draws changes.
const ChartPlot = React.memo(ChartPlotContent, (previous, next) => previous.signature === next.signature && previous.animate === next.animate)

function ChartFrame({ model, options }: { model: ChartModel; options: ChartOptions }) {
  const plotRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  // Ready belongs to what was drawn: the signature covers the plot width, every option, every
  // model field (formatters aside) and, per row, only the category and drawn values, so any visible
  // change starts a new drawing while fields the chart never draws do not.
  const drawnKeys = model.valueKey ? [model.valueKey] : model.series.map((series) => series.key)
  const signature = JSON.stringify(
    [width, options, { ...model, data: model.data.map((row) => [row[model.categoryKey], ...drawnKeys.map((key) => row[key])]) }],
    (_key, value: unknown) => (typeof value === "function" ? undefined : value),
  )
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
  type, title, data, categoryKey, series, valueKey, layout, orientation, curve, valueFormat, currency, locale = "en-US",
  height, aspectRatio, barSize, valueMin, valueMax, xAxis = true, yAxis = true, grid = true, legend, animation = "auto", centerValue, centerLabel,
}: ChartProps) {
  const model = createChartModel({
    type, title, data, categoryKey, series, valueKey, layout, orientation, curve, valueFormat, currency, locale,
    height, aspectRatio, barSize, valueMin, valueMax, xAxis, yAxis, grid, legend, animation, centerValue, centerLabel,
  })
  const descriptionId = React.useId()
  const options: ChartOptions = { xAxis, yAxis, grid, legend: legend ?? model.series.length > 1, animation }

  return (
    <figure data-slot="chart" data-chart-type={type} aria-label={title} aria-describedby={descriptionId} className="m-0 flex w-full flex-col">
      <ChartFrame model={model} options={options} />
      <ChartDescription id={descriptionId} model={model} />
    </figure>
  )
}

export { Chart }
