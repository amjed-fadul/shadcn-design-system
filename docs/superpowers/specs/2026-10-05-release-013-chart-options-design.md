# Release 013: chart centre totals, chart options and licence notices (design)

Release 013 implements amjed-fadul/shadcn-design-system#22 and #23, the chart follow-ups Canvas
found after adopting Release 012 (amjed-fadul/agentic-design-canvas#56). It also takes the licence
items deferred from #24, because they change release inputs. Tokens are unchanged.

**Status: revised after the independent design review and the code review (2026-10-05).** The owner decided the option names, shapes
and rules on 2026-10-04, recorded in #22 and #23. Under the owner's standing instruction, the producer
makes the remaining design decisions and records them below as rulings, each with its reason and the
cost if it's wrong.

Four independent reviewers checked the first draft against the code and Recharts 3.8.1, through
visual, closed-API, edge-case and fact-check lenses. Their confirmed findings are folded into the
rulings and marked *(review)*. Several are latent Release 012 defects that this release also fixes.

## Owner decisions this design implements (2026-10-04)

1. **`locale`:** default fixed to `en-US`, not the browser's language, for reproducible renders. Apps
   that want the viewer's language pass `locale`. Canvas passes the Page's locale explicitly.
2. **`barSize`:** a named scale, `"sm" | "md" | "lg"`, with `md` as the default and no free pixel
   number. The default is from the owner-decisions comment on #23 (2026-10-04T14:11Z), the most
   recent owner record; the issue body's earlier "unset keeps automatic width" was the producer's
   inference.
3. **`valueMin` / `valueMax`:**
   - out-of-range data is rejected with an error, never clipped;
   - bars stay anchored at zero, and a raised `valueMin` is allowed only on line and area charts.
4. **Centre totals:**
   - they fit their hole, with a short-form fallback;
   - the radial chart gets one;
   - the only centre setting is show or hide (`centerValue`).
5. **Licence items deferred from #24:**
   - `COPYRIGHT` becomes `LICENSE`, and `package.json` gets `"license": "UNLICENSED"`;
   - the README links `LICENSE` and `THIRD_PARTY_NOTICES.md`;
   - `.gitignore` gains secret patterns;
   - the licence generator reads NOTICE files and supplies `react-remove-scroll-bar`'s missing MIT
     text, and fails the build on any declared MIT, ISC or BSD package with no licence text.

## Prop surface after Release 013

Five props are new, so Chart goes from 19 to 24 props, and `centerLabel` widens. Every prop stays a
closed, named data option.

| Prop | Values | Default | Applies to | Status |
| --- | --- | --- | --- | --- |
| `locale` | a supported BCP 47 tag, e.g. `en-US`, `en-GB`, `de-DE` | `en-US` | all | new |
| `barSize` | `sm`, `md`, `lg` | `md` (applied by the model; the contract records no default) | bar | new |
| `valueMin` | finite number | unset | area, bar, line | new |
| `valueMax` | finite number | unset | area, bar, line | new |
| `centerValue` | `total`, `none` | `total` (applied by the model; the contract records no default) | donut, radial | new |
| `centerLabel` | text under the centre total | — | donut, radial | widened (radial is new) |

## Rulings

### R1. Centre total: fit to the hole

**Geometry.** The hole radius is computed as Recharts does. Polar charts pass an explicit `margin` of
5 px on each side, the value Recharts already uses by default, so the maximum radius is
`(min(width, height) − 10) / 2`. The hole is the inner radius times that.

**Width estimate** *(review)*. Each character gets an advance width in em, a deterministic table taken
from Geist at weight 600 with tabular figures:

| Characters | Width (em) |
| --- | --- |
| digits | 0.63 |
| space, no-break spaces, `,` `.` `'` | 0.25 |
| other punctuation | 0.32 |
| `%` | 0.85 |
| currency symbols (Unicode category Sc) | 0.78 |
| Latin lowercase | 0.62 |
| Latin uppercase | 0.75 |
| `M`, `W` | 0.95 |
| East Asian Wide and Fullwidth characters | 1.0 |
| zero-width and directional marks | 0 |
| anything else | 0.8 |

The width is the sum of the characters' advances times the font size. The caption uses the same table
at 0.95× for regular weight. The value axis uses the table too, at the full semibold width (a generous
budget for its regular-weight labels), so CJK compact suffixes such as `万` no longer clip (R9).

**Layout and fit** *(review)*.
- Text is centred as one stack: the total at size S, then, when a caption is shown, a gap of 0.25 S
  and the 12 px caption.
- Each line's box is 1.17× its font size tall, and the stack is centred vertically on the hole. 1.17 em
  is Geist's measured SVG text box: ascent plus descent, centred on the central baseline. So a line
  that fits has its real bounding-box corners inside the hole, which the browser check verifies. The
  first draft said 0.8×, which modelled only the glyph ink, and the code review corrected it.
- A line fits only if its half-width plus 2 px padding is within the chord at its farthest vertical
  edge: `√(r² − y²)`, where y is that edge's distance from the centre.
- Positions are explicit `y` values with `dominantBaseline="central"`. They are not `dy` offsets, so
  they don't depend on each line's own font size.

**Candidates.** The fit tries these in order and takes the first that fits:
1. The full value at `2xl`, `xl`, `lg` and `base`.
2. Whichever of the full and compact forms is shorter by estimate, at `2xl` down to `sm`. In some
   locales the compact form is no shorter (`de-DE` `12.345 €`) or longer (`es-ES` `12,3 mil €`).
3. If nothing fits even at `sm`, the total and caption are hidden rather than overflow.

The caption is shown only if the stack fits with it. Otherwise the total is re-fitted alone.

**Token governance** *(review)*. The size is a literal conditional class (`text-2xl`, `text-xl`,
`text-lg`, `text-base` or `text-sm`), never an attribute or lookup.
- The token analyzer resolves conditionals with literal branches, so the whole-file audit stays at
  zero unresolved.
- `text-xl` joins the canonical direct map; `font-size.xl` is already an approved token.
- Tailwind's scanner sees every class, so Storybook and the package both emit them.

The total also gets `tabular-nums`.

**Why.** The fit is deterministic and independent of font loading. It stays token-governed and never
overflows the hole, which was the defect Canvas found: a fixed 24 px currency total overflowed a
180 px donut.

**Cost if wrong:** low. A browser test checks the real rendered text against the hole (verification
plan), so any estimate error shows up as a failure, not a shipped overlap.

### R2. Radial chart: a truthful total

- The inner radius grows from 30% to 50%, and the outer radius stays 100%.
- **Share-of-total sweeps** *(review)*. Release 012's radial swept each ring relative to the
  *largest* part, so the biggest part drew a full circle. Beside a centre total, that reads as
  "this part is the whole".
  - A hidden numeric angle axis with domain `[0, total]`, with no ticks and no line, makes each sweep
    that part's share of 360°. The full circle is the centre total.
  - Recharts keeps an angle axis's domain exact, with no nice-tick extension.
  - This is a deliberate visual change from Release 012, listed under "Render changes".
- The radial shows the sum of its parts, formatted like the donut's total. `centerLabel` applies to
  radial too.
- **Cost if wrong:** low. Rings are thinner (about 8 px at a 180 px plot with five parts); the
  gallery shows a 180 px five-part radial.

### R3. `centerValue` and centre rules

- `centerValue: "total" | "none"`, defaulting to `total`, for donut and radial charts. `none`
  removes the centre entirely.
- New rules, each throwing a `ChartPropsError`:
  - `centerValue` on area, bar or line charts;
  - `centerLabel` with `centerValue="none"`;
  - `centerLabel` on area, bar or line charts.
- **Blank captions** *(review)*. A blank `centerLabel` (`""` or whitespace) counts as absent and never
  throws, because Canvas inspectors write `""` for a cleared field. Release 012 already rendered no
  caption for it.
- **Where the default applies.** The model applies `centerValue`'s default after the applicability
  check, so the "only on donut and radial" rule can fire. The contract records no default.
- **Why:** the closed API rejects options that do nothing. Release 012 documented `centerLabel` as
  "applies to donut" but silently ignored it elsewhere.
- **Remaining exception** *(review)*. `xAxis`, `yAxis` and `grid` on donut and radial charts stay
  ignored, as in Release 012.
  - Their destructured `true` defaults are contract facts Canvas already relies on.
  - The model can't tell an explicit `true` from the default without changing those facts.
  - The Release 013 handoff corrects Release 012's claim that every combination outside the table
    throws, and names this exception.
- **Cost if wrong:** low. A Canvas document that sets `centerLabel` on a bar chart now throws. The
  handoff lists it as a new rule.

### R4. `locale`

- `locale?: string`, defaulting to `en-US`. Validation *(review)*:
  1. `typeof locale === "string"`;
  2. `Intl.getCanonicalLocales(locale)`, mapping RangeError or TypeError to a `ChartPropsError`;
  3. `Intl.NumberFormat.supportedLocalesOf(canonical).length === 1`.

  The supported-locale check matters because well-formed tags with no locale data (`und`, `zz`) would
  otherwise fall back to the host's language. The error reads: `Chart locale "zz" is not a supported
  BCP 47 language tag.`
- The canonical tag is used for every formatter: values, axis ticks, summary sentence, data table,
  part-to-whole percentages and the centre total.
- The locale moves into `ChartModelInput` (`input.locale`), replacing the separate `locale` argument.
  The model records it as `model.locale`.
- **Compatibility:** on non-en-US browsers, Release 012 formatted with the browser's language;
  Release 013 formats as `en-US` unless `locale` is passed.
- **Cost if wrong:** low. Pass `locale`.

### R5. `barSize`

`barSize: "sm" | "md" | "lg"` sets a maximum bar thickness of 12, 24 or 40 px, for bar charts only, in
both orientations.
- **Default.** `md` is the default, as the owner decided. Release 012's automatic width made bars
  very wide: about 72 px each at 600 px with three categories and two series, which is what Canvas
  reported. Every existing bar chart therefore gets capped at 24 px, which is a render change.
- **Where the default applies.** The model applies it after the applicability check, so
  `barSize` on other chart types still throws. Like `legend`, the contract records no default.

**Packing** *(review)*. Recharts' `maxBarSize` centres each capped bar in its uncapped slot, which
pushes grouped bars apart until groups read as evenly spaced bars. So:
- For grouped charts with two or more series, the producer computes the size as
  `min(cap, automatic slot)` and passes Recharts `barSize`. That packs each group with the 4 px
  `barGap` and centres the group.
- For single-series and stacked charts, `maxBarSize` is enough.
- The automatic slot repeats Recharts' arithmetic: band minus 2 × 10% category gap, minus
  `(n − 1) × 4`, divided by n. If the estimate is slightly high, Recharts' own overflow handling
  shrinks the bars, so it is safe.

**Values.** 12, 24 and 40 px differ visibly at common widths. A 672 px, two-series, six-month chart has
a 39 px slot, so `lg` reaches the automatic width there. That revises the first draft's 16, 28 and
44 px, which were often no-ops.

**Cost if wrong:** low. The gallery shoots all three sizes where they differ.

### R6. `valueMin` / `valueMax`

**Rules.**
- They apply to area, bar and line charts; on donut or radial they throw.
- Values must be finite numbers, and `valueMin` must be below `valueMax` when both are given.
- **Zero-anchored charts.** On bar charts, and on any stacked chart, the range must include zero:
  `valueMin ≤ 0 ≤ valueMax`.
  - Bars and stacks encode magnitude from zero, so a raised minimum exaggerates differences. This
    extends the owner's bar rule to stacked areas, whose bottom series is drawn from zero.
  - A raised `valueMin` is therefore allowed only on non-stacked line and area charts.

**Validation.**
- For unstacked charts, every non-null value must lie within the range.
- For stacked charts, the running stack totals are checked instead of individual values: each
  running total in series order, with null counted as 0, which is what Recharts' sequential stacking
  draws.
- Values, running totals and both bounds are normalised to 12 significant digits before any
  comparison *(review)*.
  - `0.33 + 0.56 + 0.11` is `1.0000000000000002` in floating point, so without it a valid 100%-stacked
    share chart would fail `valueMax={1}`.
  - A value exactly equal to a bound with more than 12 significant digits, such as 2/3, stays in
    range.
  - Bounds that are equal after rounding fail the order check.
- The error prints raw, unrounded numbers, so the message never contradicts itself and Canvas can
  reuse it: `Chart value 52000 for "2026" at "Jun" is above valueMax 50000.`
- **Empty charts** *(review)*. If every value is null or zero, the empty state wins and the range is
  not checked, as in Release 012.

**Domain** *(review)*.
- **Explicit bounds** are the domain edges exactly. Recharts widens a domain only for data outside
  it, and the model refuses such data, so the domain is never widened past our ticks. Release 012
  had that symptom for mixed-sign stacks: an unlabelled band beyond the last tick.
- **A free bound** steps over the span left by the explicit one: `[valueMin, dataHigh]` or
  `[dataLow, valueMax]`. With no explicit bounds the span is the data extent including zero, as in
  Release 012. The free bound rounds outward to the next multiple of the step. If it would equal the
  explicit bound (flat data at `valueMin`, or a single row), it moves one step beyond.
- So the rerun case, a revenue line from 31k to 48k with `valueMin={30000}`, gets the domain
  `[30000, 50000]`.

**Ticks** *(review)*.
- Ticks are the step's multiples inside the domain, found in integer arithmetic:
  `k = ceil(lo / step − ε) … floor(hi / step + ε)`, normalised to 12 significant digits. An exact
  bound such as 0.3 is never dropped by floating-point division.
- If fewer than two ticks fit, the step shrinks through the nice sequence (5, 2.5, 2, 1 × 10ⁿ), at
  most 8 times. After that, the two bounds themselves are the ticks.
- **Labelled bounds** *(added in implementation)*. When the computed step leaves an explicit bound
  off the ticks, the scale tries the next larger, then the next smaller, nice step. It keeps the
  first whose ticks include every explicit bound and number 2 to 6. The free bound is recomputed for
  that step, so `valueMin={25000}` over data up to 72k gives 25K, 50K, 75K rather than 40K, 60K,
  80K with an unlabelled bottom edge.
- If no neighbouring step labels the bound, it is the unlabelled plot edge (for example
  `valueMax={0.7}`).
- **No clip.** The value axis does not use `allowDataOverflow` *(code review)*. The model already
  guarantees every value and running total lies inside the domain, so Recharts keeps it as given.
  The flag would also clip lines, areas and their active dots at the plot edge.
- Labels follow R8.

**Area baseline.** Recharts fills an area to `domainMax < 0 ? domainMax : max(domainMin, 0)`. A
raised `valueMin` therefore fills to the plot's bottom edge, and an all-negative range to its top,
with no extra prop.

**Cost if wrong:** medium. The stacked-chart zero rule goes slightly beyond the owner's literal bar
rule. It's flagged for the owner's review, and relaxing it later is additive.

### R7. Fix: stacked extents and float sums (Release 012 defects)

- For stacked charts, Release 012's `valueExtent` used each row's total. With mixed-sign data a
  running total can exceed the row total, so Recharts widened the domain past the last tick and left
  an unlabelled band. Release 013 uses the running totals.
- Float sums made a 100%-stacked percent chart's axis run to 150%. Normalising to 12 significant
  digits (R6) fixes it.
- **Cost if wrong:** low. Only charts with mixed-sign stacks or float-sum noise change their ticks,
  and they now cover the drawn marks exactly.

### R8. Tick labels show every tick exactly (Release 012 defect) *(review)*

- Release 012 formatted ticks at fixed precision: compact with one fraction digit, percent with none.
  So ticks every 2.5% printed `3%` and `8%`, and narrow ranges printed duplicates
  (`1.2M | 1.2M | 1.2M`).
- Release 013 picks the first formatter, in this order, that renders every tick exactly:
  1. compact with 0, 1 or 2 fraction digits;
  2. the full format with as many decimal places as the ticks need, up to 20.

  Percent uses as many fraction digits as the ticks need, so `99.9905%` is shown exactly.
- The code review found that the first implementation capped percent at 3 digits and the full form
  at 6, and so mislabelled narrow uptime ranges and micro values; both caps were lifted.
- **Exactness test.** A compact label is exact when its number, read with `formatToParts` and scaled
  by the compact unit, equals the tick value at 12 significant digits. The unit is the power of ten
  that the value divided by the label's number rounds to; this works in any locale, including `万`
  and lakh units.
  - The comparison is not a tolerance that grows with the value. That version passed "1B" for every
    tick between 1,000,000,000 and 1,000,000,001.
- Exact labels are necessarily distinct. The axis width still comes from exactly the labels drawn.
- **Cost if wrong:** none. Labels become accurate. Existing charts whose ticks were rounded (2.5%
  steps, for example) now show the exact value.

### R9. One width estimate for axis labels and centre text

Release 012's axis estimate was 7.6 px per character. Release 013 uses R1's character table at its
full semibold width for the regular-weight tick labels, a deliberately generous budget. Wide CJK
compact units and full-width currency signs are budgeted at 1 em. Latin digits stay at about 7.6 px.

### R10. The ready signal covers every drawing input *(review)*

- The drawing signature (`chart.tsx`) now covers every input that affects the drawing: width, all
  options, and every model field except the formatter functions, including `locale`, the resolved
  domain and ticks, `barSize`, `centerValue` and `centerLabel`.
- Changing any one of them on a mounted chart returns it to `drawing`, and then `ready`.

### R11. Licence items

1. Rename `COPYRIGHT` to `LICENSE` and drop its maintainer note. `THIRD_PARTY_NOTICES.md` links the
   new name.
2. Add `"license": "UNLICENSED"` to `package.json`. npm packs `LICENSE` automatically, so the package
   gains one packed file; package-identity expectations follow.
3. The README gains a line linking `LICENSE` and `THIRD_PARTY_NOTICES.md`.
4. `.gitignore` gains `.env`, `.env.*`, `*.pem`, `*.key` and `.npmrc`.
5. `scripts/library-licenses.ts`:
   - matches `NOTICE` files too, so es-toolkit's Lodash notice ships;
   - supplies `react-remove-scroll-bar`'s MIT text from a committed override (its package ships no
     licence file), copied from its upstream repository's LICENSE;
   - throws when a bundled package that declares MIT, ISC or a BSD licence has no licence or notice
     body and no override.
   - `THIRD_PARTY_NOTICES.md` then drops its "gaps" paragraph.

### R12. Every enumerated value is checked *(review)*

- Release 012 checked only `type` and `aspectRatio` against their vocabularies. `layout: "stack"`
  silently rendered as grouped. Release 013 checks every enumerated prop, and each throws
  `Chart <prop> must be one of <values>.`:
  - `layout`, `orientation`, `curve`, `valueFormat`, `animation`, `barSize` and `centerValue`;
  - the booleans `xAxis`, `yAxis`, `grid` and `legend` must be booleans;
  - `centerLabel` must be text.
- **Cost if wrong:** low. Only invalid documents change, and each now fails with a clear message.

### R13. Error messages Canvas can mirror *(review)*

Messages use raw numbers (`String(n)`), never the chart's formatter, so they don't depend on locale or
format. Stacked checks say "stack total". The new messages:
- `Chart locale "<tag>" is not a supported BCP 47 language tag.`
- `Chart <prop> must be one of <values>.` (R12: layout, orientation, curve, valueFormat, animation,
  barSize, centerValue)
- `Chart <prop> must be true or false.` (R12: xAxis, yAxis, grid, legend)
- `Chart centerLabel must be text.` (R12)
- `Chart currency must be an ISO 4217 code.` (also when `currency` is not text)
- `Chart barSize applies only to bar charts.`
- `Chart centerValue applies only to donut and radial charts.`
- `Chart centerLabel applies only to donut and radial charts.`
- `Chart centerLabel needs centerValue "total".`
- `Chart valueMin and valueMax apply only to area, bar and line charts.`
- `Chart valueMin and valueMax must be finite numbers.`
- `Chart valueMin must be below valueMax.`
- `Chart valueMin and valueMax must include zero on bar charts and stacked charts.`
- `Chart value <n> for "<series>" at "<category>" is below valueMin <min>.` (or "above valueMax")
- `Chart stack total <n> at "<category>" is above valueMax <max>.` (or "below valueMin")

The numbers are the author's raw values: the bound as given and the raw running sum. Comparisons use
12 significant digits, so a printed number never contradicts the message.

## Render changes from Release 012

Canvas sees these visible changes. They go in the release notes and the handoff:
- Formatting defaults to `en-US` instead of the browser's language (R4).
- Radial: share-of-total sweeps, a 50% inner radius, and a centre total shown by default (R2).
- Donut totals may render smaller, switch to the compact form, or hide in small frames, instead of
  overflowing (R1).
- Tick labels show exact values, e.g. `2.5%` where Release 012 printed `3%` (R8).
- Mixed-sign stacks and float-sum percent stacks get ticks that cover their marks (R7).
- `centerLabel` outside donut and radial now throws (R3). Stored Canvas documents with a non-blank
  `centerLabel` on an area, bar or line chart must be migrated (field removed) before vendoring; the
  handoff gives this as an adoption step.
- Bars are capped at 24 px by default (`barSize` `md`), where Release 012 drew them full width (R5).
- Polar charts keep Recharts' 5 px margin, so donut geometry is unchanged apart from the centre total.
- A chart with a hidden x-axis no longer reserves room for edge labels, so its plot is wider. This
  affects area, line and horizontal bar charts; sparklines run edge to edge.
- Axis widths come from the per-character estimate instead of 7.6 px per character, so the value or
  category axis of every cartesian chart moves by a few pixels.
- The donut caption is positioned by the new explicit stack layout, so it moves slightly even where
  the total still renders at `2xl`.
- A radial part with no value sweeps nothing; Release 012 drew it as a full ring.
- The centre caption is added to the hidden summary, e.g. "…totalling 1,130 (Customers): …", because
  the drawn centre is hidden from assistive technology.
- Invalid enumerated values (`layout: "stack"`) now throw instead of silently falling back (R12).

## Open option for the owner

- **Exporting the validator** *(review)*. Canvas mirrors the combination rules at write time from the
  handoff's prose, including the data-dependent ones (running stack totals in series order, with null
  counted as 0).
- Exporting the pure validator from `chart-model.ts`, which has no Recharts dependency, as a separate
  helper would give Canvas the exact predicates and messages.
- That adds a public export and changes the export inventory, so Release 013 does not do it without
  the owner's say-so.

## Contract, knowledge and Canvas handoff

- **Contract:** the chart family contract is regenerated.
  - New local props: `locale` (string), `barSize` (enum), `valueMin` and `valueMax` (number),
    `centerValue` (enum).
  - The executable contract checks each new prop's type; the combination rules stay runtime facts,
    as the owner accepted for Release 012.
- **Knowledge:** the entry gains the new options and rules, and when to raise `valueMin` (a line
  whose variation is lost against zero).
- **Canvas handoff:** new props and rules, the render changes above, and the error messages for
  Canvas's write-time checks.

## Verification plan

**Model tests.**
- Every new rule and its exact message (R13), and the vocabulary checks (R12).
- Blank `centerLabel` counts as absent.
- Locale: `und`, `zz`, `""`, a number and `null` are rejected; `en-us` canonicalises.
- Running-total validation for stacked charts: mixed signs, and float sums such as
  `[0.33, 0.56, 0.11]` with `valueMax={1}`.
- Empty-state precedence, and raw numbers in range errors.

**Locale default.**
- A spy asserts that every `Intl.NumberFormat` the chart builds receives `en-US` when `locale` is
  unset.
- A child-process test runs the model under `LC_ALL=de_DE.UTF-8` and still gets `en-US` output.

**Runtime tests.**
- Centre fit: the size chosen per hole and value length, the shorter-form choice (`de-DE`, `es-ES`,
  and `ar`, one of Canvas's two Page locales),
  hiding the total, dropping the caption, the radial total, share sweeps (a sector sweep equals
  share × 360°) and `centerValue="none"`.
- Bars: `barSize` packing (grouped: `barSize = min(cap, slot)`, 4 px intra-group gap) and
  `maxBarSize` for single-series.
- Ticks:
  - the rerun case's domain `[30000, 50000]`;
  - a one-row line at `valueMin`, and `valueMax` only with negative data;
  - exact-bound inclusion (0.3, 0.6, 0.7);
  - unique, exact labels in narrow ranges (number, currency in `en-US` and `de-DE`, percent);
  - mixed-sign stack ticks, the 100%-stack ending at 100%, and the negative-range area baseline.
- Redraw: changing only `locale`, `valueMin`, `barSize` or `centerValue` on a mounted chart returns
  it to `drawing`, then `ready`.

**Stories (browser, axe gate).** Every story keeps the label-clipping, settle-at-ready and keyboard
checks.
- A 180 px donut with a currency total, which is Canvas's case.
- A radial with total and caption, and a 180 px five-part radial.
- Bar sizes, shot where they differ.
- A revenue line from 31k to 48k with `valueMin={30000}`, the rerun case.
- `de-DE`, `ja-JP` and `ar` locale charts with values of 10,000 or more.
- A `CenterFit` matrix story. After `document.fonts.ready` and `ready`, it asserts that every corner
  of each centre text box lies within the hole radius, read from the rendered sector, minus 1 px. It
  also asserts the computed font size is one of the ladder's token sizes. The matrix covers donut and
  radial at 160, 180, 220 and 320 px, totals in `en-US` and `en-GB` USD, `de-DE` EUR, `ja-JP` JPY and
  `ar` USD totals, a percent `100%` total and totals in the millions, with and without a caption. This
  is #22's criterion: the total stays inside down to a 160 px plot for every `valueFormat`.

**Determinism browser test.**
- Add the new variants.
- Captures at `ready` stay pixel-identical.
- The same chart without `locale`, captured in Playwright contexts with `de-DE` and `en-US`, gives
  identical pixels.

**Gallery.** Re-shoot the radial (against shadcn's "Radial Chart - Text"), the donut (against "Pie
Chart - Donut with Text"), a small-frame donut, and bar sizes.

**Licence.**
- The generated `THIRD_PARTY_LICENSES.txt` contains es-toolkit's NOTICE and the
  `react-remove-scroll-bar` MIT text.
- A unit test proves the generator throws for an MIT package with only a README.
- The packed file list includes `LICENSE`.

**Release.**
- Identity `shadcn-radix-release-013`, with Release 012's record `2909c411…` and manifest
  `cb65fccb…` frozen (done in `bcc7290`).
- Generation twice, then a clean-worktree `release:verify`, `candidate:generate` and
  `candidate:verify`, and the full suites.
- The macOS release qualification. The repository is public, so it is free.
