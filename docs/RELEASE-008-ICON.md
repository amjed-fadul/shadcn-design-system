# Release 008 — Icon

Icon is a repo-native primitive using the existing pinned `lucide-react@1.33.0` dependency. It is exported through `src/package/index.ts`. The source contract, knowledge, canonical reference, source provenance, inventories and Storybook manifest now include the 39th family. Release 007 artifacts were not edited or regenerated during this capability.

## API and decisions

```tsx
<Icon name="search" />
<Icon name="info" color="primary" decorative={false} label="Information" />
<Icon name="info" decorative={false} label="Information" />
<Button size="icon" aria-label="Search"><Icon name="search" /></Button>
<Button>Continue<Icon name="arrow-end" placement="inline-end" /></Button>
```

- `name` is required and bounded to 20 identities: `alert-circle`, `arrow-end`, `arrow-left`, `arrow-right`, `arrow-start`, `check`, `check-circle`, `chevron-down`, `chevron-end`, `chevron-left`, `chevron-right`, `chevron-start`, `chevron-up`, `circle`, `info`, `loader`, `more-horizontal`, `panel-left`, `search`, and `x`. These are established producer Lucide imports plus logical navigation pairs. The registry is private and finite; it is not a library-wide icon management API.
- `size?: "sm" | "default" | "lg"` uses `size-3.5`, `size-4`, and `size-5`, deriving 14/16/20px from the existing spacing unit. The default is 16px.
- `decorative?: true` is the default, rendering `aria-hidden=true` with no role or label. `decorative: false` requires `label: string` in the TypeScript union, renders `role=img`, and rejects missing, empty or whitespace-only labels at runtime.
- `placement?: "inline-start" | "inline-end"` writes the existing Button `data-icon` marker. It supports Button spacing and hides leading icons during Button loading. Sibling order remains author-owned.
- Logical `arrow-start`, `arrow-end`, `chevron-start`, and `chevron-end` rotate 180 degrees in RTL. Physical directions and `panel-left` keep their direction.
- `color?: "inherit" | "foreground" | "primary" | "muted-foreground" | "destructive"` defaults to `inherit`. Explicit options apply the corresponding existing semantic text token in both themes; arbitrary strings, CSS variables and hex values are rejected at runtime, in the public TypeScript API and in authored contracts. SVG stroke remains `currentColor`. Use inheritance within colored Buttons; explicit colors must contrast with their surrounding surface. Retain visible text or a meaningful label rather than relying on color alone. There is no public `className`, `style`, SVG attribute spread, children, custom component, or SVG injection path. Icon owns accessibility attributes and sets `focusable=false`. The Button owns its action name and interactions. Use Spinner for animation; the `loader` identity is static.

The public declaration uses a private literal identity union and a readonly, exhaustively typed registry. It does not leak the bundled Lucide dependency into consumer declarations. A declaration-emission regression was observed failing before this packaging fix and passes after it.

The contract has no inherited authoring interface. Its rendered host is an SVG; this does not expose the SVG attribute API. Native provenance has `implementationKind: "repo-native"` and no fabricated upstream path/hash. The knowledge reference describes the working tree source and pins its Git blob hash.

## Strict source audit extensions

The existing source model assumed public props reach a host through a spread. It now recognizes explicit public attribute writes for closed destructured signatures without a rest props bag. Existing forwarding signatures retain their spread-based proof.

The generic render analyzer resolves only module-private, readonly finite registries with statically named imported members. It permits one registry lookup and requires a single constant selected host binding whose references are JSX tags or type queries. It rejects opaque members, spreads, computed keys, mutable or shadowed aliases, exported/local/shadowed registries, component-object escapes, direct/cast/array/object-rest destructuring writes, and loop assignment targets. Every registry member must match the contracted host. Independent AST/declaration tests use a separate implementation and adversarial source mutations.

Named Lucide SVG hosts are derived from the pinned declaration's actual `ForwardRefExoticComponent` type references and export aliases. Factories that return SVG components and the generic Lucide renderer are rejected. The declaration path and SHA-256 are pinned in component-contract provenance and become release-generation inputs through existing path discovery.

The prop analyzer derives conditional label availability/requiredness from the binary boolean union. Canonical reconciliation compares this derived authority exactly, and the independent checker separately detects weakened label requirements. No Icon exemption or test relaxation was added.

## Verification

Tests were written and observed red before Icon implementation, contract registration and audit extensions. Runtime tests cover accessibility defaults, meaningful labels, sizes, unknown identities, styling injection, RTL policy and Button composition. TypeScript fixtures prove the accepted API and rejected escape hatches. Canonical authoring tests ensure Canvas validation requires meaningful labels and rejects arbitrary props/identities/sizes.

- Icon runtime: 12 passed.
- Public TypeScript API compilation: passed, including negative assertions.
- Icon canonical contract/authoring: 9 passed.
- Focused finite-registry regressions, including independent reviewer findings: 18 passed.
- Boolean-union and pinned Lucide authority regressions: passed.
- Focused canonical loader, inventory, source provenance, knowledge and source model checks: passed.
- Independent finite-registry, conditional API and complete 39-family audit: all 87 checks passed across the focused run and targeted rerun below.
- Storybook Icon: all 7 stories passed, with accessibility, size, loading and RTL play assertions. Storybook's configured axe gate remained enabled.
- Independent real-browser checks passed: 14/16/20px sizes, accessible names, Button loading, RTL logical/physical transforms, loaded fonts, and zero console/page errors. See `docs/RELEASE-008-BROWSER.md`; screenshots are recorded there. Lead CUA inspection confirmed RTL and dark-theme behavior.
- Repository typecheck was run. It reports only the two expected missing `shadcn-radix-release-008.json` imports while the release candidate has not yet been generated. No Icon/source/API type errors remain. Final release generation and package-wide typecheck belong to the integrated Release 008 gate.

The final focused command was:

```sh
npm test -- tests/icon-runtime.test.tsx tests/icon-api.test.ts tests/icon-contract.test.ts tests/component-contract-finite-registry.test.ts tests/component-contract-boolean-union.test.ts tests/component-contract-lucide-authority.test.ts tests/component-contract-inventory.test.ts tests/component-contract-source-provenance.test.ts tests/knowledge-contracts.test.ts tests/storybook-contract-coverage.test.ts tests/component-contract-independent-review.test.ts
```

It passed 163 of 166 tests across 11 files. The remaining three were a regression assertion that assumed a rejected render always returned a branch, and two existing expensive independent checks that exceeded Vitest's default 5000ms timeout. The assertion now verifies that no returned tree matches the contract, including the valid rejection case of no branch. After that correction, only those three checks were rerun with the 60000ms timeout already used by the repository's strict component audit:

```sh
npm test -- tests/component-contract-independent-review.test.ts -t 'independent finite registry proof|VariantAnyPropsFixture|mutated child edge' --testTimeout=60000
```

The targeted rerun passed 3 tests with 84 skipped. All 166 focused checks therefore passed across these runs; semantic assertions were retained. `npm run typecheck` reported only the two pending Release 008 JSON imports described above. `npm run test-storybook -- src/components/ui/icon.stories.tsx --maxWorkers=1` passed all 7 stories.

No commit, push, merge or publishing action was performed. Independent review findings about mutable aliases, object-rest writes and block-shadowed aliases were fixed with red-to-green regressions in both source analysis and the independent oracle; fresh re-review is coordinated by the lead.

## Follow-up: governed color

The user requested Icon color before Release 008 generation. The optional semantic color variant above was added with 10 failing runtime cases observed before implementation, plus positive/negative TypeScript assertions, canonical enum/default/token dependency checks, and Colors/ColorsDark/ColorsRtl stories. Earlier counts above record the initial capability checkpoint; final combined verification is recorded in RELEASE-008-VERIFICATION.md. No token values or dependency versions changed.
