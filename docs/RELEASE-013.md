# Release 013: chart centre totals, chart options and licence notices

Release 013 implements the chart follow-ups Canvas raised after adopting Release 012
(amjed-fadul/agentic-design-canvas#56):
- amjed-fadul/shadcn-design-system#22: centre totals that fit their ring;
- #23: `locale`, `barSize` and the value-axis range.

It also takes the licence items deferred from #24, because they change release inputs. Tokens and
the export inventory are unchanged.

The design and every ruling are in
[the spec](superpowers/specs/2026-10-05-release-013-chart-options-design.md), and the Canvas handoff
is [CANVAS-RELEASE-013](CANVAS-RELEASE-013.md).

**Status: candidate, awaiting owner review.** The macOS release qualification runs next; the repository is public, so it is free. The producer does not tag or approve the release.

## Changes

- **Chart props** (19 → 24):
  - `locale`: a supported BCP 47 tag, `en-US` by default;
  - `barSize`: `sm`, `md` (default) or `lg`, a maximum thickness of 12, 24 or 40 px;
  - `valueMin` and `valueMax`;
  - `centerValue`: `total` (default) or `none`.

  `centerLabel` now also applies to radial charts.
- **Centre totals** (`chart-text.ts`):
  - **Width estimate:** each character gets an advance width, measured from Geist at weight 600 with
    tabular figures; CJK characters count 1 em and marks 0.
  - **Fit:** each line is checked against the hole's chord at its farthest edge, using Geist's
    measured 1.167 em text box. The full value is preferred, then the shorter of full and compact.
    Nothing fits, nothing drawn: the total is left out rather than overflow.
  - **Token governance:** the size is a literal font-size token class, so the token audit stays at
    zero unresolved; `text-xl` joins the canonical map.
- **Radial:** a hidden angle axis spanning the total makes each ring sweep its share. The inner radius
  is 50%.
- **Value scale** (`chart-scale.ts`):
  - **Extents:** running-total extents, so mixed-sign stacks are covered, with 12-significant-digit
    normalisation.
  - **Domains:** explicit bounds are the plot edges exactly (with `allowDataOverflow`), and a free
    bound steps over the span left.
  - **Labelled bounds:** a neighbouring nice step that labels an explicit bound is preferred.
  - **Ticks** come from integer arithmetic, and their labels show every tick exactly in any locale.
- **Validation** (`chart-model.ts`):
  - every enumerated value and boolean is checked;
  - `locale` must be supported;
  - out-of-range data and stack totals are refused, with raw-number messages Canvas can mirror;
  - an empty chart wins over the range check.
- **Bars:** grouped bars pack at `min(barSize, slot)` with a 4 px gap; single and stacked bars are
  capped.
- **Ready signal:** the draw signature covers every model field and option, so a change to only
  `locale`, a bound, `barSize`, `centerValue` or raw data values redraws. This fixes Canvas's RT-1.
- **Sparklines:** a hidden x-axis reserves only the plain edge margin.
- **Licence:**
  - `COPYRIGHT` becomes `LICENSE`, `package.json` declares `"license": "UNLICENSED"`, and the README
    links both licence documents;
  - `.gitignore` ignores secrets;
  - the licence generator ships NOTICE files (es-toolkit's Lodash notice) and supplies
    `react-remove-scroll-bar`'s upstream MIT text (byte-identical to upstream blob `7c08c399`);
  - it fails the build on a declared MIT, ISC or BSD package that ships no licence text.
- **Release identity:** `0.0.0-release.13`, with Release 012's record (`2909c411…`) and manifest
  (`cb65fccb…`) frozen.

## Render changes from Release 012

The [Canvas handoff](CANVAS-RELEASE-013.md#render-changes-from-release-012) lists them with
adoption steps:
- `en-US` formatting by default;
- bars capped at 24 px;
- radial share sweeps and a centre total;
- donut totals fitted or left out;
- exact tick labels;
- stacks covered;
- `centerLabel` and invalid enumerated values now throw.

## Design review

Two independent multi-agent reviews shaped this release:
- **Design review:** four lenses (visual, closed API, edge cases, fact-check) reviewed the spec,
  with high-severity findings adversarially verified. Every ruling marked *(review)* in the spec came
  from it, including four latent Release 012 defects this release fixes: radial sweeps, tick
  rounding, float stack sums and mixed-sign stacks.
- **Code review:** five lenses (the scale, the model's rules and messages, the renderer, the licence and release identity with test quality, and spec conformance), with high-severity findings adversarially verified. Every confirmed finding was fixed in `45960ce`: `allowDataOverflow` (it clipped lines and areas at the edges) was removed; radial parts with no value no longer draw full rings; bounds are normalised so data equal to a bound passes; and tick labels stay exact at the extremes. The spec was aligned with the shipped code.

## Owner decisions applied

- **#22 and #23:** the owner's 2026-10-04 decisions are recorded in both issues.
- **`barSize` default:** `md`, from the owner-decisions comment on #23 (2026-10-04T14:11Z). An
  earlier line in the issue body said unset kept the automatic width; that was the producer's
  inference and is corrected there.
- **Producer rulings for the owner to confirm:**
  - The zero-in-range rule extends to stacked areas (R6).
  - Release 012's silently ignored `centerLabel` outside donut and radial now throws (R3).
- **Open option:** exporting the pure validator for Canvas's write-time checks would add a public
  export, so it was not done.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `0d56818a4042708fb402e947e78a563fa32f96418d7692359037a0a77784bec6` |
| Release record file `provenance/releases/shadcn-radix-release-013.json` | `fd387d2d653a1af1d10b9783e370ca2d9a1bce4ccd2595470a968cc33c6f5b8b` |
| Distribution manifest | `bed576a6bdae02fd9666726ecabb5aed8a1a14f27175b47dcd8eb1842abcdd9a` |
| Tarball `adc-shadcn-design-system-0.0.0-release.13.tgz` | `3e1d0a0b6bd8b5b36bfe821cab23e9351a603ece0a3cb3d72c04df9f66663935` |

- **Integrity:** `sha512-QJ05JpUC/DtJMo/trCi4bkwuSB/fDW06jQTxDLK9e4BgDZTPHB0WZm9tnYIGTAFWrPZ5zg8zkwHOCe+FOYcrGg==`.
- **Packing:** 64 packed files, from 375 implementation inputs.
- **Producer commit:** `33f63866890a66d5b53c1c3f515b4351bf3fc572`.
- **Toolchain:** Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.
- **Location:**
  `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-013-candidate/`. The
  manifest is also committed as `provenance/distributions/shadcn-radix-release-013.distribution.json`.

## Verification

All commands ran with Node 22.18.0 and npm 10.9.3, from a detached clean worktree at `33f6386`
unless noted.

- **Release generation:** ran twice at the head, with byte-identical output. Historical records,
  including Release 012's, were checked before and after.
- **`release:verify`:** accepted payload `0d56818a…`.
- **`candidate:verify`:** rebuilt the package from producer inputs. All 64 packed files matched the
  retained candidate byte for byte, and no expectations were refreshed.
- **`npm run typecheck` and `npm run build`:** passed.
- **Unit suite:** all 127 files and 1,839 tests passed, including every real-build `package-identity`
  test.
- **Storybook:** `vitest --project=storybook` passed 44 files and 251 tests, with the axe gate at
  `error`; `build-storybook` passed. The 21 chart stories include:
  - `CenterFit`: 128 charts. After fonts load, every corner of every centre text box lies inside its
    hole, measured from the rendered sectors, and the total's computed size equals its token's size.
  - `BarSizes`, `LineRaisedMinimum`, `Sparkline`, `DonutSmall`, `RadialSmall`, and the German,
    Japanese and Arabic locale stories.
  - Every story keeps the settle-at-ready, label-clipping, keyboard and Escape checks.
- **Determinism (`tests/release013-chart.browser.mjs`):** 35 checks passed.
  - 14 lazily loaded variants were byte-identical at `ready` across fresh pages, in light and dark.
  - A chart without `locale` rendered identical pixels in `de-DE`, `ar-EG` and `ja-JP` browsers and
    in `en-US`.
  - Reduced motion skips drawing.
- **Tarball contents:**
  - `LICENSE` is packed, and `package.json` declares `"license": "UNLICENSED"`;
  - `THIRD_PARTY_LICENSES.txt` carries es-toolkit's NOTICE (Lodash) and `react-remove-scroll-bar`'s MIT
    text;
  - `index.js` contains no Recharts;
  - `styles.css` carries every centre size class (`text-sm` to `text-2xl`) and `tabular-nums`;
  - `charts.js` is 652 KB (158 KB gzipped).
- **Contract and inventory audits (in the branch worktree):** 50 files and 1,002 tests passed after
  the review fixes.
- **`npm audit`:** full and production audits found 0 vulnerabilities.
- **Gallery:** see [the Release 013 gallery](RELEASE-013-CHART-GALLERY.md).
- **macOS release qualification:** next; the repository is public, so the run is free.

## Build location

As before: build candidates from a checkout with no ancestor `package.json` or `node_modules`, or
the input guard rightly fails with `UNBOUND_INPUT`. This candidate was built from a detached
worktree in a session temporary directory.
