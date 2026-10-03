# Release 012 Chart Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ship a governed, closed-API `Chart` family (area, bar, line, donut, radial) that wraps Recharts 3.8.1 behind a lazily loaded `@adc/shadcn-design-system/charts` entrypoint, plus the producer build-memory fix, as Release 012.

**Architecture:**
- **`Chart`:** one authorable component, `src/components/ui/chart.tsx`, renders a `figure` that contains:
  - a visually hidden title and summary;
  - the Recharts plot;
  - a visually hidden data table.
- **Closed API:** pure helpers in `src/components/ui/chart-model.ts` validate props, format values and derive series colours and summaries, so the logic is testable without Recharts.
- **Bundling:** Recharts is bundled into the `charts` entry chunk only, never into `index.js`, and never appears in public declarations.

**Tech stack:** React 18 and 19, TypeScript 5.5.4, Recharts 3.8.1, Tailwind 4.3.3 semantic tokens, Vitest 4.1.11 (jsdom and Storybook browser), Vite 7.3.6 library build, Node 22.18.0, npm 10.9.3.

**Spec:** `docs/superpowers/specs/2026-10-03-release-012-chart-family-proposal.md` (approved by the owner on 2026-10-03).

## Global constraints

- **Recharts:** pinned exactly at `3.8.1`. No other new runtime dependency except what Recharts 3.8.1 installs. `react-is` is bundled, never a consumer peer.
- **Closed API:** no function props, no `className`, `style`, colour, children or raw Recharts props on `Chart`.
- **Colours:** only `--chart-1..5`, in slot order. More than 5 series is rejected.
- **Text tokens:** text uses `foreground` and `muted-foreground`, never a series colour.
- **Size:** exactly one of `height` (px) or `aspectRatio` is required.
- **Animation:** `"auto"` respects `prefers-reduced-motion`; `"off"` disables animation.
- **Draw signal:** `data-chart-state` moves through `measuring`, then `drawing`, then `ready`.
- **Accessibility:**
  - the chart has `role="figure"`, labelled by `title`;
  - a visually hidden table and a one-sentence summary describe the data;
  - the chart is one tab stop, and arrow keys move between points.
- **Bundle:** the root `.` entrypoint stays free of Recharts code; the bundle test enforces it.
- **Audits:** `npm audit` (full and `--omit=dev`) must report 0 vulnerabilities.
- **History:** Releases 001–011 stay byte-for-byte unchanged; the Release 011 record and manifest are frozen.
- **Build location:** build candidates only from a checkout with no ancestor `package.json` or `node_modules` (`~/package.json` exists on this Mac). Use a detached worktree in the session scratchpad.
- **Commits:** each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **Empty and all-zero data:** the chart renders an explicit empty state ("No data"), never a blank plot, and `ready` still fires. Pinned in Task 4.
2. **Mismatched keys:** a `series.key` or `valueKey` missing from every datum throws a governed error that names the key. Pinned in Task 4.
3. **Non-numeric values:** strings in value fields are rejected, and `null` is shown as a gap. Pinned in Task 4.
4. **Container with 0 width (Canvas frame not laid out yet):** the chart stays `measuring` with a sized skeleton and never reports `ready` early. Pinned in Task 5.
5. **Currency without `currency`:** this throws. An invalid ISO code also throws, through `Intl.NumberFormat`'s `RangeError`, wrapped in a governed message. Pinned in Task 4.

---

### Task 1: Producer build-memory fix

The fix comes from the reviewed build-heap session's commits on local branch `claude/release-011-build-heap`.

**Files:**
- Modify: `scripts/build-library.mjs` (scope the contract graph so only `expectedProjection` escapes)
- Modify: `scripts/package-candidate.mjs` (child build heap back to 6144 MB)
- Modify: `tests/package-identity.test.ts` (real builds at 6144 MB with `--trace-gc`; live heap below 75% of the cap)

**Interfaces:** none. This is a producer-internal change.

- [ ] **Step 1:** `git cherry-pick 362e475` (the failing test first).
  - Resolve the conflict in `tests/package-identity.test.ts`: keep the test's 6144 MB `--trace-gc` form, which replaces Release 011's `--max-old-space-size=8192` line.
- [ ] **Step 2:** `git cherry-pick 234291a` (the fix).
  - Resolve the conflict in `scripts/package-candidate.mjs`: take `--max-old-space-size=6144` and drop the Release 011 two-line 8 GB comment.
- [ ] **Step 3:** from a clean scratch worktree (no ancestor `package.json`), run:
  ```bash
  NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project=unit --maxWorkers=1 tests/package-identity.test.ts -t "real producer build"
  ```
  Expected: both real-build tests pass, with live heap below 4608 MB.
- [ ] **Step 4:** commit the cherry-picks as they are. Their messages already carry the measurements.

### Task 2: Recharts dependency and the `/charts` entrypoint

**Files:**
- Modify: `package.json`, `package-lock.json` (add `recharts@3.8.1` and `react-is@19.3.0` as dependencies, then decide the dev or dep split in step 3)
- Create: `src/package/charts.ts` (exports from `../components/ui/chart`)
- Modify: `vite.library.config.ts` (`lib.entry.charts = src/package/charts.ts`)
- Modify: `scripts/release-inputs.ts` (public entrypoints include `./charts`)
- Modify: `package.json` `exports` (add `"./charts": { "types": "./dist-library/types/src/package/charts.d.ts", "import": "./dist-library/charts.js" }`)
- Test: `tests/library-package.test.ts`, `tests/package-identity.test.ts`

**Interfaces:**
- Produces: package subpath `@adc/shadcn-design-system/charts` exporting `Chart` and `type ChartProps`.
- Produces: public entrypoint keys `[".", "./charts", "./release", "./styles.css"]` in `packageIdentity`.

- [ ] **Step 1: Failing tests.**
  - In `tests/package-identity.test.ts`, the public-entrypoints assertion expects the four keys above.
  - In `tests/library-package.test.ts` (it builds the active library in a temp dir), add:
  ```ts
  test("keeps Recharts out of the root entry and ships it only in the charts entry", () => {
    const index = readFileSync(path.join(activeOutput, "index.js"), "utf8")
    const charts = readFileSync(path.join(activeOutput, "charts.js"), "utf8")
    expect(index).not.toMatch(/recharts|ResponsiveContainer|victory-vendor/)
    expect(charts).toMatch(/data-slot":"chart"|data-slot="chart"/)
  })
  ```
  `activeOutput` is the active-release library build that the suite already performs for the R4 and active package checks. If the suite only inspects archived R3 and R4 artifacts, add a `beforeAll` that runs `node --max-old-space-size=6144 scripts/build-library.mjs --out-dir <tmp>` from the repository root.
- [ ] **Step 2:** run both tests; expect FAIL (no `./charts`).
- [ ] **Step 3: Install.**
  ```bash
  npm install --save-exact recharts@3.8.1 react-is@19.3.0
  ```
  - Recharts is bundled. Following the `radix-ui` precedent, list it under `dependencies` only if public declarations reference its types; ours must not. So move both to `devDependencies` with exact pins, and let the bundle carry them.
  - Then run `npm audit` and `npm audit --omit=dev`; both must report 0.
- [ ] **Step 4:** add `src/package/charts.ts`:
  ```ts
  export { Chart } from "../components/ui/chart"
  export type { ChartProps } from "../components/ui/chart"
  ```
  - Add the `charts` lib entry and the `exports` map entry.
  - Add `"./charts"` to the public-entrypoints set in `scripts/release-inputs.ts` and its consumers (`packageIdentity`, the `PACKAGE_RELEASE_MAPPING_MISMATCH` check).
- [ ] **Step 5:** run the two tests; expect PASS once Task 4's `Chart` exists. Until then, keep a minimal `Chart` stub that renders `<figure data-slot="chart" />`, so the entry and bundle split can be proven now.
- [ ] **Step 6:** commit `build: add the lazily loaded charts entrypoint and pin Recharts 3.8.1`.

### Task 3: Spike — can the strict contract audits model a Recharts-backed component?

**Files:**
- Create (temporary): `src/components/ui/chart.tsx`, the minimal real shape: a `figure` root with `data-slot`, plus a Recharts `ResponsiveContainer` → `BarChart` → `series.map(s => <Bar/>)`.
- Create: `docs/RELEASE-012-CHART-CONTRACT-SPIKE.md` (findings and ruling)

**Steps**

- [ ] **Step 1: Run the canonical analyzers.** Use `analyzeJsxRenderTree`, `analyzeComponentPropSource`, `analyzeComponentTokenDependenciesForExport` and `listModuleExports` on the spike file, with a scratch script using vite `runnerImport`, as `derive-tokens.mjs` did in Release 011. Record each analyzer's output and every `unresolved` reason.
- [ ] **Step 2: Choose the modelling option.**
  - **Option A (preferred):** keep the render contract to the `figure` root and its intrinsic children. Move the Recharts tree into a module-private `ChartPlot` rendered through a finite, private registry keyed by `type`. This mirrors Icon's finite registry, which the analyzers already prove. The contract records `ChartPlot` as an internal host with no public props reaching it.
  - **Option B:** extend the render analyzer for a closed set of Recharts hosts, named and pinned from the 3.8.1 declarations as Lucide was in Release 008. Write adversarial mutation tests in both the canonical analyzer and the independent oracle.
  - Choose A if the analyzers accept it with zero unresolved facts. Otherwise choose B.
  - Write the ruling, with reasoning and cost if wrong, in the spike doc.
- [ ] **Step 3:** commit `docs: record the chart contract modelling ruling` (with the spike component, if kept).

### Task 4: Chart model (pure, jsdom-free)

**Files:**
- Create: `src/components/ui/chart-model.ts`
- Test: `tests/chart-model.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ChartType = "area" | "bar" | "line" | "donut" | "radial"
  export type ChartValueFormat = "number" | "currency" | "percent" | "compact"
  export type ChartAspectRatio = "16/9" | "4/3" | "1/1" | "2/1"
  export type ChartDatum = Readonly<Record<string, string | number | null>>
  export type ChartSeries = Readonly<{ key: string; label: string }>
  export type ChartModelInput = {
    type: ChartType; title: string; data: readonly ChartDatum[]; categoryKey: string
    series?: readonly ChartSeries[]; valueKey?: string
    layout?: "grouped" | "stacked"; orientation?: "vertical" | "horizontal"; curve?: "linear" | "monotone" | "step"
    valueFormat?: ChartValueFormat; currency?: string; height?: number; aspectRatio?: ChartAspectRatio
  }
  export type ChartModel = {
    series: Array<{ key: string; label: string; color: `var(--chart-${1 | 2 | 3 | 4 | 5})` }>
    format: (value: number) => string
    empty: boolean
    summary: string
    table: { columns: string[]; rows: string[][] }
  }
  export class ChartPropsError extends Error {}
  export function createChartModel(input: ChartModelInput, locale?: string): ChartModel
  ```

- [ ] **Step 1: Write the failing tests** in `tests/chart-model.test.ts`:
  ```ts
  import { describe, expect, test } from "vitest"
  import { ChartPropsError, createChartModel } from "../src/components/ui/chart-model"

  const revenue = [
    { month: "Jan", thisYear: 42000, lastYear: 30000 },
    { month: "Feb", thisYear: 48000, lastYear: 34000 },
    { month: "Mar", thisYear: 55000, lastYear: 37000 },
  ]
  const base = { type: "bar" as const, title: "Revenue by month", data: revenue, categoryKey: "month", height: 240 }

  describe("chart model", () => {
    test("assigns chart-1..5 in slot order", () => {
      const model = createChartModel({ ...base, series: [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }] })
      expect(model.series.map((s) => s.color)).toEqual(["var(--chart-1)", "var(--chart-2)"])
    })
    test("rejects a sixth series instead of inventing a colour", () => {
      const series = Array.from({ length: 6 }, (_, i) => ({ key: `s${i}`, label: `S${i}` }))
      expect(() => createChartModel({ ...base, series })).toThrow(ChartPropsError)
    })
    test.each([
      [{ height: undefined, aspectRatio: undefined }, /height or aspectRatio/],
      [{ height: 240, aspectRatio: "16/9" as const }, /height or aspectRatio/],
      [{ series: [{ key: "missing", label: "Missing" }] }, /missing/],
      [{ valueFormat: "currency" as const, series: [{ key: "thisYear", label: "2026" }] }, /currency/],
      [{ valueFormat: "currency" as const, currency: "DOLLARS", series: [{ key: "thisYear", label: "2026" }] }, /currency/],
      [{ title: "  ", series: [{ key: "thisYear", label: "2026" }] }, /title/],
      [{ type: "donut" as const, series: [{ key: "thisYear", label: "2026" }] }, /valueKey/],
      [{ layout: "stacked" as const, type: "donut" as const, valueKey: "thisYear" }, /stacked/],
    ])("rejects invalid combination %#", (patch, message) => {
      expect(() => createChartModel({ ...base, series: [{ key: "thisYear", label: "2026" }], ...patch } as never)).toThrow(message)
    })
    test("rejects non-numeric values but treats null as a gap", () => {
      expect(() => createChartModel({ ...base, data: [{ month: "Jan", thisYear: "42k" }], series: [{ key: "thisYear", label: "2026" }] })).toThrow(/number/)
      expect(createChartModel({ ...base, data: [{ month: "Jan", thisYear: null }], series: [{ key: "thisYear", label: "2026" }] }).empty).toBe(true)
    })
    test("formats values with named formats", () => {
      const currency = createChartModel({ ...base, valueFormat: "currency", currency: "USD", series: [{ key: "thisYear", label: "2026" }] }, "en-US")
      expect(currency.format(42000)).toBe("$42,000")
      const compact = createChartModel({ ...base, valueFormat: "compact", series: [{ key: "thisYear", label: "2026" }] }, "en-US")
      expect(compact.format(42000)).toBe("42K")
      const percent = createChartModel({ ...base, valueFormat: "percent", series: [{ key: "thisYear", label: "2026" }] }, "en-US")
      expect(percent.format(0.124)).toBe("12.4%")
    })
    test("summarises range and extremes in one sentence", () => {
      const model = createChartModel({ ...base, valueFormat: "currency", currency: "USD", series: [{ key: "thisYear", label: "2026" }] }, "en-US")
      expect(model.summary).toBe("Revenue by month, Jan to Mar: 2026 from $42,000 to $55,000.")
    })
    test("builds a data table with formatted values", () => {
      const model = createChartModel({ ...base, series: [{ key: "thisYear", label: "2026" }, { key: "lastYear", label: "2025" }] }, "en-US")
      expect(model.table).toEqual({ columns: ["month", "2026", "2025"], rows: [["Jan", "42,000", "30,000"], ["Feb", "48,000", "34,000"], ["Mar", "55,000", "37,000"]] })
    })
    test("reports empty for no rows and for all-zero values", () => {
      expect(createChartModel({ ...base, data: [], series: [{ key: "thisYear", label: "2026" }] }).empty).toBe(true)
      expect(createChartModel({ ...base, data: [{ month: "Jan", thisYear: 0 }], series: [{ key: "thisYear", label: "2026" }] }).empty).toBe(true)
    })
  })
  ```
- [ ] **Step 2:** run `npx vitest run --project=unit tests/chart-model.test.ts`; expect FAIL (module missing).
- [ ] **Step 3:** implement `src/components/ui/chart-model.ts`.
  - Validate in this order: title, size, type and key combination, series count, keys present, numeric values, currency.
  - Use `Intl.NumberFormat(locale, …)` with `maximumFractionDigits: 0` for number and currency, `style: "percent"` with `maximumFractionDigits: 1`, and `notation: "compact"`.
  - Wrap `RangeError` in `ChartPropsError("Chart currency must be an ISO 4217 code.")`.
  - The summary is `${title}, ${first} to ${last}: ${label} from ${min} to ${max}.`, with one clause per series, joined by `; `.
- [ ] **Step 4:** run; expect PASS.
- [ ] **Step 5:** commit `feat(chart): add the closed chart model with validation, formats and summaries`.

### Task 5: `Chart` component, rendering, sizing and the draw signal

**Files:**
- Modify/Create: `src/components/ui/chart.tsx`
- Test: `tests/chart-runtime.test.tsx` (jsdom, with a `ResizeObserver` stub that reports a set size)

**Interfaces:**
- Consumes: `createChartModel` and its types (Task 4).
- Produces: `Chart(props: ChartProps)`. `ChartProps` is `ChartModelInput` plus `xAxis?: boolean`, `yAxis?: boolean`, `grid?: boolean`, `legend?: boolean`, `animation?: "auto" | "off"`, `centerLabel?: string`. The DOM contract:
  - `figure[data-slot=chart]`, with attributes `data-chart-type`, `data-chart-state` and `role=figure`;
  - `figcaption[data-slot=chart-title]` (sr-only);
  - `p[data-slot=chart-summary]` (sr-only);
  - `table[data-slot=chart-table]` (sr-only);
  - `div[data-slot=chart-plot]`, with the inline style `height: <px>` or `aspect-ratio`.

**Steps**

- [ ] **Step 1: Failing tests.**
  - The root is a `figure` labelled by the title, and `table` rows match the model.
  - Size: `height` gives a fixed pixel height, and `aspectRatio` gives the CSS aspect ratio.
  - While the observed width is 0, the state stays `measuring`.
  - After a width is reported with `animation="off"`, the state becomes `ready` (Recharts renders an `svg.recharts-surface`).
  - With `animation="auto"` under `matchMedia("(prefers-reduced-motion: reduce)")` returning true, the state is `ready` without waiting for animation end.
  - Empty data renders `[data-slot=chart-empty]` with the text "No data", and the state becomes `ready`.
  - Unknown props such as `className`, `style` and `onClick` do not reach the DOM.
- [ ] **Step 2:** run; expect FAIL.
- [ ] **Step 3:** implement.
  - **Measuring:** a `ResizeObserver` on the plot div sets `width`. Render Recharts only when `width > 0`, passing explicit `width` and `height` (not `ResponsiveContainer`, to avoid a second measurement path).
  - **State:** `measuring` → `drawing` on the first render with a width. `drawing` → `ready` either on the series `onAnimationEnd` callbacks (one counter per series) or immediately when animation is off or reduced motion applies.
  - **Plot by type:**
    - `bar`: `BarChart` with `Bar radius={4}` (data end only when stacked); horizontal orientation uses `layout="vertical"`.
    - `area`: `AreaChart` with a `linearGradient` per series (40% to 5%).
    - `line`: `LineChart` with `strokeWidth={2}`, `dot={false}` and `activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}`.
    - `donut`: `PieChart` with `Pie innerRadius="60%"` and a centre label.
    - `radial`: `RadialBarChart`.
  - **Grid:** `CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5}`.
  - **Axes:** `tickLine={false}`, `axisLine={false}`, `tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}`.
  - **Tooltip:** a private `ChartTooltipContent`, with a popover surface, a 1px border, `shadow-sm` and `rounded-lg`. Each row shows a swatch, the label and the formatted value.
  - **Legend:** a private `ChartLegendContent`, shown by default when there are 2 or more series.
  - **Keyboard:** Recharts `accessibilityLayer` is on.
  - **Hidden text:** the visually hidden table and summary come from the model.
- [ ] **Step 4:** run; expect PASS.
- [ ] **Step 5:** commit `feat(chart): render area, bar, line, donut and radial charts with a draw-finished signal`.

### Task 6: Contracts, knowledge, provenance and inventories

Follow the Task 3 ruling.

**Files:**
- Create: `contracts/components/families/chart.json`, `contracts/knowledge/components/chart.json`
- Modify:
  - `contracts/components/component-contract-set.json` (`familyFiles`, `familyCount` 42);
  - `contracts/components/index.json`;
  - `contracts/knowledge/knowledge-set.json`, `contracts/knowledge/references.json` (`canonical.chart.source`);
  - `provenance/seed-components.json` (`chart`: `repo-native`, `canonicalBlobSha`);
  - `provenance/component-contract-source.json` (`familyIds`, `familyCount`, `seed` blob, and package pins `recharts`);
  - `tests/fixtures/canonical-component-inventory.ts`;
  - `tests/storybook-contract-coverage.test.ts`;
  - `tests/component-contract-inventory.test.ts` and `tests/component-contract-index.test.ts` (41 → 42);
  - `tests/executable-release.test.ts` (export count 210 → 211);
  - `tests/library-package.test.ts` (root entry exports 210; contracted exports 211 = root 210 + charts 1).

**Steps**

- [ ] **Step 1: Contract facts.**
  - Derive token facts with the canonical analyzer (as in Release 011).
  - Props come from `analyzeComponentPropSource`. Enums: `type`, `layout`, `orientation`, `curve`, `valueFormat`, `aspectRatio`, `animation`.
  - Booleans: `xAxis`, `yAxis`, `grid` and `legend`.
  - Required: `type`, `title`, `data` and `categoryKey`.
  - `composition.hardConstraints` records the runtime-enforced combinations from Task 4 as text.
- [ ] **Step 2: Knowledge.**
  - When to use each type.
  - When a stat tile or a table is better: a single value, or more than 5 series.
  - Never colour-only.
- [ ] **Step 3:** run the full contract audit set:
  ```bash
  npx vitest run --project=unit --testTimeout=120000 tests/component-contract-*.test.ts tests/knowledge-contracts.test.ts tests/provenance.test.ts tests/storybook-contract-coverage.test.ts
  ```
  Expected: PASS with zero unresolved facts, including the independent review oracle.
- [ ] **Step 4:** commit `feat(contracts): govern the chart family`.

### Task 7: Storybook gallery and browser evidence

**Files:**
- Create: `src/components/ui/chart.stories.tsx`
  - stories: `Area`, `AreaStacked`, `Bar`, `BarStacked`, `BarHorizontal`, `Line`, `LineStep`, `Donut`, `Radial`, `Empty`, `Rtl`, `Gallery`;
  - each has a `play` that waits for `[data-chart-state="ready"]` and checks the summary, the table and keyboard focus.
- Create: `docs/RELEASE-012-CHART-GALLERY.md`
  - light and dark screenshots of every type;
  - shadcn official examples (ui.shadcn.com/charts) beside each.

**Steps**

- [ ] **Step 1:** write the stories with `play` assertions. Run `npx vitest run --project=storybook src/components/ui/chart.stories.tsx`; the axe gate must pass.
- [ ] **Step 2:** capture light and dark screenshots of the `Gallery` story and of the matching shadcn examples. Compare them, and record any gaps and their fixes in the gallery doc.
- [ ] **Step 3:** commit `docs(chart): add the gallery and shadcn comparison`.

### Task 8: Release 012 identity, candidate and docs

**Files:** follow the Release 011 identity bump list (`scripts/run-release-generation.mjs`, `package-candidate.mjs`, `build-library.mjs`, `release-inputs.ts`, `src/validator/{release,canonical-release}.ts`, `historical-artifacts.mjs`, tests, CI), plus `docs/RELEASE-012.md`, `docs/CANVAS-RELEASE-012.md` and `README.md`.

**Steps**

- [ ] **Step 1:** bump to `0.0.0-release.12` and `shadcn-radix-release-012`. Freeze the Release 011 record (`fd3afb47…`) and manifest (`9190ce39…`).
- [ ] **Step 2:** run `release:generate` twice and check the bytes are identical. Then, from a clean scratch worktree, run `release:verify`, `candidate:generate` and `candidate:verify`. Commit the manifest.
- [ ] **Step 3:** run typecheck, the full unit suite, Storybook and both builds from the clean worktree. Record the results in `docs/RELEASE-012.md`.
- [ ] **Step 4:** write the Canvas handoff. It covers:
  - the `/charts` lazy import;
  - the closed props;
  - the `data-chart-state="ready"` wait;
  - the hashes.
- [ ] **Step 5:** open a draft PR and ask the owner to review the gallery and accept the candidate.
