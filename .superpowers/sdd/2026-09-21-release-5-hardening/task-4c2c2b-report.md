# Task 4C2C2B report: CSS-variable and numeric token-expression analysis

## Outcome

Task 4C2C2B adds generic, source-backed CSS token arithmetic analysis without changing component-family facts, token authority, component source, or release artifacts. The production analyzer now recognizes the exact supported `calc(var(--spacing) * multiplier)` shape in JSX style expressions and Tailwind arbitrary-value utilities, including zero, positive, negative, fractional, and statically resolvable template/interpolation operands.

Every resolved expression retains its exact `spacing.multiplier` derivation, any already-proven utility condition, and authored source path/span/kind/text. Unsupported or ambiguous expressions produce explicit unresolved evidence and no arithmetic fact. The canonical ToggleGroup expression remains unresolved because `${spacing}` is a runtime prop; no default multiplier is fabricated.

## Canonical inventory and root cause

The canonical component sources contain one approved `--spacing` CSS arithmetic expression:

- `src/components/ui/toggle-group.tsx`: ``gap: `calc(var(--spacing) * ${spacing})` ``. Its operand is runtime component state derived from a public prop, so the only factual result is unresolved dynamic evidence.

Sidebar contains three class expressions combining `calc(...)` with unapproved component variables (`--sidebar-width` or `--sidebar-width-icon`). They are intentionally unresolved rather than treated as spacing-token facts. Other canonical `calc(...)` forms are percentage/pixel arithmetic without a CSS variable and are outside this token-source grammar.

The production root cause was that token analysis traversed `className`/CVA strings and numeric Tailwind utilities only. It did not inspect JSX style expressions or treat CSS-variable arithmetic as a source expression. The independent audit had the same capability gap through a separate utility-regex implementation. Consequently, a contracted `spacing.unit` could appear to have no direct expression, while the real dynamic ToggleGroup source was not surfaced as unresolved evidence.

## Implementation

- Added a caller-owned CSS-variable resolver to the generic token analyzer. Canonical authority approves only `--spacing` and derives `spacing.unit` through `spacing.multiplier`.
- Added strict arithmetic parsing for the equivalent shape `calc(var(--spacing) * numeric)` and exact support for `0`, positive, negative, and fractional operands.
- Added static template/interpolation evaluation for literal numeric/string primitives, unary numeric signs, safe wrappers, and lexically visible initializers. Public-prop and otherwise dynamic operands remain unresolved.
- Added JSX `style={{ ... }}` traversal and Tailwind arbitrary-value traversal. Tailwind data/ARIA conditions are preserved and combined with existing recipe conditions.
- Added explicit unresolved reasons for unsupported operators, multiple variables, unknown variables, nonnumeric operands, dynamic operands, ambiguous interpolation, division by zero, and non-equivalent shapes.
- Added independently implemented arithmetic parsing, traversal, source comparison, and mutation coverage to the independent audit. It does not call production arithmetic parsing or resolution.

## RED / GREEN evidence

The initial focused production suite failed **11/11 tests** for absent arithmetic collection, derivation, provenance, condition preservation, invalid-shape rejection, and canonical dynamic evidence. No failure was caused by fixture collection or a type error.

After implementation and the added multiplier-mutation test, the final focused command covering production arithmetic, conditional utilities, imported CVA compatibility, and independent arithmetic passed **39/39 selected tests** with **55 unrelated tests skipped**.

The broader analyzer/schema/invariant compatibility command passed **129/129 tests** across six files.

Adversarial coverage includes multiplier drift, operator drift, variable drift, provenance-position drift, multiple variables, unknown variables, nonnumeric and dynamic operands, ambiguous interpolation, division by zero, reversed/non-equivalent shapes, and zero partial facts/dependencies for each rejected expression.

## Independent audit and exact residuals

The full independent review produced **64 passed / 2 expected residual failures**:

- Direct source findings: **267**, exactly the prior **263** plus four newly visible arithmetic findings.
- New arithmetic findings: the runtime ToggleGroup `--spacing` interpolation and three Sidebar expressions using unapproved component variables.
- Unreferenced evidence remains exactly `collapsible.json:tokens`.

The token dependency suite produced **1 passed / 3 expected failures**. Exact closure is:

- `missing: 145`
- `invented: 126`
- `unresolved: 4`
- `suspiciousContractedNamespace: 7`

The four unresolved arithmetic records are the same ToggleGroup plus three Sidebar expressions above. ToggleGroup's unconditional contracted `spacing.unit` remains invented because the runtime operand cannot factually establish a specific multiplier. These are deferred contract-data/4C3 reconciliation residuals; this task does not edit family JSON.

## Required gates

- Focused arithmetic/compatibility selection: **39 passed / 55 skipped**.
- Analyzer/schema/invariant compatibility: **129/129 passed**.
- Independent review: **64 passed / 2 expected residual failures**, **267** direct findings, and the unchanged evidence orphan.
- Token dependency suite: **1 passed / 3 expected failures**, with the exact closure above.
- `npm run components:verify`: **13 files passed / 11 failed; 483 tests passed / 17 failed**, plus the historical Vitest worker `onTaskUpdate` timeout. The failures are the recorded family token/render/runtime/evidence residuals and explicit unresolved arithmetic evidence.
- Canonical index/mutation/query/runtime diagnostic: **4 files failed; 4 tests passed / 3 failed**. Runtime residuals are the CommandDialog classification, Badge render alternatives, and Vaul unresolved evidence; the other three suites stop at canonical contract reconciliation.
- `npm run typecheck`: **exit 0**.
- Required one full `npm test`, run once after focused GREEN: **33 files passed / 20 failed; 654 tests passed / 21 failed**, duration **335.07s**. Failures are the recorded canonical/family token/render/runtime/evidence residuals plus the historical knowledge-baseline `spawnSync git ENOBUFS`. The new arithmetic suite passed **12/12** within this run.
- `git diff --check`: **exit 0** before commit.

## Authority and release preservation

- Base commit: `0bc43622becce6040eb1501a799133e9d8e560b2`.
- Release-001 base blob: `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- Release-001 implementation blob: `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- The diff under `contracts/components`, `contracts/tokens`, and `provenance/releases` is empty.

## Changed files

- `src/contracts/components/token-source-analysis.ts`
- `src/contracts/components/canonical-token-source-analysis.ts`
- `tests/component-contract-token-arithmetic.test.ts`
- `tests/fixtures/token-arithmetic-fixture.tsx`
- `tests/component-contract-independent-review.test.ts`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c2b-report.md`

## Self-review

- The implementation is generic and configuration-driven. It contains no component/family exception, source-path allowlist, multiplier allowlist, finding filter, contract-derived truth, manual token fact, or weakened equality.
- Arithmetic is published only after the complete variable/operator/operand/shape check succeeds. Invalid expressions retain exact unresolved provenance and publish zero partial arithmetic facts.
- Utility conditions are parsed by the existing grammar and carried onto arithmetic facts without being recreated or flattened.
- Canonical authorization is limited to the approved `--spacing` variable and existing token/derivation authority.
- Production and independent implementations remain structurally separate and are mutation-tested against multiplier, operator, variable, and provenance drift.
- Dynamic ToggleGroup arithmetic is unresolved rather than converted to its default prop value; static source analysis does not pretend that a runtime selector is constant.
- No Task 4C3 cleanup was started.

## Fix Round 1 — immutable scope, finite numbers, and exact independent comparison

### Confirmed findings and fixes

1. Static interpolation could follow a `let`/`var` initializer and ignore a later assignment. Production bindings now carry declaration identity, immutability, and write state. Only an initialized, lexically visible, unwritten `const` may resolve. A scope-aware write prepass rejects assignment, compound assignment, and update expressions, including writes after the style expression; shadowed bindings do not invalidate each other.
2. Decimal overflow could reach the resolver as `Infinity` and serialize incorrectly. Exact decimal operands must now be finite before authority resolution. Scientific notation, `NaN`, and signed `Infinity` are rejected with `CSS token arithmetic operand is not a finite decimal.` The explicit negative-zero policy is canonicalization to positive `0`.
3. The independent initializer oracle searched the whole source file by name. It now maintains its own lexical scope stack, including source/block declarations and parameter/catch shadowing, and follows only the nearest visible `const` initializer.
4. Independent comparison checked only source facts missing from the contract. It now performs stable-key comparison in both directions and reports missing and invented facts. Tests cover extra and wrong multipliers, condition drift, facts invented from unsupported operators, and provenance-sensitive evidence comparison.

### Strict TDD evidence

The focused RED selection produced **10 failed / 1 passed / 78 skipped**. It demonstrated all four defects: reassignment/update/stale bindings leaked multiplier `2`, decimal overflow produced `Infinity`, the special numeric forms lacked the finite-decimal policy, negative zero remained `-0`, the independent oracle resolved an out-of-scope same-name binding, and one-way comparison accepted an invented contract fact. The existing nearest-shadow production case passed as a regression guard.

After implementation, the focused GREEN selection passed **18/18**. A fresh post-fixture/typecheck correction selection passed **16/16** with **79 skipped**. Production arithmetic plus utility/imported-CVA compatibility passed **37/37**. The bounded analyzer/schema/invariant/unresolved-reconciliation compatibility selection passed **138/138** across six files.

The independent review produced **72 passed / 2 expected residual failures**, **268** direct findings, and the unchanged `collapsible.json:tokens` evidence orphan. The additional direct finding is the now-explicit invented unconditional `spacing.unit` contract fact for the dynamic ToggleGroup expression; no multiplier is fabricated from runtime source.

The token dependency suite produced **1 passed / 3 expected residual failures**. Canonical production facts are unchanged, so exact closure remains `missing: 145`, `invented: 126`, `unresolved: 4`, and `suspiciousContractedNamespace: 7`. `npm run typecheck` exited **0**. Per the fix-round instruction, `components:verify` and the full suite were not rerun.

### Preservation and self-review

- Release-001 remained byte-identical at blob `75b59166086e9de0c67656fe64712a8cc70aa6e3` before and after the fix.
- The diff under `contracts/components`, `contracts/tokens`, and `provenance/releases` is empty.
- Fix-round changes are limited to the production analyzer, arithmetic fixtures/tests, the independent audit/tests, and this report.
- Production and independent implementations remain separate. Neither consumes contract facts as source truth, weakens equality, filters findings, or introduces component/family exceptions, allowlists, or manual token facts.
- Every rejected operand/operator/scope case emits unresolved evidence with exact source provenance and zero partial arithmetic facts. Conditions and derived rules remain part of exact bidirectional equality.

## Fix Round 2 — complete write targets and temporal lexical scope

### Confirmed findings and fixes

1. The production write prepass marked only bare identifier assignment/update targets. It now recursively follows assignment-target structure through parentheses and assertion/non-null/satisfies wrappers, object shorthand/property/spread targets, array elements/spreads, and default-value assignment targets. It marks only identifier leaves and therefore does not mistake property keys, computed keys, right-hand values, or property-access receivers for binding writes. Expression-form `for-of` and `for-in` initializers are explicitly treated as writes in the loop's nearest scope.
2. The independent arithmetic oracle previously prebound every block declaration to its initializer before visiting any statement. It now reserves later lexical names as unavailable, visits declaration initializers in execution order, and activates each declaration only afterward. Dedicated classic-for, for-of, for-in, and switch/case scopes prevent an outer constant from leaking through a nearer loop or case binding. Switch declarations are reserved across the case block while each case is audited in statement order; ambiguous cross-case execution remains unavailable and fails closed.

### Strict TDD and verification evidence

The focused RED selection produced **9 failed / 95 skipped**: four production cases incorrectly emitted the original constant through object destructuring, array destructuring, for-of expression assignment, and for-in expression assignment; five independent cases resolved a later block declaration, leaked an outer constant through three loop forms, or leaked it through switch scope. These fixtures deliberately use `const` bindings, with type-checked expected-error annotations where the invalid write is analyzer input, so they exercise the write scanner rather than mutable-binding rejection.

The Node 22 targeted GREEN selection passed **9/9** with **95 skipped**. The complete production arithmetic suite passed **25/25**. The bounded arithmetic/utility/imported/schema/invariant/unresolved-reconciliation command passed **142/142** across six files. The full independent review produced **77 passed / 2 expected residual failures**; the five added tests account for the increase, and the known direct-audit/evidence residual categories remain. `npm run typecheck` exited **0** under Node 22. Per the fix-round instruction, `components:verify` and the full suite were not run.

### Preservation and self-review

- Release-001 remained byte-identical at blob `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- The diff under `contracts/components`, `contracts/tokens`, and `provenance/releases` is empty.
- Fix-round changes are limited to the production analyzer, focused arithmetic fixtures/tests, independent audit/tests, and this report.
- Production assignment traversal is structural and generic: no component/family exceptions, target-name allowlists, source filters, contract-derived truth, or manual facts were added.
- The independent scope implementation remains separate from production and fails closed whenever initialization order or control-flow reachability cannot establish a static operand.
