# Release 012 spike: modelling a Recharts-backed chart in the strict contract audits

**Date:** 2026-10-03. **Question:** can the repository's canonical analyzers prove a closed `Chart` that
renders Recharts, without extending them?

**Method:** run the canonical analyzers directly on candidate `src/components/ui/chart.tsx` shapes, using
`runnerImport`:
- `listModuleExports`;
- `analyzeJsxRenderTree`;
- `analyzeRenderFlowSource`;
- the canonical prop analyzer;
- the canonical token analyzer and coverage audit.

## Findings

| Shape | Result |
| --- | --- |
| Public props destructured, Recharts plot rendered conditionally (`width > 0 ? <ChartPlot …/> : null`) in the public tree | Unresolved `Conditional JSX child has unsupported predicate: width > 0`. Both the root and the private plot receive public props, which breaks the one-public-props-node invariant. |
| Rest-spread props passed to a model builder | No node receives public props, because the analyzer only treats closed destructuring as public bindings. |
| Text child from a derived value (`{model.title}`) | Unresolved `Unsupported JSX child expression`. |
| `data-chart-state={state}` from component state on the public root | Unresolved `Dynamic data attribute data-chart-state: state`. |
| **Closed destructuring. `figure` carries `data-chart-type={type}` and `aria-label={title}`. Private `ChartFrame` (measurement, draw state, Recharts) and `ChartDescription` (summary and table) receive only a derived model.** | **Zero unresolved facts. Exactly one public-props node (`figure`); the private components are component nodes that receive no public props.** |

`analyzeRenderFlowSource` reports "no analyzable render root" for hook-using components. It reports the
same for the existing `SidebarProvider`, whose contract records its providers as `unresolved` hosts with no
unresolved findings, so this is not blocking.

## Ruling

**Option A:**
- **Public tree:** the public render contract is the `figure` root and two module-private hosts
  (`ChartFrame`, `ChartDescription`), recorded as `unresolved` host nodes, as Sidebar's providers are.
- **Private trees:** everything Recharts renders, the draw state and the visually hidden text live
  behind those private hosts. The public tree never receives Recharts props.
- **Draw signal:** `data-chart-state` on `[data-slot=chart-plot]` is recorded as a contract
  accessibility fact, backed by runtime-test evidence, because `stateChannels` only model controlled
  props.
- **Validation:** runtime validation (`createChartModel`) carries the conditional combinations:
  `valueKey` for donut and radial, `currency` with currency format, and `layout` only on area and
  bar. The analyzers only derive conditional APIs from binary boolean unions. *Implementation
  update:* `composition.hardConstraints` may only name capability ids, so it can't carry these
  rules. They are runtime facts (a `ChartPropsError` names the broken rule), stated in the
  knowledge entry and the Canvas handoff.
- **Analyzers:** no extension is needed. That keeps the strict audit surface unchanged.

**Cost if wrong:** low.
- The contract will not enumerate Recharts' inner DOM, which Canvas never authors.
- If Canvas later needs facts about inner parts (for example legend items), a later release can extend
  the analyzers with pinned Recharts hosts (Option B), as Release 008 did for Lucide.

## `react-is` ruling

Recharts 3.8.1 needs `react-is`, and `react-is` 19 recognises React 19 elements but misreads React 18
fragments.
- **What ships:** `react-is@19.3.0` is bundled, matching the repository's React 19.3.0 development
  pin. Canvas runs React 19 (Release 010).
- **React 18 safety:** the chart never passes fragments as Recharts children; series map directly to
  elements. Recharts' fragment flattening is therefore never exercised, so React 18 consumers stay
  correct.
- **No new peer:** `react-is` is not a consumer peer dependency.
