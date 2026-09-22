# Task 4C2C1 report — imported local CVA recipe authority

## Scope and result

- Base: `68747d09d1e3d229a4db29959c600647e86a18bc`.
- Node: `v22.18.0`.
- Implemented only the controller-narrowed 4C2C1 slice: static named and aliased imports of local CVA recipes, exact canonical module/export authority, call selections and defaults, conditional variant facts, and provider-source provenance.
- Imported recipe authority is bound to the canonical component path and pinned Git blob from `provenance/seed-components.json`. A wrong module, wrong export, changed provider blob, dynamic/computed recipe/configuration, spread/computed invocation property, unknown variant, or ambiguous call-derived selector produces unresolved evidence rather than facts.
- The independent audit uses its own seed lookup, blob calculation, export discovery, recipe parsing, invocation selection, utility parsing, and exact fact comparison. It does not import or call the production analyzer.
- No component-family JSON, token contract, component source, release artifact, render/prop/interface/inventory authority, or deferred 4C2C2 token-expression parser changed. In particular, `data-[...]` conditional parsing and CSS-variable/zero-multiplier parsing remain deferred.

## Root cause

The production token analyzer only registered lexical same-file `cva(...)` declarations. A call such as `toggleVariants({ variant: resolvedVariant, size: resolvedSize })` therefore ended as an unsupported dynamic class expression. The analyzer also had no representation of recipe source identity, invocation arguments, or `defaultVariants`, so it could not preserve the provider span, distinguish selected literal/default branches, or retain exact conditions for safe dynamic selectors. The independent audit had the same same-file-only blind spot through separate text-based CVA discovery.

## RED / GREEN evidence

All npm commands used `PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH`.

Focused production RED:

- `npm test -- tests/component-contract-imported-token-source-analysis.test.ts`
- Initial result: **1 passed / 3 failed**. Aliased import resolution was absent, default/static selections produced no recipe facts, and canonical `ToggleGroupItem` retained the unresolved imported call.

Independent RED:

- `npm test -- tests/component-contract-independent-review.test.ts -t 'independently resolves the pinned aliased Toggle CVA recipe'`
- Initial result: **1 failed / 39 skipped** because the independent audit returned no imported class sources.

An additional fail-closed mutation used `const computedTone = computeTone()` as an invocation selector. It was initially RED because the alias was accepted; initializer provenance tracing now rejects it as `Unsupported dynamic recipe invocation.`

Final focused results:

- Imported-recipe production suite: **4/4 passed**.
- Selected production plus independent mutation cases: **6/6 passed, 39 skipped**.
- Compatibility run — imported recipes, stateful families, and unresolved reconciliation: **3 files passed, 68/68 tests passed**.
- The full test run also passed the imported-recipe suite **4/4**.

The focused suite covers a named import alias, exact provider source provenance, safe dynamic conditions, default-only invocation, literal invocation, wrong module, wrong export, dynamic configuration, computed recipe key, spread invocation, dynamic/computed import call, ambiguous call-derived data flow, and real `ToggleGroupItem` authority. Mutations change a condition, omit a default-selected fact, and change a spacing derivation; all are rejected.

## Independent audit and exact residuals

`npm test -- tests/component-contract-independent-review.test.ts` completed with **39 passed / 2 expected residual failures**:

- one unreferenced evidence record: `collapsible.json:tokens`;
- **55 source findings**.

The 55 source findings are:

1. `alert.AlertTitle`: `spacing.unit` lacks direct evidence.
2. `alert.AlertDescription`: `line-height.relaxed` lacks direct evidence.
3. `avatar.AvatarGroup`: `spacing.unit` lacks direct evidence.
4. `badge.Badge`: render predicates differ.
5. `breadcrumb.BreadcrumbLink`: missing `asChild` slot fact.
6. `breadcrumb.BreadcrumbSeparator`: render predicates differ.
7. `button.Button`: render predicates differ.
8. `drawer.DrawerContent`: `radius.lg` lacks direct evidence.
9. `drawer`: unresolved family evidence.
10. `empty.EmptyDescription`: `line-height.relaxed` lacks direct evidence.
11. `field.FieldContent`: `line-height.snug` lacks direct evidence.
12. `field.FieldLabel`: `line-height.snug` lacks direct evidence.
13. `field.FieldLabel`: source `radius.lg` is omitted.
14. `field.FieldTitle`: `line-height.snug` lacks direct evidence.
15. `field.FieldDescription`: `line-height.normal` lacks direct evidence.
16. `field.FieldDescription`: source `spacing.unit` is omitted.
17. `field.FieldSeparator`: source-local `children` is omitted.
18. `field.FieldError`: render predicates differ.
19. `field`: unresolved family evidence.
20. `pagination.PaginationItem`: public-props spread is absent.
21. `pagination.PaginationPrevious`: `spacing.unit` lacks direct evidence.
22. `pagination.PaginationNext`: `spacing.unit` lacks direct evidence.
23. `sidebar.SidebarTrigger`: source-local `variant` is omitted.
24. `sidebar.SidebarTrigger`: source-local `size` is omitted.
25. `sidebar.SidebarTrigger`: source-local `asChild` is omitted.
26. `sidebar.SidebarGroupLabel`: render predicates differ.
27. `sidebar.SidebarGroupAction`: render predicates differ.
28. `sidebar.SidebarMenuButton`: render predicates differ.
29. `sidebar.SidebarMenuAction`: render predicates differ.
30. `sidebar.SidebarMenuSubButton`: render predicates differ.
31. `slider`: unresolved family evidence.
32. `spinner`: unresolved family evidence.
33. `toggle-group.ToggleGroup`: source-local `orientation` is omitted.
34. `toggle-group.ToggleGroup`: `spacing.unit` lacks direct evidence.
35. `toggle-group.ToggleGroupItem`: imported base `font-size.sm` is omitted.
36. `toggle-group.ToggleGroupItem`: imported base `font-weight.medium` is omitted.
37. `toggle-group.ToggleGroupItem`: imported base spacing multiplier `1` is omitted.
38. `toggle-group.ToggleGroupItem`: imported base spacing multiplier `4` is omitted.
39. `toggle-group.ToggleGroupItem`: imported `color.muted` for `variant=outline` is omitted.
40. `toggle-group.ToggleGroupItem`: imported spacing multiplier `8` for `size=default` is omitted.
41. `toggle-group.ToggleGroupItem`: imported spacing multiplier `2.5` for `size=default` is omitted.
42. `toggle-group.ToggleGroupItem`: imported spacing multiplier `2` for `size=default` is omitted.
43. `toggle-group.ToggleGroupItem`: imported spacing multiplier `7` for `size=sm` is omitted.
44. `toggle-group.ToggleGroupItem`: imported `radius.md` for `size=sm` is omitted.
45. `toggle-group.ToggleGroupItem`: imported spacing multiplier `2.5` for `size=sm` is omitted.
46. `toggle-group.ToggleGroupItem`: imported spacing multiplier `1.5` for `size=sm` is omitted.
47. `toggle-group.ToggleGroupItem`: imported spacing multiplier `3.5` for `size=sm` is omitted.
48. `toggle-group.ToggleGroupItem`: imported spacing multiplier `9` for `size=lg` is omitted.
49. `toggle-group.ToggleGroupItem`: imported spacing multiplier `2.5` for `size=lg` is omitted.
50. `toggle-group.ToggleGroupItem`: imported spacing multiplier `2` for `size=lg` is omitted.
51. `toggle-group.ToggleGroupItem`: source `radius.md` is omitted by the coarser token-ID audit.
52. `toggle-group.ToggleGroupItem`: source `font-size.sm` is omitted by the coarser token-ID audit.
53. `toggle-group.ToggleGroupItem`: source `font-weight.medium` is omitted by the coarser token-ID audit.
54. `toggle-group.ToggleGroupItem`: data-attribute names differ.
55. `toggle-group`: unresolved family evidence.

The increase from 42 to 55 is expected strictness: imported Toggle recipe facts are now visible instead of hidden behind an unresolved call. No finding was filtered or converted into contract truth.

## Final diagnostics

- Token dependency suite: **1 passed / 3 expected failures**. Exact closure is `missing: 45`, `invented: 15`, `unresolved: 0`, `suspiciousContractedNamespace: 7`; per-export comparison reports **60** mismatches. The prior unresolved imported `ToggleGroupItem` call is gone. The spacing-authority failure remains part of deferred 4C2C2/4C3 work.
- `npm run components:verify`: **15 files passed / 7 failed; 438 tests passed / 9 failed**, plus one Vitest worker `onTaskUpdate` timeout. Failures remain in token, Sidebar, runtime evidence, independent audit, and canonical reconciliation gates.
- Canonical query/runtime diagnostic: **4 files failed; 4 tests passed / 3 failed**. Three suites are blocked during canonical reconciliation. Runtime residuals are CommandDialog classification, Badge render alternatives, and the Vaul unresolved evidence record.
- `npm run typecheck`: **exit 0**.
- Required one full `npm test`, run once after focused GREEN: **38 files passed / 13 failed; 612 tests passed / 10 failed**, duration **316.21s**. Eight suites fail during canonical collection; the remaining failures are the recorded independent-audit, runtime, Sidebar, and token residuals plus the historical knowledge-baseline `spawnSync git ENOBUFS`.
- `git diff --check`: **exit 0** before commit.
- Release-001 base blob: `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- Release-001 current blob: `75b59166086e9de0c67656fe64712a8cc70aa6e3`.

## Changed files

- `src/contracts/components/token-source-analysis.ts`
- `src/contracts/components/canonical-token-source-analysis.ts`
- `tests/component-contract-imported-token-source-analysis.test.ts`
- `tests/component-contract-independent-review.test.ts`
- `tests/fixtures/imported-cva-recipe.ts`
- `tests/fixtures/imported-cva-consumer.tsx`
- `tests/fixtures/imported-cva-wrong-consumer.tsx`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c1-report.md`

## Self-review

- Authority is generic and exact: the analyzer accepts only a static named import whose module resolves through the configured canonical pin and whose requested export resolves to exactly one static CVA declaration.
- Recipe literals retain their provider path, span, syntax kind, and source text. Consumer invocation selectors control whether branches are unconditional, conditional, or unresolved.
- Defaults and literal arguments select only the active branch. Safe prop/context selectors retain exact variant conditions. Computed keys, spreads, unsupported calls, unknown variants, and ambiguous aliases fail closed.
- The independent audit is structurally separate and mutation-tested. It reads the same external authority inputs but does not reuse production resolution, parsing, or comparison functions.
- No family/path exception, suppression, ignore list, contract-derived fact, weakened equality, manual fact cleanup, or 4C2C2 parsing was introduced.

## Fix Round 1 — fail-closed invocation, lexical authority, and exact independent comparison

### Confirmed root causes and corrections

1. Recipe base/default facts were appended before invocation validation completed. Unknown keys were detected only after facts were emitted, unknown literal values were not validated, and malformed/spread invocations could retain base facts. Production and independent paths now buffer every recipe result and publish facts only when the complete configuration, defaults, keys, values, selector provenance, and call shape validate. Invalid recipes retain unresolved evidence and publish zero recipe facts.
2. Imported bindings were copied into nested scopes without lexical invalidation. Parameters, local variables, and local function declarations can no longer resolve through a shadowed import. Selector validation now recursively proves roots and aliases from public props or an import-bound React `useContext` flow; computed element keys and arbitrary call properties fail closed.
3. The independent audit compared source imported facts only in one direction with insertion-order-sensitive `JSON.stringify`. It now recursively canonicalizes object keys, deduplicates facts, limits contract candidates to token IDs established by the imported source, and reports both missing source facts and invented contract facts.
4. The independent parser previously treated every nonliteral selector as safe and silently skipped wrong/stale modules. It now performs its own lexical/provenance validation, validates variant keys and values, independently checks canonical blob authority, recognizes direct unapproved local CVA exports and re-exports, and rolls back all buffered facts on any error.

The controller authorized semantic discovery from actual class-producing AST roots so unrelated render/state calls are not mistaken for token recipes. The implemented audit is conservatively broader: it scopes discovery to the exact component declaration, examines every named imported call in that declaration, and independently parses local exports to distinguish direct/re-exported CVA candidates from proven non-recipe helpers. Thus wrong/unapproved CVA calls still fail closed, while unrelated calls such as `React.isValidElement`, `useIsMobile`, and the focused helper fixture are not token inputs. No family/path/finding exception was added.

### RED / GREEN evidence

The initial focused command produced **4/4 expected failures**:

- invalid invocation keys leaked provider base/default facts;
- a parameter shadow still resolved the imported recipe;
- the independent parser accepted an unknown key and retained facts;
- the independent comparator rejected semantic key reordering and did not detect extra contract facts.

A separate discovery RED proved that an unrelated imported body call was misclassified as an unapproved recipe input while a wrong class-producing import also needed to remain unresolved.

Final focused results:

- Production imported-recipe suite: **6/6 passed**.
- Combined production/independent imported-recipe set: **10/10 passed, 39 skipped**.
- Independent authority/parser/exact-comparison/discovery set after the controller ruling: **4/4 passed, 40 skipped**.
- Production compatibility — imported recipes, stateful families, unresolved reconciliation: **3 files passed, 70/70 tests passed**.

Mutation coverage now includes unknown key, unknown literal value, spread, non-object call, parameter/local/function shadowing, computed element key, arbitrary call property, namespace/default/re-export, source-backed alias chains, wrong module, stale blob, unrelated body calls, semantic key reordering, exact omission, fabricated same-token condition, valid conditional spacing, condition drift, and derivation drift.

### Bounded gates and residuals

- Independent review: **42 passed / 2 expected residual failures**. Exact residuals are now **57 source findings plus `collapsible.json:tokens`**. The prior 55 findings remain, and exact bidirectional comparison adds two true invented facts for `toggle-group.ToggleGroupItem`: unconditional spacing multipliers `2` and `1.5`. No unrelated-call false finding remains.
- Token dependency suite: **1 passed / 3 expected failures**. Closure remains exactly `missing: 45`, `invented: 15`, `unresolved: 0`, `suspiciousContractedNamespace: 7`, with **60** per-export mismatches.
- `npm run typecheck`: **exit 0**.
- `git diff --check`: **exit 0** before the fix commit.
- Release-001 base/current blobs: `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`; scoped family/release diff is empty.
- `components:verify` and the full suite were not rerun because the controller requested bounded verification unless semantic diagnostics changed beyond this slice. The token counts are unchanged; the independent finding count changes only by the two intentionally exposed invented imported facts.

### Fix-round changed files

- `src/contracts/components/token-source-analysis.ts`
- `src/contracts/components/canonical-token-source-analysis.ts`
- `tests/component-contract-imported-token-source-analysis.test.ts`
- `tests/component-contract-independent-review.test.ts`
- `tests/fixtures/imported-cva-consumer.tsx`
- `tests/fixtures/imported-cva-wrong-consumer.tsx`
- `tests/fixtures/imported-cva-reexport.ts`
- `tests/fixtures/imported-cva-unrelated.ts`
- `tests/fixtures/not-the-pinned-recipe.ts`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c1-report.md`

No component-family JSON, token contract, source component, release artifact, render/prop/interface authority, 4C2C2 parser, suppression, weakened comparison, or manual fact cleanup changed.

## Fix Round 2 — exact local/imported identity, complete lexical scope, and class-root discovery

### Confirmed root causes and corrections

1. The independent exact comparator assigned every contract fact sharing an imported token ID to imported provenance. `ToggleGroupItem` therefore mislabeled its local `px-2` and `pe-1.5` facts as invented imported facts. The comparator now forms an exact, stable-keyed union of imported facts plus independently parsed local facts for the imported token IDs before comparing both directions. It no longer normalizes against a baseline count.
2. Production scope invalidation covered ordinary blocks and function parameters but not catch variables, traditional `for` initializers, `for-of`/`for-in` bindings, or the shared lexical environment of switch clauses. The production visitor now creates nested scopes and invalidates those bindings before analyzing class expressions. The independent audit separately resolves the nearest declaration across block, catch, loop, switch, and function scopes; a closer local selector binding now wins over an outer public prop.
3. Independent imported-recipe discovery scanned named calls throughout a component declaration. This missed default and namespace calls, treated unused recipe calls as token inputs, and reached wrapper recipes only accidentally. Per the controller ruling, discovery now begins at actual JSX `className` roots, recursively follows class composition and local function/arrow wrappers, and classifies imported calls only when they contribute to that class path. Default, namespace, wrong-authority, and unsupported imported producers on the path fail closed; an imported recipe call outside the path is excluded.

The class-root boundary is semantic and generic. It does not filter by family, file path, finding text, provider implementation, or contract contents. Local literal facts are independently parsed only to establish exact provenance in the imported-token comparison; no local fact is promoted into contract truth.

### Strict TDD evidence

All commands used Node `v22.18.0` through `PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH`.

The initial targeted RED run selected four tests and produced **4 failures**:

- production lexical authority failed first on `CatchShadowFixture`;
- independent nearest-binding authority failed first on the catch binding;
- class-root discovery silently accepted `DefaultImportFixture`;
- exact comparison reported the local spacing multipliers `2` and `1.5` as invented imported facts.

The tests cover catch, traditional `for`, `for-of`, `for-in`, direct switch-clause declarations, and public-prop shadowing; local arrow wrappers; default and namespace imported producers; an imported recipe call outside `className`; exact insertion, omission, condition drift, derivation drift, semantic object-key reordering, and valid local-plus-imported spacing.

Final focused results:

- production imported-recipe suite: **6/6 passed**;
- combined imported/authority/discovery/comparator selection: **12 passed / 40 skipped**;
- production compatibility (imported recipes, stateful families, unresolved reconciliation): **3 files passed, 70/70 tests passed**.

### Bounded gates and exact residuals

- Full independent review: **44 passed / 2 expected residual failures**. The comparator-only false findings are gone; the source audit is restored to exactly **55 findings**, plus the unchanged unreferenced `collapsible.json:tokens` evidence record.
- Token dependency suite: **1 passed / 3 expected failures**. Closure remains exactly `missing: 45`, `invented: 15`, `unresolved: 0`, `suspiciousContractedNamespace: 7`, with **60** per-export mismatches.
- `npm run typecheck`: **exit 0**.
- `git diff --check`: **exit 0** before commit.
- Release-001 base/current blobs: `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- Family-contract and release-artifact diff from `e3f32fe0ae2388c52d7585103c30ee569376ca38`: empty.
- `components:verify` and the full suite were not rerun: the controller requested bounded verification unless semantic counts changed, and the production token closure is unchanged while the independent count only removes the two confirmed comparator false positives.

### Fix-round changed files

- `src/contracts/components/token-source-analysis.ts`
- `tests/component-contract-imported-token-source-analysis.test.ts`
- `tests/component-contract-independent-review.test.ts`
- `tests/fixtures/imported-cva-consumer.tsx`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c1-report.md`

No component-family JSON, token contract, component implementation, canonical recipe authority, release artifact, 4C2C2 conditional/token-expression parser, exception, allowlist, weakened equality, or manual fact cleanup changed.

## Fix Round 3 — render-reachable nested class roots

### Confirmed root cause and correction

The independent imported-recipe audit delegated class-root discovery to the general `walkComponent` helper. That helper intentionally stops at every nested function-like node except its own mapped-render special case, so `className` attributes inside inline `.map(...)` callbacks and reachable local render functions never reached imported-recipe authority validation. Production traverses those nested bodies, leaving the independent oracle with a false-negative boundary.

The independent audit now has a dedicated return-root traversal. It begins at the component's returned expressions and follows only expressions that can contribute rendered JSX: JSX/fragment descendants, conditional and fallback branches, array elements, inline or locally bound `.map(...)` callbacks, JSX aliases, and explicitly invoked local function/arrow render results. It preserves the original AST nodes, so nearest lexical bindings continue to govern imported recipe and selector identity. Recursion guards reject cycles.

The traversal does not scan arbitrary nested declarations. It also respects expression semantics: for `left && right`, only `right` can become the rendered result, so a JSX-producing call used solely as the left-hand condition is not promoted into a class root. Unrelated or unreachable nested closures therefore remain outside token-recipe authority.

### Strict RED / GREEN evidence

All npm commands used Node `v22.18.0` through `PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH`.

Initial targeted RED:

- selected nested-root run: **2 failed / 1 passed / 46 skipped**;
- the valid mapped fixture returned zero imported class facts;
- the mapped wrong-authority fixture returned zero unresolved evidence;
- the non-render nested-closure exclusion already passed, proving the boundary rather than merely broadening traversal.

A second focused RED changed the exclusion fixture so an invalid JSX-producing closure is invoked only as the left condition of `&&`. The first implementation incorrectly followed that non-rendered result and emitted an authority error. Restricting `&&` traversal to its contributing right branch made the case GREEN without an exception or call-name filter.

Final focused coverage includes:

- exact imported default facts from inline `.map` callback JSX;
- exact imported default facts from an invoked local render function;
- wrong/re-exported, stale, default-import, and namespace-import producers inside nested render paths, each unresolved with zero leaked recipe facts;
- an imported binding shadowed by a `.map` callback parameter;
- a JSX-producing closure whose result is used only as a condition, excluded from class roots.

Final results:

- nested-root selection: **3/3 passed, 46 skipped**;
- combined production and independent imported-recipe selection: **15 passed, 40 skipped**;
- compatibility run (imported recipes, stateful families, unresolved reconciliation): **3 files passed, 70/70 tests passed**;
- full independent review: **47 passed / 2 expected residual failures**, with the unchanged **55 source findings** plus `collapsible.json:tokens`;
- `npm run typecheck`: **exit 0**;
- `git diff --check`: **exit 0** before commit;
- Release-001 base/current blobs: `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`;
- family-contract and release-artifact diff from `143edc316924ba604f571e60f19c47f6207ba48d`: empty.

Per the controller's bounded-gate instruction, `components:verify` and the full suite were not run. This round changes only the separate independent oracle and its fixtures; the production analyzer and token closure are unchanged.

### Fix-round changed files

- `tests/component-contract-independent-review.test.ts`
- `tests/fixtures/imported-cva-consumer.tsx`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c1-report.md`

No production analyzer, component-family JSON, token contract, component source, canonical authority input, release artifact, 4C2C2 parser, family/path exception, finding filter, contract-derived truth, or manual fact cleanup changed.
