# Phase 3 Task 4 Analyzer Completeness Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Task 4 token and JSX evidence analysis fail safely whenever relevant source evidence cannot be resolved.

**Architecture:** The token helper will return static class evidence and explicit unresolved class evidence from one lexical AST traversal. The JSX helper will use wrapper-parameter bindings to identify public-props spreads and will retain dynamic render evidence as unresolved instead of treating it as absent. The existing contract comparators will refuse reconciliation when either analysis reports unresolved evidence.

**Tech Stack:** TypeScript 5.5 AST, Vitest 3, Node 22.18.0, npm 10.9.3.

**Spec:** User-approved Phase 3 Task 4 analyzer-completeness repair brief (2026-08-31).

## Global Constraints

- Do not modify `src/components/ui/`, `contracts/tokens/`, `provenance/`, or `snapshots/`.
- Keep exactly the approved five Task 4 families within the 14/19 manifest.
- Do not begin Task 5 or introduce Phase 4 guidance.
- Do not commit, push, or merge.
- Use test-first RED/GREEN cycles against the production helper functions.

---

### Task 1: Token evidence completeness

**Files:**
- Modify: `tests/fixtures/component-analysis-fixture.tsx`
- Modify: `tests/component-contract-stateful-families.test.ts`
- Modify: `tests/helpers/component-token-analysis.ts`

**Produces:** A token-source result with `resolved` static class sources and `unresolved` source spans/reasons, plus a completeness comparator that blocks unresolved input.

- [ ] **Step 1: Write failing token tests**

Exercise production analysis with dynamic JSX values, a mixed `cn("bg-border", condition && classes)` expression, function/block-scoped CVA recipes, and generic arbitrary/keyword/current-color utility forms. Assert hand-written static dependencies and non-empty unresolved evidence for unsupported values.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- --run tests/component-contract-stateful-families.test.ts`

Expected: FAIL because current production analysis has no unresolved evidence and cannot resolve scoped CVA declarations.

- [ ] **Step 3: Implement token evidence traversal**

Walk class-bearing JSX/CN/CVA AST expressions, append static strings to `resolved`, and append an unresolved record for every other relevant expression. Resolve CVA calls from their lexical declaration node, not by global identifier lookup. Classify arbitrary values, CSS keywords, and `current` from their generic utility structure.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm test -- --run tests/component-contract-stateful-families.test.ts`

Expected: PASS with the new token assertions and the existing five-family facts.

### Task 2: Render evidence completeness

**Files:**
- Modify: `tests/fixtures/component-analysis-fixture.tsx`
- Modify: `tests/component-contract-stateful-families.test.ts`
- Modify: `tests/helpers/component-source-analysis.ts`

**Produces:** JSX render analysis that identifies parameter-derived spreads and emits unresolved records for unsupported spread, tag, dynamic attribute, and structural child evidence.

- [ ] **Step 1: Write failing render tests**

Exercise `{...rest}` from a destructured wrapper parameter, an unrelated spread object, a dynamic `data-x`, static automatic children, and a dynamic child expression. Assert resolved static tree evidence remains present while dynamic evidence is explicitly unresolved.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- --run tests/component-contract-stateful-families.test.ts`

Expected: FAIL because the existing extractor only recognizes an identifier named `props` and omits dynamic attribute/spread evidence.

- [ ] **Step 3: Implement binding-aware JSX evidence extraction**

Derive direct and rest parameter binding identifiers from the exported wrapper function. Mark only those spread identifiers as receiving public props; record unresolved provenance for other spreads. Record dynamic data attributes and unsupported child/tag evidence as unresolved, then make render comparison surface them.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm test -- --run tests/component-contract-stateful-families.test.ts`

Expected: PASS with zero unresolved evidence for all five canonical Task 4 sources.

### Task 3: Reconciliation and verification

**Files:**
- Modify: `tests/component-contract-stateful-families.test.ts`

**Produces:** Per-family zero-unresolved gates alongside existing source-derived token/render and mutation checks.

- [ ] **Step 1: Write failing per-family completeness assertions**

For checkbox, tabs, accordion, tooltip, and scroll-area, assert the production token and render analyses each have zero unresolved records before accepting no suspicious token namespaces or exact source reconciliation.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- --run tests/component-contract-stateful-families.test.ts`

Expected: FAIL until the new production results are wired into the completeness gates.

- [ ] **Step 3: Wire completeness gates into production comparisons**

Return readable errors from token/render comparators whenever unresolved evidence exists, without changing reconciled family facts unless source analysis proves a discrepancy.

- [ ] **Step 4: Run required verification**

Run the focused/component/token/snapshot suites, typecheck, build, audits, `git diff --check`, and default `npm test` under Node 22.18.0/npm 10.9.3. Report the documented default-suite timeout baseline without altering timeout or workers.
