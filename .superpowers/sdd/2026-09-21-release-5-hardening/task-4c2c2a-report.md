# Task 4C2C2A report — conditional and stacked utility prefixes

## Scope and result

- Base: `56b55ddc68c564a8f63c206f0d97e630ca0073f9`.
- Node: `v22.18.0`.
- Implemented only the controller-narrowed 4C2C2A slice: exact positive `data-*` and `aria-*` utility conditions, conjunctions across stacked prefixes and recipe conditions, exact comparison, and fail-closed handling of malformed, dynamic, unsupported, ambiguous, and contradictory prefixes.
- CSS `calc(...)`/`var(...)`, template/interpolation, and zero/fractional/negative spacing-expression support remain deferred to 4C2C2B. No component-family JSON, token contract, component source, release artifact, or 4C3 contract cleanup changed.

## Root cause

Production token analysis and the independent audit both normalized a Tailwind utility with `split(":").at(-1)`. This discarded every variant prefix before token resolution. A fact such as `data-[state=checked]:bg-primary` therefore became an unconditional `color.primary` dependency, and stacked prefixes could not retain their conjunction. The same normalization also accepted malformed or dynamic prefixes by looking only at the final utility.

## Implementation

Production now scans variant separators while tracking balanced square brackets, parentheses, and escapes. It recognizes static positive self/group/peer/in/has data variants and static aria variants, preserves their exact property and scalar value, and retains a single atom as `{ propName, equals }` or multiple atoms as canonical `{ all: [...] }`. Recipe and utility conditions are merged without losing either predicate; duplicate atoms are deduplicated and conflicting values fail closed.

Supported operational prefixes such as responsive, theme, interaction, named group/peer state, and container prefixes do not invent token conditions. Malformed brackets, interpolation, unknown data-like prefixes, arbitrary selector variants, named self-data qualifiers, unsupported prefixes, and contradictory conjunctions publish no token fact. Canonical coverage uses the same strict utility boundary instead of independently stripping prefixes.

The token condition schema/type now permits either one atom or a conjunction of at least two atoms. The independent review has a separate scanner, scalar parser, prefix authority, condition merger, stable-key comparison, and family-wide exact conditional-fact audit; it does not import the production parser.

## Strict RED / GREEN evidence

All npm commands used `PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH`.

Production focused RED began at **5/5 failures**: data/aria conditions were absent, recipe-plus-utility conjunctions were flattened, condition/value drift was invisible, malformed prefixes leaked four facts, and contradictory prefixes were accepted. The conjunction schema test separately failed before the schema change. Additional targeted REDs proved that aria variants were initially unconditional and named self-data qualifiers were initially accepted.

Independent focused RED began at **2/2 failures**: conditions were stripped and invalid prefixes leaked facts. A family-wide mutation then failed because the independent direct audit compared local token IDs but not exact local conditional facts.

Final focused command:

`npm test -- tests/component-contract-token-utility-conditions.test.ts tests/component-contract-imported-token-source-analysis.test.ts tests/component-contract-schema.test.ts tests/component-contract-independent-review.test.ts -t 'conditional Tailwind|imported CVA|stacked conditional token utility|independent utility parser|independent family audit compares local utility conditions exactly'`

Result: **4 files passed; 15 tests passed / 64 skipped**. Imported-CVA compatibility remains **6/6 passed**. The tests cover exact condition names and string/numeric/boolean values, stacked group/self conjunctions, recipe-plus-utility conjunctions, operational prefix stacking, exact condition/value drift, duplicate atoms, contradictions, malformed brackets, interpolation, unsupported/unknown data-like prefixes, ambiguous arbitrary selectors, named self qualifiers, and independent family-level missing/invented mutations.

## Independent audit and token residuals

- Full independent review: **50 passed / 2 expected residual failures**. The direct audit now reports **257 findings**; the separate evidence residual remains `collapsible.json:tokens`. The increase from the prior 57 direct findings is expected strictness: conditional utility facts are no longer flattened or compared only by token ID. No finding was filtered or converted to contract truth.
- Token dependency suite: **1 passed / 3 expected failures**. Exact closure is `missing: 142`, `invented: 126`, `unresolved: 0`, `suspiciousContractedNamespace: 7`, for **268** exact missing/invented facts. The adversarial mutation test remains green. The authority failure for a bare `spacing.unit` remains contract cleanup outside this slice.

## Bounded final gates

- `npm run components:verify`: **25 files passed / 19 failed; 447 tests passed / 19 failed**. Failures are the newly exposed exact token-condition contract residuals plus previously recorded canonical/runtime/Sidebar/independent residuals; family JSON cleanup is intentionally deferred.
- Canonical query/runtime diagnostic: **4 files failed**. Three suites stop at canonical reconciliation; runtime evidence is **4 passed / 3 failed** on the previously recorded CommandDialog classification, Badge render alternative, and Vaul unresolved evidence facts.
- `npm run typecheck`: **exit 0**.
- `git diff --check`: **exit 0** before commit.
- Release-001 base/current blobs: `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- The scoped diff for `contracts/components/families`, `contracts/tokens`, and `provenance/releases` is empty.
- Per the controller's narrowed instruction, no full `npm test` was run; bounded component, canonical, independent, token, typecheck, release, and diff gates were used.

## Changed files

- `contracts/components/component-family.schema.json`
- `src/contracts/components/types.ts`
- `src/contracts/components/token-source-analysis.ts`
- `src/contracts/components/canonical-token-source-analysis.ts`
- `tests/component-contract-token-utility-conditions.test.ts`
- `tests/fixtures/token-utility-condition-fixture.tsx`
- `tests/component-contract-independent-review.test.ts`
- `tests/component-contract-schema.test.ts`
- `tests/component-contract-stateful-families.test.ts`
- `.superpowers/sdd/2026-09-21-release-5-hardening/task-4c2c2a-report.md`

## Self-review

- Production and independent implementations are separate and mutation-tested.
- Parsing is generic and syntax/semantics based; there is no family/path exception, finding filter, contract-derived truth, manual fact list, or weakened equality.
- Exact comparison includes condition property, scalar value, conjunction membership/order, token ID, and derivation provenance. Unsupported or ambiguous prefix semantics fail closed rather than being flattened.
- The change deliberately exposes stale unconditional family facts but does not edit them. CSS spacing expressions, templates, variables, and 4C3 cleanup remain untouched.
