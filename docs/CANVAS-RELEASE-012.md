# Release 012 → Canvas handoff

Release `shadcn-radix-release-012` adds the governed chart family requested in
amjed-fadul/shadcn-design-system#19. It is one closed `Chart` component for area, bar, line, donut
and radial charts, behind a separate lazy entry. Tokens are unchanged, and every Release 011
component renders as before. Releases 001–011 remain byte-for-byte unchanged.

**Status: accepted by the owner on 2026-10-04.** The owner accepted the spec deviations, settled
the contract decisions below and accepted the candidate below. The manual macOS
release-qualification run is in progress. Canvas can vendor the exact tarball. Canvas adoption is
the owner's call; see the [gallery](RELEASE-012-CHART-GALLERY.md).

The radial chart has no centre total in this release (the donut has one). It is tracked for the
next release in amjed-fadul/shadcn-design-system#22.

## Exact distribution

**Identities**

- Producer source commit: `25c329f8b18cafe2b0bc53a9ccab15ae3ce04536`
- Package: `@adc/shadcn-design-system@0.0.0-release.12`
- Release: `shadcn-radix-release-012`
- Token contract: `shadcn-radix-token-contract-003` (`approved`, unchanged)
- Component contract set: `shadcn-radix-component-contracts-001`

**Hashes**

- Release payload SHA-256: `23e77d9793de3a9f369697537830f86b389c75ae63595571ff7e6cd60fc63bd8`
- Release JSON SHA-256: `2909c4112cd27a26e758c5080d731f98f75f5bb6b84de3edea94a08adf84335f`
- Candidate tarball SHA-256: `fb14eef438da7b1090dbda3b720b2615608dc74f6788dade949658a367957793`
- Candidate tarball integrity: `sha512-olDkyZ7Db5xJRSax2JWvu2t2INndXvlbsbXfhUuWe3zBJeAWYUPcVSigZoGAY5reWcAMAf3hMdXyBkRdjMf7bg==`
- Distribution manifest SHA-256: `cb65fccb2eafda2d5bfedae66b53f52ab01833094268a130e3bfff60821c8c53`
  (also committed as `provenance/distributions/shadcn-radix-release-012.distribution.json`)

**Candidate**

- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-012-candidate/`
- Packed files: 61; executable implementation inputs: 370.
- Contract inventory: 90 tokens, 42 component families (41 + `chart`), 211 public exports (210 +
  `Chart`).
- Peers: `react` and `react-dom` `^18.3.1 || ^19.0.0`, unchanged. Recharts 3.8.1 and `react-is`
  19.3.0 are bundled into the charts entry, so Canvas installs nothing new. Their licences ship in
  the package.
- Toolchain: Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.

## Loading charts

`Chart` ships only through the new entry `@adc/shadcn-design-system/charts`, never the root.
Recharts, its dependencies and the chart code live in `dist-library/charts.js` (633 KB, 153 KB gzipped). A
test proves nothing the root entry can reach imports Recharts. Load the entry lazily, only on
pages that contain a chart:

```tsx
import { lazy, Suspense } from "react"

const Chart = lazy(() => import("@adc/shadcn-design-system/charts").then((module) => ({ default: module.Chart })))

<Suspense fallback={null}>
  <Chart
    type="bar"
    title="Revenue by month"
    data={[{ month: "Jan", thisYear: 42000, lastYear: 30000 }, { month: "Feb", thisYear: 48000, lastYear: 34000 }]}
    categoryKey="month"
    series={[{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }]}
    valueFormat="currency"
    currency="USD"
    height={260}
  />
</Suspense>

<Chart type="donut" title="Customers by plan" data={plans} categoryKey="plan" valueKey="customers" centerLabel="Customers" aspectRatio="1/1" />
```

The packaged stylesheet already carries every class and variable the chart uses.

## Closed props

`Chart` accepts only these 19 props. It ignores everything else: there are no function props, no
`className`, no `style`, no children and no Recharts props.

| Prop | Values | Default | Applies to |
| --- | --- | --- | --- |
| `type` (required) | `area`, `bar`, `line`, `donut`, `radial` | — | all |
| `title` (required) | non-empty text; the accessible name and summary heading | — | all |
| `data` (required) | rows of flat objects: `ReadonlyArray<Readonly<Record<string, string \| number \| null>>>` | — | all |
| `categoryKey` (required) | the row field naming each category (text or number in every row) | — | all |
| `series` | 1–5 `{ key, label }`; `key` names a numeric row field. Colours follow `chart-1..5` in order | — | area, bar, line (required there) |
| `valueKey` | the numeric row field; one row per part, at most 5, values zero or more | — | donut, radial (required there) |
| `layout` | `grouped`, `stacked` | `grouped` | area, bar |
| `orientation` | `vertical`, `horizontal` | `vertical` | bar |
| `curve` | `monotone`, `linear`, `step` | `monotone` | area, line |
| `valueFormat` | `number`, `currency`, `percent` (fractions: 0.124 is 12.4%), `compact` | `number` | all; axis ticks always use the compact form |
| `currency` | ISO 4217 code such as `USD` | — | required with, and only with, `valueFormat="currency"` |
| `height` | plot height in pixels; the legend renders below it | — | exactly one of `height` or `aspectRatio` |
| `aspectRatio` | `16/9`, `4/3`, `1/1`, `2/1` | — | exactly one of `height` or `aspectRatio` |
| `xAxis`, `yAxis`, `grid` | boolean | `true` | area, bar, line |
| `legend` | boolean | on for 2 or more series or parts | all |
| `animation` | `auto` (animates, respects reduced motion), `off` | `auto` | all |
| `centerLabel` | text under the donut total | — | donut |

Values in `data` must be finite numbers or `null`; `null` is a gap. A combination outside this
table throws a `ChartPropsError` naming the rule. Examples include `layout` on a line chart,
`series` on a donut, or a sixth series.

### What the contract can and cannot check

The executable contract checks every closed option: the enums, booleans, the `height` number and
unknown props. `data` and `series` are arrays of objects, which the contract's structured type
language cannot describe. The contract therefore records them as `typescript` types with the
exact shapes above. The producer validator reports an authored literal for either as
`UNRESOLVED_FACT`, as it does for every opaque type.

Canvas's registry already requires "an explicit Canvas authoring policy" for `typescript`-kind
props. Chart needs one for `data` (rows of flat objects with string, number or null values) and
`series` (`{ key: string; label: string }` items, 1–5). The owner decided on 2026-10-04 that this
policy lives on the Canvas side, added on adoption.

The combination rules above are runtime facts, because the contract cannot express props that apply
only to some chart types. On adoption, the owner plans for Canvas to refuse invalid combinations at
write time, so agents get a clear error instead of a broken chart. The `ChartPropsError` messages
name each rule and can be reused as the error text.

## Waiting for a finished chart

The plot element `[data-slot="chart-plot"]` carries `data-chart-state`:

- `measuring` until its container has a width. It shows a skeleton of the final size, with no
  layout shift.
- `drawing` while marks animate.
- `ready` once the marks have stopped moving. With `animation="off"` or reduced motion, it goes from
  `measuring` straight to `ready`.

How `ready` is decided:

- After the animation duration (400 ms), the chart watches its marks and reports `ready` once they
  are identical on consecutive frames.
- Any change to the data, options or plot size starts a new drawing.

For headless capture, wait for `[data-chart-state="ready"]` on every chart, or pass `animation="off"`.
A browser test captures every chart type at `ready` twice, in light and dark, and gets identical
pixels both times.

## Sizing and layout

- The chart fills its container's width; give it a container with a width.
- The plot height is `height` pixels, or the width divided by `aspectRatio`.
- The legend, when shown, sits below the plot and adds about 28px: a 12px gap and one 16px line, more when it wraps.
- The value axis uses ticks the chart chooses itself (1, 2, 2.5 or 5 × 10ⁿ) and is sized from those
  exact labels, with edge room for labels centred on the plot edge. Every chart story fails if a
  label leaves its surface.

## Accessibility

- **Keyboard:** the chart is one tab stop. Arrow keys move between data points, the tooltip follows
  focus, and `Escape` dismisses it.
- **Screen readers:** the chart is a `figure` named by `title` and described by a one-sentence
  summary and a visually hidden data table, both formatted with `valueFormat`. For example:
  "Revenue by month, Jan to Jun: 2026 from $42,000 to $72,000; 2025 from $30,000 to $47,000."
- **Colour:** series take `chart-1..5` in slot order, and status colours are never series colours.
  The legend and the table name every series, so identity never depends on colour alone.

## Tokens used

`chart-1` to `chart-5`, `card`, `border`, `muted`, `muted-foreground`, `popover`,
`popover-foreground` and `foreground`, plus the `text-xs` and `text-2xl` sizes. Every colour the
chart draws is a token value; tests reject any raw colour in the rendered markup.
