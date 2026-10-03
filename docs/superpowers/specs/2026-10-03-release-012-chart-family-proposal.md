# Release 012 proposal: governed chart family

**Status:** Proposal. Nothing here is implemented. It needs the owner's decision on the dependency and
the API before work starts.
**Date:** 2026-10-03
**Request:** amjed-fadul/shadcn-design-system#19, item 2 (chart component).
**Depends on:** Release 011, whose coloured `--chart-1..5` palette this family uses.

## Problem

In the Canvas visual-gap test, both agents needed charts for a revenue dashboard. The code agent drew
SVG by hand. The Canvas agent stacked Progress bars, Sliders, or a "lollipop" made of both. Neither
result was accessible or consistent, and neither used the design system's chart tokens.

Canvas needs bar, line or area, and donut charts, with axis, grid, legend and tooltip parts.

## What upstream shadcn ships

The pinned upstream (`shadcn-ui/ui` at `1773ecf`, `apps/v4/registry/bases/radix/ui/chart.tsx`) has
`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` and
`ChartStyle` (370 lines). It wraps **Recharts 3.8.0**.

- **The API is open by design.** Authors compose raw Recharts primitives (`BarChart`, `Bar`, `XAxis`,
  `CartesianGrid`, …) as children, with any Recharts prop.
- **Colours are arbitrary strings.** `ChartConfig` takes `color` or per-theme strings and injects them
  as `--color-<key>` through a `<style dangerouslySetInnerHTML>`.
- **Dependency weight**, measured on 2026-10-03 by bundling Recharts 3.8.0's bar, line, area, pie,
  axis, grid, tooltip, legend and responsive-container exports with esbuild 0.28.2 (React external):
  - size: 399 KB minified, 116 KB gzipped;
  - packages: 27 more in the install, including `@reduxjs/toolkit`, `react-redux`, `immer`, eleven
    `d3-*` packages and `victory-vendor`;
  - licences: MIT, plus ISC in `victory-vendor`;
  - peers: Recharts adds a `react-is` peer dependency.

  For scale, Release 009's `index.js` is 521 KB.

Taken as-is, upstream Chart breaks this repository's rules: closed authoring APIs, semantic tokens only,
and no arbitrary style or colour injection. Its children are not governable component facts.

## Options

### A. Vendor upstream Chart unchanged

Not recommended. Canvas agents could pass any Recharts prop and any colour string. The component
contract would have to model Recharts' public types as inherited interfaces, which run to thousands
of props.

### B. Governed wrapper over Recharts 3.8.0 (recommended)

Keep upstream's rendering and interaction, and expose only a closed, repository-native API. Recharts
is bundled and never appears in public declarations, as Lucide is bundled behind Icon.

- **Pros**
  - Visual and behavioural parity with shadcn charts, which agents and designers already know.
  - Proven axes, tooltips, animation and resize handling.
  - Recharts 3 ships a keyboard accessibility layer.
  - Least code to own.
- **Cons**
  - The dependency weight above.
  - A Redux store per chart instance.
  - A new `react-is` peer, unless the build bundles it.
  - Recharts upgrades go through the dependency audit and licence notice process.

### C. Repository-native SVG charts

Draw bar, line, area and donut charts in plain React SVG, with our own linear and band scales, nice
ticks, arc paths, hover and keyboard focus.

- **Pros**
  - No dependency.
  - Small bundle.
  - Every render path is visible to the strict source audits.
- **Cons**
  - About 800–1,200 lines of chart code to own, test and keep accessible.
  - Interactions (tooltip positioning, focus order, resize) must be built and proven from scratch.
  - It drifts from upstream shadcn.

Options B and C expose the same API below, so the implementation can change later without a contract
change.

## Proposed API (B or C)

```tsx
<BarChart
  data={revenue}                       // readonly records of string | number
  categoryKey="month"                  // the x-axis field
  series={[                            // 1–5 series; colours follow chart-1..5 in order
    { key: "thisYear", label: "2026" },
    { key: "lastYear", label: "2025" },
  ]}
  valueFormat="currency"               // "number" | "percent" | "currency" | "compact"
  currency="USD"                       // required when valueFormat is "currency"
  layout="vertical"                    // bars: "vertical" | "horizontal"
  stacked={false}
  grid                                 // horizontal grid lines, default true
  legend                               // default: shown for 2 or more series
  title="Revenue by month"             // required: accessible name, also used by the data table
/>
<LineChart  … area={false} curve="linear" />  // area: true renders an area chart
<DonutChart data={…} categoryKey="plan" valueKey="customers" centerLabel="Customers" title="…" />
```

**Governance rules**

- No `className`, `style`, colour, Recharts prop or children. Colours come only from `--chart-1..5`
  in fixed order. A sixth series is rejected rather than generated.
- Text uses text tokens (`foreground`, `muted-foreground`), never the series colour.
- Axis and grid use `border` and `muted-foreground`. The tooltip uses the popover surface.
- Each chart renders a visually hidden data table, linked from the figure, so values are never colour-only
  or pointer-only. With two to four series it also labels series directly.
- Keyboard: one tab stop per chart, arrow keys move between data points, and the tooltip follows focus.
- Reduced motion turns animation off.

**Component contract**

A repository-native family per chart type, like Icon:

- closed local props;
- token dependencies on `chart-1..5`, `border`, `muted-foreground`, `popover` and `popover-foreground`;
- knowledge entries for when to use each chart type and when a stat tile or table is better.

## Decisions for the owner

1. **Dependency:** approve Recharts 3.8.0 (option B, plus 27 transitive packages and about 116 KB
   gzipped), or choose repository-native SVG (option C).
2. **Scope:** bar, line/area and donut, with the closed API above. Any type to add or drop?
3. **Release:** ship as Release 012 on top of Release 011's chart palette.

After approval, the next step is a full design spec and implementation plan in `docs/superpowers/`,
following the Release 008 Icon process: tests first, strict source audits, contracts, knowledge,
Storybook stories and browser evidence.
