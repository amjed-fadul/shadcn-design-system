# Release 012: governed chart family (draft spec)

**Status:** Approved spec, not yet implemented.
- **Decided:** on 2026-10-03 the owner chose to wrap Recharts, set six requirements, and approved this
  closed API, the `/charts` entrypoint and folding the build-memory fix into Release 012.
- **Recharts version:** 3.8.1, after the changelog check below.
- **Sequencing:** implementation starts after Canvas adopts Release 011 and reruns the visual-gap
  test. That rerun decides whether Release 012 is charts only or charts plus other gaps.

**Request:** amjed-fadul/shadcn-design-system#19, item 2 (chart component).
**Depends on:** Release 011, whose owner-approved coloured `--chart-1..5` palette this family uses.

## Problem

In the Canvas visual-gap test, both agents needed charts for a revenue dashboard. The code agent drew
SVG by hand. The Canvas agent stacked Progress bars, Sliders, or a "lollipop" made of both. Neither
result was accessible or consistent, and neither used the design system's chart tokens.

## Upstream reference

The pinned upstream (`shadcn-ui/ui` at `1773ecf`, `apps/v4/registry/bases/radix/ui/chart.tsx`) has
`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` and
`ChartStyle`, wrapping **Recharts 3.8.0**.

- **Open API.** Authors compose raw Recharts primitives with any prop.
- **Arbitrary colours.** `ChartConfig` colours are arbitrary strings, injected through
  `<style dangerouslySetInnerHTML>`.
- **Dependency weight**, measured on 2026-10-03 by bundling Recharts 3.8.0's bar, line, area, pie,
  axis, grid, tooltip, legend and responsive-container exports with esbuild 0.28.2 (React external):
  - size: 399 KB minified, 116 KB gzipped;
  - packages: 27 more in the install, including `@reduxjs/toolkit`, `react-redux`, `immer`, eleven
    `d3-*` packages and `victory-vendor`;
  - licences: MIT, plus ISC in `victory-vendor`;
  - peers: Recharts declares a `react-is` peer.

  For scale, Release 009's `index.js` is 521 KB.

That open API breaks this repository's rules: closed authoring APIs, semantic tokens only, and no
arbitrary style or colour injection. Release 012 therefore ships a closed, repository-native API.
Recharts is bundled behind it, as Lucide is bundled behind Icon, and never appears in public
declarations.

## Owner requirements (2026-10-03)

1. **Polished defaults out of the box.**
   - Gradient area fills, rounded bar corners, a soft dashed grid and an active dot on hover.
   - A shadcn-style tooltip and legend, coloured with the Release 011 chart palette.
   - A light/dark screenshot gallery of every chart type, compared against shadcn's official chart
     examples.
2. **A closed, Canvas-friendly prop surface.**
   - Chart type (area, bar, line, donut, radial), series and data keys, stacked or grouped, and curve
     style.
   - Axis, grid and legend toggles.
   - Value formats as named options (currency, percent, compact).
   - No function props and no raw Recharts props.
3. **Deterministic rendering.**
   - Animations respect reduced motion and can be switched off.
   - The chart signals when it has finished drawing, so Canvas's headless screenshots never capture
     a half-drawn chart.
4. **Explicit sizing.** A height or aspect-ratio option, so charts measure correctly inside Canvas
   frames and in headless rendering.
5. **Accessible.** Keyboard focus on data points, and a text summary of the data for screen readers.
6. **Supply chain and loading.**
   - A pinned Recharts version and a clean `npm audit`.
   - Lazy-loadable, so Canvas pages without charts don't pay the bundle cost.

## Proposed design

### Entry point and loading (requirement 6)

- **Separate entrypoint.** Charts ship from a new `@adc/shadcn-design-system/charts` entrypoint.
  Recharts and its dependencies are bundled only into that entry's chunk, so the root `.` entrypoint
  and its bundle are unchanged. Canvas lazy-loads the entry, for example with
  `React.lazy(() => import("@adc/shadcn-design-system/charts"))`, only on pages that contain a chart.
- **Pinned version.** Recharts is pinned exactly at `3.8.1`. It is recorded in `package-lock.json`,
  component-contract provenance and the bundled licence notices.
- **Audit gate.** The release gate requires a clean `npm audit` (production and full); 3.8.1 audits
  clean. `react-is` is bundled, so consumers get no new peer dependency.

**Recharts version check (2026-10-03).** Upstream shadcn's main still pins 3.8.0. The release notes for
3.8.1 through 3.10.1 point to 3.8.1: it stays on upstream's 3.8 line, and its patch fixes things this
spec would hit:

| Version | Relevant to this spec | Decision |
| --- | --- | --- |
| 3.8.1 (patch) | **Keyboard navigation and tooltip fixes for Pie charts** (#7140), arrow-key navigation restored after zoom (#7086), legend `aria-label` from formatted values (#7109), no Tooltip crash on sparse payloads (#7149), no ResizeObserver memory leak on ref update (#7161). | **Adopt.** The donut keyboard requirement and Canvas frame re-renders depend on these. |
| 3.9.0 | Animation overhaul with new animation props; stacked bars render when every value is 0 (#7199). | Skip. It changes the animation API that the draw-finished signal builds on, and diverges from upstream. The all-zero stacked bar is covered by an explicit empty state, tested in the chart suite. |
| 3.9.1–3.9.2 | Legend icon `aria-label` omits empty values (#7501); other fixes in Sankey and ticks. | Skip. The legend is our own content, so its labels are under our control. |
| 3.10.0–3.10.1 | Legend `position` and `offset` replace `align` and `verticalAlign`; fixes in Pie labels, tooltip lookup and `barGap`. | Skip. It is an API change upstream's chart component doesn't use yet. |

Revisit when upstream shadcn moves its pin.

### Components (requirement 2)

One family, `chart`, with one authorable component:

```tsx
<Chart
  type="area"                          // "area" | "bar" | "line" | "donut" | "radial"
  data={revenue}                       // readonly array of flat records: string | number values only
  categoryKey="month"                  // x-axis (cartesian) or segment label (donut, radial)
  series={[                            // 1–5 entries; colours follow chart-1..5 in order
    { key: "thisYear", label: "2026" },
    { key: "lastYear", label: "2025" },
  ]}
  layout="grouped"                     // "grouped" | "stacked" (area, bar, line)
  orientation="vertical"               // bars only: "vertical" | "horizontal"
  curve="monotone"                     // "linear" | "monotone" | "step" (area, line)
  valueFormat="currency"               // "number" | "currency" | "percent" | "compact"
  currency="USD"                       // ISO 4217, required when valueFormat is "currency"
  xAxis yAxis grid legend              // booleans; legend defaults on for 2+ series
  height={240}                         // explicit size, or…
  aspectRatio="16/9"                   // "16/9" | "4/3" | "1/1" | "2/1"
  animation="auto"                     // "auto" (respects reduced motion) | "off"
  title="Revenue by month"             // required: accessible name and summary heading
/>
```

**Rules**

- `donut` and `radial` take one series, with `valueKey` in place of `series`.
- Invalid combinations (for example `stacked` on `donut`) fail validation and throw at runtime, as
  Icon does for an unknown identity.
- There are no function props (formatters and tooltips are named options), no `className`, `style`,
  colour, children or Recharts props.
- Six or more series are rejected rather than coloured with invented hues.

### Visual defaults (requirement 1)

**Marks and grid**

| Part | Default | Token source |
| --- | --- | --- |
| Area fill | Vertical gradient, series colour at 40% to 5% opacity, 2px stroke | `chart-1..5` |
| Bar | 4px rounded data-end corners, 2px surface gap in stacks | `chart-1..5`, `radius.sm` |
| Line | 2px stroke, active dot 8px with a 2px surface ring on hover and focus | `chart-1..5`, `card` |
| Grid | Horizontal only, dashed 3 3, `border` at 50% opacity | `border` |
| Axes | No axis line, `muted-foreground` 12px tick labels, tabular numbers | `muted-foreground`, `font-size.xs` |

**Tooltip and legend**

- **Tooltip:** shadcn-style. It uses the popover surface, a 1px border, `shadow-sm` and an 8px
  radius. Each row shows a colour swatch, the series label and the value. Text uses text tokens,
  never the series colour.
- **Legend:** square swatches and labels in `muted-foreground`, placed below the chart. Series are
  labelled directly when there are four or fewer.
- **Donut and radial:** a centre label for the total.

**Gallery and comparison.** The gallery adds Storybook stories `Charts/Gallery`. They render every
type and its main variants (grouped, stacked, horizontal and curve) in light and dark. Browser
screenshots compare each one, side by side, with the matching shadcn official example (ui.shadcn.com
`charts`, Recharts-based). The record lands in `docs/RELEASE-012-CHART-GALLERY.md`.

### Deterministic rendering (requirement 3)

- **Animation:**
  - `animation="auto"` animates on first draw only;
  - `prefers-reduced-motion: reduce` turns animation off;
  - `animation="off"` disables it in every case.
- **Draw signal:**
  - The chart root carries `data-chart-state`, which is `measuring`, then `drawing`, then `ready`.
  - `ready` is set once the container has a measured size and every series has finished its
    animation, or immediately after layout when animation is off.
  - Canvas's headless renderer waits for `[data-chart-state="ready"]`.
- **Tests:** a runtime test checks the state sequence with animation on and off. A browser test
  screenshots only after `ready`, and proves two runs produce identical pixels.

### Sizing (requirement 4)

- **Size props:** exactly one of `height` (px) or `aspectRatio` is required.
- **Width:** the chart fills its container's width, and the container never collapses to 0.
- **Measurement:** before its first measurement it renders a skeleton of the final size, with no
  layout shift. The same rules hold inside Canvas frames and headless pages.

### Accessibility (requirement 5)

- **Keyboard:**
  - the chart is one tab stop;
  - arrow keys move between data points (Recharts 3 accessibility layer);
  - the tooltip follows focus;
  - `Escape` hides the tooltip.
- **Screen readers:**
  - the chart root has `role="figure"`, labelled by `title`;
  - a visually hidden data table lists every category and series value, formatted with
    `valueFormat`;
  - a one-sentence summary gives the range and the extremes, for example "Revenue by month, Jan to
    Jun 2026, from $42k to $72k".
- **Colour:** meaning is never colour-only. The legend or direct labels name every series.

### Contract and governance

- **Contract:**
  - a repository-native family `chart` with closed local props, enums and conditional requirements
    (`currency` with `valueFormat="currency"`, `valueKey` for donut and radial);
  - token dependencies on `chart-1..5`, `border`, `muted-foreground`, `popover`,
    `popover-foreground`, `card` and `radius.sm`.
- **Knowledge:** when to use each chart type, and when a stat tile or table is better (a single value,
  more than five series).
- **Strict source audits:** Recharts components are named, pinned hosts, like Lucide in Icon, so the
  render analysis stays closed.
- **Release identity:** package `0.0.0-release.12`; component and export counts rise by one family.

## Owner decisions (2026-10-03)

1. **API:** approved as specified: closed, Canvas-friendly, no function props and no raw Recharts
   props.
2. **Recharts version:** follow upstream's 3.8 line. The changelog check above selects 3.8.1.
3. **Entrypoint:** a separate `/charts` entrypoint, so pages without charts don't pay the bundle
   cost.
4. **Build memory:** the producer build-memory fix (peak heap) ships inside Release 012, avoiding a
   release with no visible change.

Implementation follows the Release 008 Icon process: tests first, strict source audits, contracts,
knowledge, Storybook stories, the gallery and browser evidence.
