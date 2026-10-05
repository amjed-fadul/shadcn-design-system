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

**Status: rebuilt candidate accepted by the owner on 2026-10-05; macOS release qualification running.**
- **Rebuild:** the first macOS qualification failed on the chart's ready signal
  (see [macOS qualification](#macos-qualification)). It is fixed in `8545a64`, and the candidate was rebuilt from there.
- **Candidate:** the owner accepted the rebuilt tarball `2b63e645…` (payload `b880ec96…`),
  and with it the producer rulings below. The earlier tarball `3e1d0a0b…` is superseded: do not vendor
  it.
- **Qualification:** the manual macOS `release-qualification` workflow runs again on the commit that
  records this candidate. Commits after the source `8545a64` change docs and the committed manifest
  only.
- **Merge:** the owner merges.

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
- **Ready signal:**
  - **Every input redraws:** the draw signature covers every model field and option, so a change to
    only `locale`, a bound, `barSize`, `centerValue` or raw data values redraws. This fixes Canvas's
    RT-1.
  - **Ready means drawn** (spec R14, a Release 012 defect found by the first macOS qualification):
    ready follows Recharts' own animation start and end for each mark. Recharts sets a mark's final
    frame before it reports the end, and only an end that comes 400 ms after the mark's start counts.
    A fresh plot waits for its marks to finish; an update that moves none is ready after 400 ms; 180
    frames remain the backstop.
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
- `centerLabel` and invalid enumerated values now throw;
- `ready` once the draw animation has finished (line and area charts about 60 ms later).

## Design review

Two independent multi-agent reviews shaped this release:
- **Design review:** four lenses (visual, closed API, edge cases, fact-check) reviewed the spec,
  with high-severity findings adversarially verified. Every ruling marked *(review)* in the spec came
  from it, including four latent Release 012 defects this release fixes: radial sweeps, tick
  rounding, float stack sums and mixed-sign stacks.
- **Code review:** five lenses (the scale, the model's rules and messages, the renderer, the licence and release identity with test quality, and spec conformance), with high-severity findings adversarially verified. Every confirmed finding was fixed in `45960ce`: `allowDataOverflow` (it clipped lines and areas at the edges) was removed; radial parts with no value no longer draw full rings; bounds are normalised so data equal to a bound passes; and tick labels stay exact at the extremes. The spec was aligned with the shipped code.
- **Qualification:** the macOS release qualification found the ready defect, fixed in `8545a64`
  (see below).

## macOS qualification

- **First run:** [run 37251218657](https://github.com/amjed-fadul/shadcn-design-system/actions/runs/37251218657)
  on `abe23cd` failed. Every step up to the Storybook tests passed, including all 1,839 unit tests
  and the build. Storybook then failed one of 251 tests: the `Bar` story reported `ready`, then its
  bars moved by 117 px.
- **Cause:** Release 012's ready watcher, reproduced with a CPU-throttled probe. It took two unchanged
  frames after 400 ms as finished. On a slow CPU, frames arrive in bursts a few milliseconds apart, and
  the wait can end before the marks have mounted. It also read only path data, so line and area
  charts, which animate a dash pattern and a clip rectangle, reported `ready` about 60 ms early on any
  machine.
- **Fix:** `8545a64` (spec R14). The new checks fail on the old watcher and pass on the fix:
  - the story settle check: 7 line and area stories;
  - the browser test: `area` at full speed;
  - the jsdom runtime test: the stacked area.
- **Candidate:** rebuilt from `8545a64`. The tarball accepted earlier (`3e1d0a0b…`) is superseded and
  must not be vendored.

## Owner decisions applied

- **#22 and #23:** the owner's 2026-10-04 decisions are recorded in both issues.
- **`barSize` default:** `md`, from the owner-decisions comment on #23 (2026-10-04T14:11Z). An
  earlier line in the issue body said unset kept the automatic width; that was the producer's
  inference and is corrected there.
- **Producer rulings, accepted with the candidate (2026-10-05):**
  - The zero-in-range rule extends to stacked areas (R6).
  - Release 012's silently ignored `centerLabel` outside donut and radial now throws (R3).
  - `barSize` defaults to `md`.
- **Open option:** exporting the pure validator for Canvas's write-time checks would add a public
  export, so it was not done.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `b880ec969b60eba4de6a16d5b835303ee9ea06f933fc93a989ede5161c65a409` |
| Release record file `provenance/releases/shadcn-radix-release-013.json` | `aaa0ced0fb66e624bc405a075f7546bd305cd6feace7b37702806c538923e80a` |
| Distribution manifest | `112cc081ed62acc8ecfbc1d14fed3adb11c25560336bb3729c6ef8a95bab6f17` |
| Tarball `adc-shadcn-design-system-0.0.0-release.13.tgz` | `2b63e645b497446d8a0939914450b581efbfc1bb72bf37b6070a5876801ae10a` |

- **Integrity:** `sha512-vqxzEJTrYyZsbP7om4wS2hQA6LJhwZm/mIziUiYNH0Pj7UPiH5XX4bTN/TxjGEO6qHjxYMD0Psmax/xroYM/zg==`.
- **Packing:** 64 packed files, from 375 implementation inputs.
- **Producer commit:** `8545a644b432a376b892329452af6a8e7b3aee09`.
- **Toolchain:** Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.
- **Location:**
  `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-013-candidate/`. The
  manifest is also committed as `provenance/distributions/shadcn-radix-release-013.distribution.json`.

## Verification

All commands ran with Node 22.18.0 and npm 10.9.3, from a detached clean worktree at `8545a64`
unless noted.

- **Release generation:** ran twice at the head, with byte-identical output. Historical records,
  including Release 012's, were checked before and after.
- **`release:verify`:** accepted payload `b880ec96…`.
- **`candidate:verify`:** rebuilt the package from producer inputs. All 64 packed files matched the
  retained candidate byte for byte, and no expectations were refreshed.
- **`npm run typecheck`:** passed.
- **Unit suite:** 1,846 of 1,847 tests passed, in 127 of 128 files.
  - The failure: `package-identity`'s real build with an input injected through
    `scripts/release-inputs.ts` hit its 120 s build timeout and was killed before printing anything.
    The gallery was being re-shot on the same machine at the time.
  - The test doesn't touch the chart, and it passed for the earlier candidate and on the macOS
    runner. It is being rerun on its own.
- **Storybook** (branch worktree at `8545a64`; the clean-worktree run is in progress):
  `vitest --project=storybook` passed 44 files and 251 tests, with the axe gate at `error`. The 21
  chart stories include:
  - `CenterFit`: 128 charts. After fonts load, every corner of every centre text box lies inside its
    hole, measured from the rendered sectors, and the total's computed size equals its token's size.
  - `BarSizes`, `LineRaisedMinimum`, `Sparkline`, `DonutSmall`, `RadialSmall`, and the German,
    Japanese and Arabic locale stories.
  - Every story keeps the settle-at-ready, label-clipping, keyboard and Escape checks. The settle
    check reads path data, dash patterns and clip rectangles.
- **Determinism and ready (`tests/release013-chart.browser.mjs`, branch worktree):** 75 checks passed.
  - 14 lazily loaded variants were byte-identical at `ready` across fresh pages, in light and dark.
  - A chart without `locale` rendered identical pixels in `de-DE`, `ar-EG` and `ja-JP` browsers and
    in `en-US`.
  - Reduced motion skips drawing.
  - With the CPU at full speed and slowed six times, nothing in the plot changed after `ready`, for
    all 14 variants and six updates (values on bar, area, line, donut and radial; a line's locale).
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
- **Gallery:** see [the Release 013 gallery](RELEASE-013-CHART-GALLERY.md). Re-shot after the fix,
  both sheets are byte-identical.
- **macOS release qualification:** runs again on the commit that records this candidate.

## Build location

As before: build candidates from a checkout with no ancestor `package.json` or `node_modules`, or
the input guard rightly fails with `UNBOUND_INPUT`. This candidate was built from a detached
worktree in a session temporary directory.
