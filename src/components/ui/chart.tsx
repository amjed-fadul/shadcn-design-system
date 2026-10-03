import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

type ChartDatum = Readonly<Record<string, string | number | null>>

type ChartProps = {
  type: "bar"
  title: string
  data: readonly ChartDatum[]
  categoryKey: string
  series: ReadonlyArray<Readonly<{ key: string; label: string }>>
  height?: number
}

type ChartModel = { title: string; data: ChartDatum[]; categoryKey: string; series: Array<{ key: string; label: string; color: string }>; height: number }

function createModel(input: ChartProps): ChartModel {
  return {
    title: input.title,
    data: [...input.data],
    categoryKey: input.categoryKey,
    series: input.series.map((entry, index) => ({ ...entry, color: `var(--chart-${index + 1})` })),
    height: input.height ?? 240,
  }
}

function ChartPlot({ model, width }: { model: ChartModel; width: number }) {
  if (width <= 0) return <div data-slot="chart-skeleton" className="size-full" />
  return (
    <BarChart width={width} height={model.height} data={model.data} accessibilityLayer>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey={model.categoryKey} tickLine={false} axisLine={false} />
      <YAxis tickLine={false} axisLine={false} />
      {model.series.map((entry) => (
        <Bar key={entry.key} dataKey={entry.key} name={entry.label} fill={entry.color} radius={4} />
      ))}
    </BarChart>
  )
}

function ChartDescription({ id, model }: { id: string; model: ChartModel }) {
  return (
    <div id={id} data-slot="chart-description" className="sr-only">
      <p>{model.title}</p>
    </div>
  )
}

function ChartFrame({ model }: { model: ChartModel }) {
  const [width, setWidth] = React.useState(0)
  const plotRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = plotRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={plotRef} data-slot="chart-plot" data-chart-state={width > 0 ? "ready" : "measuring"} className="w-full" style={{ height: model.height }}>
      <ChartPlot model={model} width={width} />
    </div>
  )
}

function Chart({ type, title, data, categoryKey, series, height = 240 }: ChartProps) {
  const model = createModel({ type, title, data, categoryKey, series, height })
  const descriptionId = React.useId()
  return (
    <figure data-slot="chart" data-chart-type={type} aria-label={title} aria-describedby={descriptionId} className="flex flex-col gap-2 text-xs text-muted-foreground">
      <ChartFrame model={model} />
      <ChartDescription id={descriptionId} model={model} />
    </figure>
  )
}

export { Chart }
export type { ChartProps }
