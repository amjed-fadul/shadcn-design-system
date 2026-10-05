# Release 013 chart gallery

This is the light and dark comparison of the Release 013 chart changes against the closest shadcn
examples at ui.shadcn.com/charts. It extends the
[Release 012 gallery](RELEASE-012-CHART-GALLERY.md).

## How it was captured

- **Our charts:** the determinism fixture `tests/fixtures/chart-determinism.html`. It lazy-loads
  Chart through the public charts entry inside a card frame. Captures were taken in headless
  Chromium (Playwright) at 2× pixel density once `[data-chart-state="ready"]` was set.
- **Frame widths:** each frame has 24 px padding and a 1 px border, so a 230 px frame gives Canvas's
  180 px plot.
- **shadcn's examples:** their single-example view pages, shot at a 400 px viewport, with dark mode
  set by shadcn's own `dark` class.
- **Sheets:** each sheet pairs our card (left) with the shadcn card (right).

Evidence lives under `~/.artifacts/shadcn-design-system/release013-gallery/`:

| File | SHA-256 |
| --- | --- |
| `r13-vs-shadcn-light.png` | `27ae3b94d96eee5ecb6485b51536c3389f75514ee2e9ed985537d6fcd9da5758` |
| `r13-vs-shadcn-dark.png` | `2ef65e10135f8bf81a97fd5c2aea43cb85b09cefbf3ef4fc296cd15450707df0` |

The individual cards are in `cards/`.

## Pairs

| Release 013 | shadcn example |
| --- | --- |
| Radial with total and caption | Radial Chart - Text |
| Donut at 180 px, currency total and caption | Pie Chart - Donut with Text |
| Bars at `md` (the default) and at `lg`, 640 px frame | Bar Chart - Multiple |
| Line with `valueMin={25000}` | Line Chart - Multiple |
| Sparkline (60 px, no axes, raised minimum) | — |

## What it shows

- **Radial total.** shadcn's "Radial Chart - Text" shows a single ring with its value in the centre.
  The Release 013 radial shows the sum of its parts in the centre, with the caption beneath. Each
  ring sweeps its share of that total, so the largest part (Free, 55%) no longer draws a closed ring.
- **Small donut.** Canvas reported that the total overflowed at 180 px. Release 013 fits it: at a
  180 px plot the full `$2,245,310` renders at a smaller token size inside the hole, with the caption.
  The `CenterFit` story checks the real text box against the hole across sizes, locales and formats.
- **Bar sizes.** `md` caps bars at 24 px. shadcn's examples use wide bars that fill most of each band;
  Release 012 did the same, which Canvas found too wide in dashboards. `lg` reaches 40 px where the
  band allows. Grouped bars stay packed 4 px apart at every size.
- **Raised minimum.** With `valueMin={25000}` the line's variation fills the plot. The ticks
  (25K, 50K, 75K) use the neighbouring nice step that labels the bound.
- **Sparkline.** The trend is visible at 60 px with no axes, and the plot runs edge to edge.

## Deliberate differences, unchanged from Release 012

- The coloured `chart-1..5` palette, instead of shadcn's monochrome ramp.
- The value axis is on by default.
- The legend appears for two or more series.
- The donut parts are separated by a gap.
