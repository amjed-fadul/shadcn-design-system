# Release 013 → Canvas handoff

Release `shadcn-radix-release-013` implements the chart follow-ups Canvas raised after adopting
Release 012: amjed-fadul/shadcn-design-system#22 (centre totals that fit their ring) and #23
(`locale`, `barSize` and the value-axis range). It also adds the licence files deferred from #24.
Tokens are unchanged, and Releases 001–012 remain byte-for-byte unchanged.

**Status: rebuilt candidate accepted by the owner on 2026-10-05; macOS release qualification passed.**
- **Rebuild:** the first macOS qualification failed on the chart's ready signal
  (see [the release notes](RELEASE-013.md#macos-qualification)). It is fixed in `8545a64`, and the candidate was rebuilt from there.
- **Candidate:** the owner accepted the rebuilt tarball `2b63e645…` (payload `b880ec96…`),
  and with it the producer rulings below. The earlier tarball `3e1d0a0b…` is superseded: do not vendor
  it.
- **Qualification:** passed on `50179b1`, [run 37262967223](https://github.com/amjed-fadul/shadcn-design-system/actions/runs/37262967223). The third run passed every step, including
  the byte-identical rebuild of the committed candidate. Commits after the source `8545a64` change
  tests, docs and the committed manifest only.
- **Merge:** the owner merges.

## Exact distribution

**Identities**

- Producer source commit: `8545a644b432a376b892329452af6a8e7b3aee09`
- Package: `@adc/shadcn-design-system@0.0.0-release.13`, licence `UNLICENSED`
- Release: `shadcn-radix-release-013`
- Token contract: `shadcn-radix-token-contract-003` (`approved`, unchanged)
- Component contract set: `shadcn-radix-component-contracts-001`

**Hashes**

- Release payload SHA-256: `b880ec969b60eba4de6a16d5b835303ee9ea06f933fc93a989ede5161c65a409`
- Release JSON SHA-256: `aaa0ced0fb66e624bc405a075f7546bd305cd6feace7b37702806c538923e80a`
- Candidate tarball SHA-256: `2b63e645b497446d8a0939914450b581efbfc1bb72bf37b6070a5876801ae10a`
- Candidate tarball integrity: `sha512-vqxzEJTrYyZsbP7om4wS2hQA6LJhwZm/mIziUiYNH0Pj7UPiH5XX4bTN/TxjGEO6qHjxYMD0Psmax/xroYM/zg==`
- Distribution manifest SHA-256: `112cc081ed62acc8ecfbc1d14fed3adb11c25560336bb3729c6ef8a95bab6f17`
  (also committed as `provenance/distributions/shadcn-radix-release-013.distribution.json`)

**Candidate**

- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-013-candidate/`
- Packed files: 64; executable implementation inputs: 375. Against Release 012's 61, the package adds:
  - `LICENSE`;
  - the type declarations `chart-scale.d.ts` and `chart-text.d.ts`.

  Rollup's shared chunk is renamed from `clsx-*.js` to `utils-*.js`.
- Contract inventory: 90 tokens, 42 component families, 211 public exports, all unchanged.
- Peers: `react` and `react-dom` `^18.3.1 || ^19.0.0`, unchanged. Recharts 3.8.1 stays bundled
  into the charts entry (652 KB, 158 KB gzipped).
- Toolchain: Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.

## Adoption steps

1. **Migrate stored Chart nodes before vendoring.** Release 013 throws where Release 012 ignored:
   - remove a non-blank `centerLabel` from area, bar and line charts;
   - replace any value outside the closed vocabularies below, for example `layout: "stack"`.
2. **Add the new props to the authoring policy and write-time checks.** Use the rules and the exact
   messages below; every message is the producer's `ChartPropsError` text.
3. **Pass the Page locale** (`locale="en"` or `locale="ar"`) on every chart. Without it a chart
   formats as `en-US`.
4. **Refresh visual baselines** for the render changes listed below.

## New and changed props

Chart now accepts 24 props: Release 012's 19 plus the five new ones. It still ignores everything
else.

| Prop | Values | Default | Applies to | Contract records |
| --- | --- | --- | --- | --- |
| `locale` (new) | a supported BCP 47 tag, e.g. `en`, `ar`, `en-GB`, `de-DE` | `en-US` | all | string, default `en-US` |
| `barSize` (new) | `sm`, `md`, `lg`: a maximum bar thickness of 12, 24 or 40 px | `md` | bar | enum, no default (applied by the model) |
| `valueMin` (new) | finite number | unset | area, bar, line | number |
| `valueMax` (new) | finite number | unset | area, bar, line | number |
| `centerValue` (new) | `total`, `none` | `total` | donut, radial | enum, no default (applied by the model) |
| `centerLabel` (widened) | caption under the centre total | — | donut and now radial | string |

The `barSize` and `centerValue` defaults are applied by the model after their applicability check,
so a bar default never leaks onto a line chart. The contract therefore records no default for them;
the defaults are stated here and in the knowledge entry, as `legend`'s is.

## Rules and exact messages

Each rule throws a `ChartPropsError` with exactly this message. Messages use raw numbers, never the
chart's formatter, so they don't depend on locale or format.

| Rule | Message |
| --- | --- |
| `locale` must be a supported tag; `und`, `zz`, `""`, numbers and `null` are rejected | `Chart locale "<tag>" is not a supported BCP 47 language tag.` |
| enumerated props stay in their vocabularies | `Chart <prop> must be one of <values>.` (layout, orientation, curve, valueFormat, animation, barSize, centerValue) |
| display toggles are booleans | `Chart <prop> must be true or false.` (xAxis, yAxis, grid, legend) |
| caption is text | `Chart centerLabel must be text.` |
| currency is a text ISO 4217 code | `Chart currency must be an ISO 4217 code.` |
| `barSize` only on bar charts | `Chart barSize applies only to bar charts.` |
| `centerValue` only on donut and radial | `Chart centerValue applies only to donut and radial charts.` |
| `centerLabel` (non-blank) only on donut and radial | `Chart centerLabel applies only to donut and radial charts.` |
| caption needs a shown total | `Chart centerLabel needs centerValue "total".` |
| range only on area, bar and line | `Chart valueMin and valueMax apply only to area, bar and line charts.` |
| finite numbers | `Chart valueMin and valueMax must be finite numbers.` |
| order | `Chart valueMin must be below valueMax.` |
| bars and stacked charts keep zero in range | `Chart valueMin and valueMax must include zero on bar charts and stacked charts.` |
| data inside the range (unstacked) | `Chart value <n> for "<series label>" at "<category>" is below valueMin <min>.` (or `is above valueMax <max>.`) |
| running stack totals inside the range | `Chart stack total <n> at "<category>" is above valueMax <max>.` (or `is below valueMin <min>.`) |

Points that matter for write-time mirroring:
- **Blank captions.** A blank `centerLabel` (`""` or whitespace) counts as absent and never throws.
- **Stack totals.** Stacked charts check running sums in series order, with `null` counted as 0, not
  individual values. Values, sums and bounds are all rounded to 12 significant digits before
  comparing, so `[0.33, 0.56, 0.11]` passes `valueMax={1}` and a value equal to a bound such as 2/3
  passes.
- **Numbers in messages** are the author's raw values (the bound as given, the raw sum), so a message
  never contradicts itself.
- **Empty charts.** When every value is `null` or 0, the chart shows its empty state and the range is
  not checked.
- **Remaining exception.** `xAxis`, `yAxis` and `grid` on donut and radial charts are still ignored,
  as in Release 012. Their `true` defaults are contract facts. This corrects Release 012's handoff,
  which said every combination outside the table throws.

## Render changes from Release 012

- **Locale:** formatting defaults to `en-US` instead of the browser's language.
- **Bars:** they are capped at 24 px (`md`) by default; Release 012 drew them full band width.
  Grouped bars are packed at the size with a 4 px gap.
- **Radial:**
  - rings sweep each part's share of the total, where Release 012 swept relative to the largest part;
  - the inner radius is 50%, up from 30%;
  - the total shows in the centre by default, and `centerLabel` now renders on radial.
- **Donut totals** shrink, switch to the compact form when it is shorter, or are left out in small
  frames, instead of overflowing the ring.
- **Tick labels** show every tick exactly, e.g. `2.5%` where Release 012 printed `3%`, and the full
  value where compact would round (`$48,025`).
- **Stacks:** mixed-sign stacks and float-sum percent stacks get ticks that cover their marks; a 100%
  stack's axis now ends at 100%, not 150%.
- **Throwing values:** invalid enumerated values (`layout: "stack"`) now throw instead of silently
  falling back.
- **Radial parts with no value** sweep nothing; Release 012 drew them as full rings.
- **Hidden x-axis:** a chart with `xAxis={false}` no longer reserves room for edge labels, so its plot
  is wider. Sparklines run edge to edge.
- **Axis widths** come from a per-character estimate, so every cartesian chart's axis moves by a few
  pixels.
- **Donut caption** is positioned by the new stack layout and moves slightly even where the total
  still renders at the largest size.
- **Summary:** the hidden summary names the centre caption ("…totalling 1,130 (Customers): …").
- **Ready timing:** `ready` now comes once the draw animation has finished. Line and area charts
  report it about 60 ms later than Release 012, whose `ready` came while their line or fill was still
  drawing in, and on a slow machine no chart reports it before its marks are drawn. Nothing drawn
  changes.

Polar charts keep Recharts' 5 px margin, so donut geometry is otherwise unchanged. Lines and areas are
never clipped at the plot edge.

## Centre totals

Donut and radial charts show the sum of their parts in the centre:
- The size is one of the font-size tokens `2xl`, `xl`, `lg`, `base` or `sm`, chosen by a
  deterministic per-character width estimate.
- The full value is preferred down to `base`; then whichever of the full and compact forms is shorter
  is tried, down to `sm`.
- If nothing fits, the total and caption are left out rather than drawn over the ring.
- A caption is kept whenever any size fits with it.

A browser story checks the real rendered text: every corner of each centre text box lies inside the
hole. It covers donut and radial at 160–320 px, in `en-US`, `en-GB`, `de-DE`, `ja-JP` and `ar`,
for every value format.

## Value-axis range

- **Explicit bounds** are the plot edges exactly, and data outside them throws.
- **A free bound** steps over the span the explicit bound leaves. So a revenue line from 31k to 48k
  with `valueMin={30000}` gets the domain 30K to 50K with ticks every 5K.
- **Bound labels.** When a bound isn't on the computed step, the next larger, then the next smaller,
  nice step that labels it is preferred, if it keeps 2 to 6 ticks. `valueMin={25000}` gives 25K, 50K,
  75K. Otherwise the bound is the unlabelled plot edge.
- **Exact tick labels:** they use as much precision as the ticks need, so a zoomed uptime line reads
  `99.99% | 99.9905% | …`.
- **Raising the minimum** is allowed only on unstacked line and area charts.
- **KPI sparkline:** a small area or line chart with `xAxis`, `yAxis`, `grid` and `legend` off and
  `valueMin` near the data's minimum. It runs edge to edge.

## Waiting for a finished chart

As in Release 012, wait for `[data-chart-state="ready"]`, or pass `animation="off"`. Two things change:
- **Ready means drawn.** Release 012 took two unchanged frames after 400 ms as finished.
  - On a slow CPU that could fire before the bars were drawn. This failed the first macOS
    qualification of this release.
  - It never saw a line's dash pattern or an area's clip, so line and area charts reported `ready`
    about 60 ms early everywhere.
  - Release 013 reports `ready` once Recharts says every mark's draw animation has finished. Recharts
    sets the final frame before it says so, so a capture at `ready` is the finished chart.
  - An update that moves no mark (a line's new locale) is ready once the 400 ms animation time has
    passed. 180 frames remain the backstop.
- **Every drawing input starts a new drawing.** The draw signature covers every drawing input, so a
  change to only `locale`, a bound, `barSize`, `centerValue` or raw data values also starts a new
  drawing. Canvas no longer needs to key bound charts on their projected rows (RT-1).

## Determinism evidence

`tests/release013-chart.browser.mjs` lazy-loads 14 chart variants through the public charts entry:
- each is captured at `ready` in two fresh pages, in light and dark, and the captures are
  byte-identical;
- a chart without `locale` renders identical pixels in `de-DE`, `ar-EG` and `ja-JP` browsers and in
  `en-US`;
- with the CPU at full speed and slowed six times, nothing in the plot changes after `ready`, for
  every variant and after updates that move the marks or only relabel them.
