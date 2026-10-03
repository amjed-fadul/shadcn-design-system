# Release 012: governed chart family

Release 012 completes amjed-fadul/shadcn-design-system#19 with the chart component the Canvas
visual-gap requests asked for. It also ships the producer build-memory fix. Tokens are unchanged.

- **Chart:** one closed component for area, bar, line, donut and radial charts. It takes data, keys
  and named options only, behind a separate lazy entry, `@adc/shadcn-design-system/charts`.
- **Build memory:** the library build releases the producer contract graph before Vite runs.

The design is in [the approved spec](superpowers/specs/2026-10-03-release-012-chart-family-proposal.md),
the task list in [the plan](superpowers/plans/2026-10-03-release-012-chart-family.md), and the
contract ruling in [the spike](RELEASE-012-CHART-CONTRACT-SPIKE.md). The Canvas handoff is
[CANVAS-RELEASE-012](CANVAS-RELEASE-012.md). The visual review is the
[gallery](RELEASE-012-CHART-GALLERY.md).

**Status: candidate, awaiting owner review.** The owner reviews the gallery and accepts or rejects
the candidate. The release is not tagged or approved by the producer.

## Changes

- **Chart family (`chart`, repo-native):**
  - 19 closed props;
  - contract `contracts/components/families/chart.json`, with knowledge and provenance;
  - families 41 → 42 and public exports 210 → 211.

  `data` and `series` are written structurally in the source, so the contract states their JSON
  shape.
- **Lazy entry:** `./charts` (`dist-library/charts.js`, 633 KB, 153 KB gzipped). It bundles Recharts 3.8.1
  and `react-is` 19.3.0, both pinned as dev dependencies. Peer dependencies are unchanged.
  - A crawler test proves nothing the root entry reaches imports Recharts.
  - Full and production `npm audit` report 0 vulnerabilities.
  - The spike records why `react-is` 19.3.0 is bundled.
- **Visual defaults:** shadcn-style marks, grid, axes, tooltip and legend, coloured only with
  `chart-1..5` in slot order. Every Recharts default colour is replaced with a token. The value axis
  uses nice ticks (1, 2, 2.5 or 5 × 10ⁿ) chosen by the chart and is sized from those exact labels.
  Stacked bar segments have a 2px surface gap.
- **Draw signal:** `data-chart-state` on `[data-slot="chart-plot"]` moves through `measuring`,
  `drawing` and `ready`.
  - **When ready fires:** after the animation duration, once the marks are unchanged on consecutive
    frames. Animation off and reduced motion go straight to `ready`.
  - **Redraws:** any change to data, options or plot size starts a new drawing.
  - **Why mark watching:** Recharts' `onAnimationEnd` also fires on effect cleanup, and Recharts
    restarts an animation whenever a mark re-renders, so neither is a finished signal. The plot
    therefore re-renders only when a signature of what it draws changes.
- **Sizing:** exactly one of `height` or `aspectRatio`. A skeleton holds the final size until the
  container is measured.
- **Accessibility:**
  - **Keyboard:** one tab stop. Arrow keys move between data points and Escape dismisses the tooltip.
  - **Screen readers:** a `figure` named by `title` and described by a summary sentence and a
    visually hidden data table.
- **Validation:** invalid combinations throw a `ChartPropsError` that names the rule. Examples include
  `layout` outside area and bar, a sixth series, repeated or negative donut parts, and a missing
  currency.
- **Token analyzer:** maps `chart-1..5` and `text-2xl` to their contract tokens.
- **Build memory (folded in as the owner decided):** `scripts/build-library.mjs` loads the contract
  graph in a scope that only lets `expectedProjection` escape.
  - The candidate's child build runs with a 6 GB heap.
  - The real-build identity tests run at 6 GB with GC tracing.

## Deviations from the approved spec

1. **Lines never stack.** The spec allowed `layout` on line charts. Stacked lines read as
   independent trends, and the renderer never stacked them, so `layout` applies only to area and
   bar.
2. **Legend instead of direct labels.** The spec asked for direct series labels when there are four
   or fewer. Release 012 always shows a legend for two or more series or parts. Together with the
   data table, identity never depends on colour alone. Direct labels are a possible follow-up.
3. **No radial centre total.** The donut shows its total; the radial chart's 30% inner hole is too
   small for it.
4. **Token dependencies.** The spec listed `chart-1..5`, `border`, `card`, `popover` and others.
   The per-export token analyzer reads only the exported function, and Chart's styling lives in
   module-private parts. The contract therefore records `spacing.unit` only. Colour use is proven
   at runtime instead: tests pin every series to `var(--chart-N)` and reject raw colours. See open
   decision 1.
5. **Source audit route.** The spec proposed pinned Recharts hosts, as for Lucide. The spike chose
   module-private hosts instead, which needed no analyzer extension.
6. **Gallery location.** The gallery story is `Components/Chart/Gallery`, not `Charts/Gallery`.
   The side-by-side comparison sheets live under `~/.artifacts/shadcn-design-system/release012-gallery/`.

## Open decisions for the owner

1. **Token attribution of private parts.** Should the token analyzer be extended to attribute
   module-private components' classes and token-valued attributes to the export that renders them?
   Today Chart's contract under-reports its token use.
2. **Opaque `data` and `series`.** The contract's structured type language has no object kind, so
   these props are recorded as `typescript` types with their exact shapes. Two options:
   - Canvas adds an authoring policy for them (recommended for now).
   - A later release extends the type language with object and record kinds. Canvas's registry
     would then need the same kinds.
3. **Runtime-only combination rules.** The analyzers derive conditional APIs only from boolean
   unions, and `hardConstraints` may only name capabilities. Rules such as "`valueKey` only for
   donut and radial" are runtime facts, stated in knowledge and the handoff.

## Not included

- **Container and breakpoint tokens:** still excluded, as the owner decided on 2026-10-03.
- **Twenty design-system work:** parked.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `23e77d9793de3a9f369697537830f86b389c75ae63595571ff7e6cd60fc63bd8` |
| Release record file `provenance/releases/shadcn-radix-release-012.json` | `2909c4112cd27a26e758c5080d731f98f75f5bb6b84de3edea94a08adf84335f` |
| Distribution manifest | `cb65fccb2eafda2d5bfedae66b53f52ab01833094268a130e3bfff60821c8c53` |
| Tarball `adc-shadcn-design-system-0.0.0-release.12.tgz` | `fb14eef438da7b1090dbda3b720b2615608dc74f6788dade949658a367957793` |

- **Integrity:** `sha512-olDkyZ7Db5xJRSax2JWvu2t2INndXvlbsbXfhUuWe3zBJeAWYUPcVSigZoGAY5reWcAMAf3hMdXyBkRdjMf7bg==`.
- **Packing:** 61 packed files, from 370 implementation inputs.
- **Producer commit:** `25c329f8b18cafe2b0bc53a9ccab15ae3ce04536`.
- **Toolchain:** Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.
- **Determinism:** release generation ran twice with byte-identical output. Historical Releases
  001–011 are frozen, including the Release 011 record `fd3afb47…` and manifest `9190ce39…`.
- **Location:** the external candidate is in
  `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-012-candidate/`. Its
  manifest is also committed as `provenance/distributions/shadcn-radix-release-012.distribution.json`.
  The tarball is not committed.

## Verification

All commands ran with Node 22.18.0 and npm 10.9.3, from a detached clean worktree at `25c329f`
unless noted.

- **Release generation:** ran twice per regeneration, with byte-identical output. Historical
  records were checked before and after each run.
- **`release:verify`:** accepted payload `23e77d97…`.
- **`candidate:verify`:** rebuilt the package from producer inputs. All 61 packed files matched the
  retained candidate byte for byte, and no expectations were refreshed.
- **`npm run typecheck` and `npm run build`:** passed.
- **Unit suite:** 124 files and 1,753 tests; 1,750 passed.
  - **Timeouts under load:** three `package-identity` tests timed out while the machine was loaded
    (15-minute load average 6.2 on 8 cores): the two real producer builds (130 s budget) and the R3
    archive check (30 s).
  - **Re-run alone at `25c329f`:** all 50 identity tests passed. The builds took 98 s and the R3
    check 24 s. `efe298b` raises those budgets to 240 s and 90 s, with no assertion changes.
  - **Earlier full run at `d95eed8`:** every test passed except two Release 003/004 identity
    expectations that `07e05d8` had broken. `31bf88b` fixed them.
- **Storybook:** `vitest --project=storybook` passed 44 files and 242 tests, with the axe gate at
  `error`; `build-storybook` passed. The 12 chart stories check, in a real browser:
  - one tab stop, arrow-key navigation and Escape dismissing the tooltip;
  - no axis or centre label leaving its surface;
  - for every animated chart, that no mark moves after `ready`.
- **Chart determinism (`tests/release012-chart.browser.mjs`):** 17 checks passed.
  - Eight chart variants are lazy-loaded through the charts entry. In light and dark, each was
    captured at `ready` in two fresh pages, and the captures were byte-identical.
  - The state sequence was `measuring`, `drawing`, `ready`; reduced motion skips `drawing`.
  - No page logged an error.
- **Gallery:** light and dark side-by-side sheets against shadcn's examples; see
  [the gallery](RELEASE-012-CHART-GALLERY.md).
- **Package contents (from the candidate tarball):**
  - `index.js` contains no Recharts, and a test proves nothing the root entry reaches imports it;
  - `charts.js` is 633 KB (153 KB gzipped);
  - `THIRD_PARTY_LICENSES.txt` covers Recharts, `react-is` and every bundled dependency (Redux
    Toolkit, Immer, Reselect, the d3 modules, `decimal.js-light`, `eventemitter3`, `es-toolkit` and
    others);
  - the packaged stylesheet carries every class the chart uses.
- **`npm audit`:** full and production audits found 0 vulnerabilities.
- **Not yet run:** the PR checks run on the draft PR. The manual macOS `release-qualification`
  workflow waits for the owner, as it did for Release 011.

## Build location

As in Release 011: build candidates from a checkout with no ancestor `package.json` or
`node_modules` (this machine has `~/package.json`). Otherwise the input guard rightly fails with
`UNBOUND_INPUT`. This candidate was built from a detached worktree in a session temporary directory.
