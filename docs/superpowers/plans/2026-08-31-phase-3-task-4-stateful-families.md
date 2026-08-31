# Phase 3 Task 4: Stateful Family Contracts

**Goal:** Add factual candidate contracts for Checkbox, Tabs, Accordion, Tooltip, and Scroll Area, without modifying their canonical UI implementation or beginning Task 5.

**Architecture:** Each public wrapper component inherits a pinned, checker-derived Radix interface. Interfaces contain the full authoritative prop/event facts and (where applicable) conditional branches. Family contracts add only wrapper-owned facts: local variants/defaults, rendering tree, automatic wrapper children, portal evidence, composition capabilities, and token dependencies. Accordion Root must reference the existing `radix.accordion.root` interface and never copy its conditional API facts.

**Scope guard:** Add only `checkbox`, `tabs`, `accordion`, `tooltip`, and `scroll-area` family files and their actually-referenced Radix interface artifacts. Do not change `src/components/ui/`, `contracts/tokens/`, `provenance/`, `snapshots/`, or any Task 5 family.

## Task 1: Extend the factual test harness for the five families

**Files:**
- Modify: `tests/component-contract-stateful-families.test.ts`
- Modify: `tests/helpers/typescript-interface-analysis.ts`
- Modify: `contracts/components/component-contract-set.json`

1. Write focused assertions for exact source exports, source blob identities, checker-derived Radix facts, token audit results, rendering trees, and production invariant/resolver state-channel results.
2. Run the focused test and confirm RED because the five contracts/interfaces do not exist.
3. Extend only the checker helper capabilities needed to derive the checked-in interface artifacts (including non-union interfaces), retaining checker-derived values as the authority.
4. Register exactly the five family files and the corresponding interface files.
5. Re-run the focused test to keep the expected contract-absence failure until contracts are added.

## Task 2: Checkbox, Tabs, and their inherited interfaces

**Files:**
- Add: `contracts/components/interfaces/radix.checkbox.root.json`
- Add: `contracts/components/interfaces/radix.checkbox.indicator.json`
- Add: `contracts/components/interfaces/radix.tabs.root.json`
- Add: `contracts/components/interfaces/radix.tabs.list.json`
- Add: `contracts/components/interfaces/radix.tabs.trigger.json`
- Add: `contracts/components/interfaces/radix.tabs.content.json`
- Add: `contracts/components/families/checkbox.json`
- Add: `contracts/components/families/tabs.json`
- Modify: `tests/component-contract-stateful-families.test.ts`

1. Write a focused test that expects Checkbox checked/defaultChecked and onCheckedChange to derive the `true | false | "indeterminate"` type from the pinned Radix declaration, including a state channel bound to those authoritative facts.
2. Run it RED; add the two full-hash interface artifacts and Checkbox family contract; run GREEN.
3. Write a focused test for Tabs' exact four public exports, Root value/defaultValue/onValueChange state channel, source-derived `orientation="horizontal"` default, and source-proven `TabsList.variant` literals/default.
4. Run it RED; add the four full-hash interface artifacts and Tabs family contract; run GREEN.
5. Include automatic Checkbox Indicator/icon rendering and no nonexistent internal/exported component claims.

## Task 3: Accordion using the existing conditional inherited authority

**Files:**
- Add: `contracts/components/interfaces/radix.accordion.item.json`
- Add: `contracts/components/interfaces/radix.accordion.trigger.json`
- Add: `contracts/components/interfaces/radix.accordion.content.json`
- Add: `contracts/components/families/accordion.json`
- Modify: `tests/component-contract-stateful-families.test.ts`

1. Write a focused test asserting Accordion Root inherits only `radix.accordion.root` for its conditional API, with no copied `value`, `defaultValue`, `onValueChange`, or `collapsible` facts in the family component.
2. Assert production `resolveConditionalApiShape` yields the authoritative single/multiple values, event payloads, and unavailable multiple-branch collapsible fact.
3. Run RED; add the remaining pinned full-hash interfaces and Accordion family contract; run GREEN.
4. Record only wrapper-owned render facts: Trigger's automatic Header and chevron icon, and Content's automatic inner div. Use capabilities solely for source-evidenced composition relationships.

## Task 4: Tooltip and Scroll Area interfaces/contracts

**Files:**
- Add: `contracts/components/interfaces/radix.tooltip.provider.json`
- Add: `contracts/components/interfaces/radix.tooltip.root.json`
- Add: `contracts/components/interfaces/radix.tooltip.trigger.json`
- Add: `contracts/components/interfaces/radix.tooltip.content.json`
- Add: `contracts/components/interfaces/radix.scroll-area.root.json`
- Add: `contracts/components/interfaces/radix.scroll-area.scrollbar.json`
- Add: `contracts/components/families/tooltip.json`
- Add: `contracts/components/families/scroll-area.json`
- Modify: `tests/component-contract-stateful-families.test.ts`

1. Write tests for Tooltip's exact public exports, source-derived Provider delay default, Content sideOffset default, and source-proven Portal/Arrow render tree.
2. Run RED; add pinned checker-derived interfaces and Tooltip family contract; run GREEN.
3. Write tests for Scroll Area's exact exports and automatic Root → Viewport → content plus ScrollBar → Thumb and Corner tree. Include ScrollBar orientation default only where canonical source sets it.
4. Run RED; add the pinned interfaces and Scroll Area family contract; run GREEN.

## Verification and scope audit

1. Run focused stateful-family tests, component-contract suite, token verification, snapshot verification, typecheck, build, dependency audits, and canonical `npm test` once under Node 22.18.0/npm 10.9.3.
2. Run `git diff --check` and inspect the changed file list; verify it contains exactly the five Task 4 families, required interfaces, checker/test support, registry, and this plan only.
3. Confirm no Task 5 family file, no prohibited paths, no implementation modifications, no commit, push, or merge.
