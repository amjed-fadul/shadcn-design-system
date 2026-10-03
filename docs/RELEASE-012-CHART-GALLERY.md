# Release 012 chart gallery

This is the light and dark comparison of every Release 012 chart type against the closest shadcn example at ui.shadcn.com/charts. The owner asked for it as part of the "polished defaults" requirement.

## How it was captured

- **Our charts:** the `Components/Chart/Gallery` story, rendered in headless Chromium (Playwright) at a 1280×900 viewport and 2× pixel density.
  - Every chart uses `animation="off"`.
  - The capture waits until every `[data-slot="chart-plot"]` reports `data-chart-state="ready"`, the same signal Canvas uses.
- **shadcn's examples:** their single-example view pages (`ui.shadcn.com/view/new-york-v4/<example>`), shot at a 400px viewport so each card is about the same width as ours.
  - Dark mode is shadcn's own `dark` class on the document root.
- **The sheets:** each one pairs our card (left) with the shadcn card (right), one row per chart type.

Evidence lives outside the repository, under `~/.artifacts/shadcn-design-system/release012-gallery/`:

| File | SHA-256 |
| --- | --- |
| `r12-vs-shadcn-light.png` | `1959443d002c5a66e12585f38b1843fb24ad83eedb7e000179031a798fb3eff7` |
| `r12-vs-shadcn-dark.png` | `8498a7a074d0188f3b9b32b02574f7388cc95e732640bcba3c5f796eed1850fc` |
| `r12-gallery-light.png` | `c03f5ab445951698c2268b32684cf9d4c8ba52f5a39091f61948de8878a9bbf4` |
| `r12-gallery-dark.png` | `8e25eafb22318f277d930128daa48bc0e5bf6bd646cd9890c96d669c76434688` |

The individual cards behind the sheets are in `cards/`.

## Pairs

| Release 012 | shadcn example |
| --- | --- |
| Area (two series, monotone) | Area Chart - Gradient |
| Bar (grouped) | Bar Chart - Multiple |
| Bar stacked | Bar Chart - Stacked + Legend |
| Line (two series) | Line Chart - Multiple |
| Donut with total | Pie Chart - Donut with Text |
| Radial | Radial Chart - Grid |

## What matches

- Rounded data ends on bars: 4px, on the end away from the baseline only. Stacked bars round only the top segment.
- A recessive dashed grid (`3 3`, half-opacity border colour), with no axis lines or tick marks.
- Muted 12px axis labels.
- A gradient area fill that fades towards the baseline.
- A 2px line stroke, plus an active dot on hover (r 4, ringed in the card colour).
- The shadcn tooltip: popover surface, border, small shadow, square swatches, the label first and values right-aligned.
- A centred total and caption on the donut.
- In dark mode, every colour comes from the same tokens, so cards, grid, labels and tooltip follow the theme without per-chart overrides.

## Deliberate differences

- **Palette.** shadcn's current examples use a monochrome blue ramp. Release 012 uses the Release 011 coloured, colour-blind-checked `--chart-1` to `--chart-5` palette, in fixed slot order, as the owner asked.
- **Value axis on by default.** Most shadcn examples hide the Y axis. Release 012 shows it because a chart without a scale can't be read. `yAxis={false}` matches shadcn's look.
- **Legend on by default for two or more series.** A legend appears whenever there are two or more series (or parts), so identity never depends on colour alone. A single series has no legend; the title names it. shadcn only shows a legend in its "Legend" variants. `legend={false}` turns it off.
- **Donut separation.** Parts are separated by a 2° gap with 4px rounded ends instead of a card-coloured stroke on touching wedges. The ring is slightly thinner (60–80% of the radius).
- **Radial tracks.** Each radial bar sits on a muted full-circle track, and the legend names the parts. shadcn's Grid example uses polar grid lines instead.

## Defects the comparison found, now fixed

- **Clipped Y-axis labels.**
  - *Cause:* the value axis was sized from the data extent, not the ticks Recharts draws, and the budget ignored Recharts' 6px tick-size offset. Labels such as `$80K` lost their first glyph.
  - *Fix:* the chart now chooses its own value ticks with Recharts' nice steps (1, 2, 2.5 or 5 × 10ⁿ) and passes them explicitly. Axis width comes from exactly those labels, and edge margins leave room wherever a label sits centred on the plot edge.
  - *Pinned by:* `tests/chart-runtime.test.tsx` checks the ticks. Every chart story's play function now fails if any label inside a chart surface is clipped.
- **Crowded gallery.** The meta decorator's `max-w-2xl` wrapped the gallery's own wider frame, which squeezed the plots to 179px and made Recharts drop every other month label. The gallery now opts into the wide frame through a `wide` story parameter.

## Out of scope

- shadcn's radar charts, interactive date-range examples and card footers ("Trending up…") are page content or chart types outside the Release 012 family.
- They were not compared.
