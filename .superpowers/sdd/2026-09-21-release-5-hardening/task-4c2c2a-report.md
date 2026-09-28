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

## Fix Round 1 — scoped condition semantics and trustworthy independent audit

### Confirmed causes and corrections

1. Utility conditions retained only `propName` and `equals`, so self, group, peer, ancestor (`in`), and descendant (`has`) predicates collapsed into the same subject. A utility condition atom now explicitly retains `subject: data|aria`, `scope: self|group|peer|in`, `relation: attribute|has`, and an optional group/peer `name`. Recipe conditions remain component-prop atoms. Merge identity includes all subject metadata plus `propName`, allowing a group and self condition on the same property to coexist while still rejecting a contradiction on the same scoped subject.
2. The grammar now supports Tailwind 4.3.3-positive group/peer/in/has data and aria forms, including nested `group-has-*`, and decodes escaped static values such as `some\\_value` to `some_value`. Named `in-*`, negative `not-*`, malformed trailing escapes, interpolation, arbitrary selectors, unsupported prefixes, unescaped arbitrary-value whitespace semantics, and contradictory same-subject predicates fail closed.
3. `placeholder` was absent from the operational-prefix authority. It is now supported without inventing a condition. A canonical `Input` corpus assertion proves `placeholder:text-muted-foreground` retains the underlying `color.muted-foreground` dependency.
4. `TokenCondition.all` now uses `AtLeastTwo<TokenConditionAtom>`. The schema requires at least two complete atoms and recognizes either legacy recipe atoms or fully scoped utility atoms. Runtime invariants independently reject undersized, duplicate, and contradictory conjunctions using full scoped identity. Duplicate dependency and production source comparison keys recursively sort object keys while deliberately retaining conjunction array order.
5. The independent implementation separately gained scoped grammar, trailing-escape tracking, escaped-value decoding, full-subject merge identity, `placeholder`, and exact whole-utility token resolution. It no longer discovers tokens by substring inside utilities such as `content-['bg-primary']`.

### Strict RED / GREEN evidence

The initial focused run produced **12 expected failures / 3 passes / 139 skipped**. The failures covered production scoped conditions, same-property/different-subject conjunctions, positive group/peer/in/has forms, escaped values, negative/named-in/trailing-escape rejection, placeholder, stable comparison, schema support, invariant cardinality/uniqueness/contradiction, independent scoped grammar, and exact independent utility identity.

Tailwind-backed cases use the installed `tailwindcss` **4.3.3** design-system parser/compiler. They prove the supported candidates compile, named `in-data-[...]/name` does not compile, negative `not-data-*` is valid Tailwind syntax but deliberately fails closed because negation is not representable, and `placeholder:` compiles as an operational variant.

Final focused compatibility command covered the production parser, schema, invariants, imported-CVA analysis, and unresolved reconciliation: **5 files passed; 114/114 tests passed**. The narrower finding selection is **15/15 passed**. `npm run typecheck` exits **0**.

### Corrected residuals and bounded gates

- Full independent review: **52 passed / 2 expected residual failures**. The sound direct-audit count is **263 findings**, plus the unchanged `collapsible.json:tokens` evidence orphan. The prior 257 figure is superseded: scoped identities, malformed-escape rejection, exact whole-utility matching, and the newly recognized operational prefix are now part of the oracle.
- Token dependency diagnostic: **1 passed / 3 expected failures**. Exact closure is `missing: 145`, `invented: 126`, `unresolved: 0`, `suspiciousContractedNamespace: 7`, for **271** missing/invented facts.
- Component verification: **25 suites passed / 19 failed; 456 tests passed / 17 failed** out of 473. Failures remain the exposed family-contract reconciliation/runtime residuals; no family cleanup was performed.
- `git diff --check`: **exit 0**.
- Release-001 base/current blobs remain `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- The scoped diff for `contracts/components/families`, `contracts/tokens`, and `provenance/releases` is empty.

### Fix-round self-review

- Production and independent scanners, value decoders, merge logic, and token resolution remain separate.
- Conjunction order is semantic and remains order-sensitive; object property insertion order is not semantic and is normalized only for equality keys.
- No family/path exception, finding suppression, allowlist keyed to a component, contract-derived truth, manual token fact, weakened equality, 4C2C2B expression support, family cleanup, or 4C3 work was introduced.

## Fix Round 2 — ordered compound relation paths

### Root cause and representation

The Fix Round 1 utility atom reduced a variant to one `scope` plus one `relation`. That shape could express `group-has-data-*`, but not Tailwind-valid compositions whose order changes selector meaning, including `has-group-data-*/name`, `has-peer-data-*/name`, `group-in-data-*/name`, and `has-in-data-*`. Its regular expression also terminated arbitrary attribute content at the first `]`, including an escaped closing bracket.

Utility atoms now carry an ordered `path`. A direct attribute uses `[{ kind: "self" }]`; compound variants preserve each relation in source order, for example `has-group-data-*/root` becomes `[{ kind: "has" }, { kind: "group", name: "root" }]`. Only `group` and `peer` path segments can carry a static name. The parser attaches the one trailing Tailwind modifier to the first nameable segment, matching Tailwind's nested compound parse, and rejects a name when no group/peer segment exists. The type and schema exclude names from self/has/in segments; the invariant layer also rejects malformed, multiply named, or incorrectly positioned names after schema bypass.

Production and independent implementations each use their own escape-aware arbitrary-content scanner. They distinguish structural brackets from escaped `\\[` and `\\]`, split the attribute/value boundary only at an unescaped `=`, preserve the decoded literal bracket, and continue to fail closed for unescaped nesting, malformed escapes, interpolation, unsupported relations, and invalid names.

### Strict RED / GREEN evidence

The new focused selection began at **4/4 failures / 154 skipped**, one failure each in production parsing, independent parsing, schema validation, and runtime invariants. Tailwind **4.3.3** compiled every positive candidate. The production and independent failures retained only the previously representable group-has case and omitted the other compound/escape cases; the schema rejected the new path, while invariants accepted illegal self/in names.

The Tailwind-backed tests cover both `has -> group` and `group -> has` orderings, `has -> peer`, `group -> in`, `has -> in`, and exact decoded opening/closing brackets. The new behavior is **4/4 green**. The full bounded compatibility command covering production conditions, schema, invariants, imported CVA, and unresolved reconciliation is **5 files passed; 117/117 tests passed**.

### Independent audit and final gates

- Full independent review: **53 passed / 2 expected residual failures**. The direct audit remains exactly **263 findings** and the separate evidence orphan remains `collapsible.json:tokens`; compound-path support did not create or suppress corpus debt.
- `npm run typecheck`: **exit 0**.
- `git diff --check`: **exit 0** before commit.
- Release-001 base/current blobs remain `75b59166086e9de0c67656fe64712a8cc70aa6e3` / `75b59166086e9de0c67656fe64712a8cc70aa6e3`.
- The scoped diff for `contracts/components/families`, `contracts/tokens`, and `provenance/releases` is empty.
- Per controller instruction, no components or full-suite run was performed in this round.

### Round-2 self-review

- Ordered path identity participates in the existing stable condition key, so relation-order drift, names, duplicates, and contradictions remain exact.
- Production and independent scanners remain separate; neither derives expected facts from family contracts.
- No family JSON, token contract, release artifact, expression parsing, manual fact list, component exception, finding filter, or 4C3 work was added.
