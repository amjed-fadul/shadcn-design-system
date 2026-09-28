# Batch 1 component-contract closure report

## Outcome

Batch 1 is closed across the canonical 38-family contract scope. Family artifacts now reconcile structural/render/local-prop facts, exact token dependencies, and unresolved evidence with both the production analyzers and the independently implemented review oracle. The bounded closure has zero missing, invented, unresolved, suspicious-namespace, or unreferenced-evidence findings. Release 001 remains byte-identical.

## Starting residuals

The inherited checkpoint already had canonical host mapping at 19/19 and unresolved reconciliation at 8/8. The remaining bounded failures were:

- independent review: 4 failures and 60 direct findings;
- token dependencies: 2 failures;
- four arithmetic unresolved records: three Sidebar expressions over component geometry variables and one runtime ToggleGroup `--spacing` expression;
- residual structural/render/local facts, token facts, one collapsible token-evidence orphan, and stale unresolved records.

## Closure changes

- Reconciled the existing family JSON work with canonical source facts, including alias-host branches, slot/nullish rendering, direct public-prop forwarding, local props, runtime data attributes, ToggleGroup orientation, exact token conditions, and stale unresolved/evidence removal.
- Kept canonical primitive-host mapping in prior commit `69cb3b1` intact.
- Classified unrelated component geometry CSS variables as known non-token implementation details through caller-owned configuration rather than component or path exceptions.
- Added strict support for the exact dynamic `calc(var(--spacing) * ${...})` template shape. Because the operand is runtime state, this records a factual bare `spacing.unit` dependency without inventing a multiplier; static numeric operands continue to require exact `spacing.multiplier` evidence.
- Preserved conditions on supported arithmetic and rejected multiple variables, unknown variables, malformed templates, and unsupported shapes without partial facts.
- Added generic safe structural-selector handling for token utilities while continuing to reject ambiguous data predicates.
- Corrected coverage classification for border styles, text wrapping, and explicit radius resets.
- Updated the independent oracle separately: it has its own dynamic arithmetic, structural-selector, render, prop-forwarding, and token logic and does not call production helpers. Its direct spacing scan now accepts only approved numeric Tailwind spacing utilities, so arbitrary values such as `max-h-[300px]` do not fabricate token evidence.
- Updated mutation tests to insert an invented exact ToggleGroup spacing fact instead of mutating a multiplier that is no longer factually present.
- Updated the focused Button contract assertion to verify both alias render branches and condition-aware token authority.
- Removed all temporary inspection scripts, including `tmp-inspect.ts`.

## Focused verification

Using Node 22:

- `tests/component-contract-token-arithmetic.test.ts` and `tests/component-contract-token-utility-conditions.test.ts`: 37/37 passed.
- `tests/component-contract-button.test.ts`: 3/3 passed.
- `tests/component-contract-canonical-host-mapping.test.ts`, `tests/component-contract-independent-review.test.ts`, `tests/component-contract-token-dependencies.test.ts`, and `tests/component-contract-unresolved-reconciliation.test.ts`: 110/110 passed.
- `npm run typecheck`: passed.
- Family JSON parse check: passed.
- `git diff --check`: passed.

Per the task boundary, the full suite and `components:verify` were not run.

## Release preservation

`provenance/releases/shadcn-radix-release-001.json` SHA-256 before and after closure:

`1f9274c16ba625cf02096a6b8bb6da570762a16296da8624daa7475db3a89370`

## Scope review

The closure introduces no family/path exception, contract-derived source truth, finding filter, or weakened equality. Production and independent implementations remain separate, invalid arithmetic publishes no partial fact, and the only dynamic approved-variable result is the source-supported bare spacing token.

## Canonical-loader closure follow-up

The canonical loader exposed residual facts that the prior focused gates did not instantiate. Root-cause classification and repair were:

- Generic render analysis now treats direct public scalar children as authored content rather than automatic structure, limits conditional JSX-host analysis to bindings actually used as JSX tags, and normalizes `!!children` plus `children &&` to the same truthiness fact. This removed false unresolved evidence for CommandDialog, PaginationPrevious, PaginationNext, and Progress, and reconciled FieldSeparator without adding unresolved placeholders.
- Source-backed contract corrections record FieldLabel's immediate cross-family `label.Label` host, ToggleGroup's automatic context-provider child, and ToggleGroupItem's exact `resolvedVariant`/`resolvedSize` derived-state targets.
- Canonical source authority now covers the promoted AlertDialog, Avatar, Collapsible, Command, Drawer, Popover, RadioGroup, and ToggleGroup composition facts and ToggleGroup's declaration-backed single/multiple conditional API. Focused acceptance and mutation tests prevent artifacts from self-authorizing those facts.
- Existing mutation cases were updated to mutate Button's branch-based render trees and to exercise source reclassification on an unconsumed component, preserving the intended production boundary after the render model became conditional.

Node 22.18.0 targeted evidence:

- Canonical index: 11/11 passed.
- Canonical query: 8/8 passed.
- Mutation: 69/69 assertions passed.
- Independent review: 81/81 passed.
- Canonical source authority acceptance/mutation: 2/2 passed.
- Render model: 29/29 passed.
- Combined targeted assertion count: 200/200 passed.
- Loader scope: 6/6 passed; unresolved source reconciliation: 8/8 passed; component invariants: 77/77 passed.
- `npm run typecheck`: passed.
- Changed family JSON parse check: passed.
- `git diff --check`: passed.

After the combined targeted assertions completed, Vitest emitted the known infrastructure-level unhandled error `[vitest-worker]: Timeout calling "onTaskUpdate"`. The assertion summaries above were all green; this worker-reporting timeout made that Vitest process exit nonzero and is recorded explicitly rather than represented as a clean command exit.

Release 001 remains byte-identical with SHA-256:

`1f9274c16ba625cf02096a6b8bb6da570762a16296da8624daa7475db3a89370`
