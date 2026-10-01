# Release 008 — Toggle Group selected contrast

ToggleGroupItem now uses existing semantic `primary` and `primary-foreground` colors while selected. The selected colors persist during hover and keyboard focus. A full-color focus ring with a two-pixel background offset separates focus from selection. The change is scoped to ToggleGroupItem; standalone Toggle retains its existing muted selected style.

## Source and interaction decisions

Two class strings follow the imported `toggleVariants(...)` recipe and precede caller `className` in `cn`:

```tsx
"data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground",
"focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
```

The existing `cn`/Tailwind merge implementation removes the shared recipe's selected `bg-muted` from the emitted classes. Explicit selected-hover rules prevent the shared hover background and foreground from replacing selected paint. Focus changes the outer ring rather than the selected background. The inherited three-pixel ring and focus stacking remain, including connected groups.

Single mode retains Radix radio/`aria-checked` semantics; multiple mode retains independent pressed buttons and `aria-pressed`. Disabled items retain native disabled behavior, `pointer-events-none` and opacity 0.5. Group context, variants, sizes, spacing, controlled values, vertical composition and RTL geometry are unchanged. No public API, family inventory, export inventory or token value was added.

The current selected muted/background contrast was approximately 1.091 in light mode and 1.309 in dark mode. Primary/background and primary-foreground/primary are approximately 6.824 and 7.506 respectively. Selected primary versus unselected muted hover is approximately 6.256 and 5.732. The old half-opacity ring measured approximately 2.441 and 2.622 against the background; the full ring with a background gap uses the stronger existing ring/background contrast.

Standalone Toggle remains at Git blob `de5328f19e85f2c6079531add1ff056eb59295b1`. The 82-token contract remains at blob `b24fd6e7ec267cc0ce9381b88566f3219e941b84`. ToggleGroup source is now `3c487ae79c5cd2e41aa22a5b07524160a45c19cd`, pinned consistently in its family contract, seed source provenance and new canonical knowledge reference. Upstream identities and Release 007 records are preserved.

## Strict audit authority

Token dependencies describe the source dependency graph. They retain the imported recipe's muted selected-state fact even though the later group override wins in emitted classes and computed styles. The group contract adds exact local selected `color.primary` and `color.primary-foreground` facts plus the focus-offset `color.background` dependency. Removing an imported dependency or omitting a local selected dependency still fails strict source reconciliation.

Canonical color utility recognition now includes the semantic `ring-offset` prefix. The established `ring-offset-2` width is classified specifically as a noncontracted ring-offset width; it is not a new spacing token. Unsupported offset colors and widths remain suspicious. Independent direct and exact token recognizers separately understand semantic offset colors. There are no parser exemptions, ignored findings or changes to source conflict resolution.

The knowledge claim describing these repo-derived selected/focus styles cites `canonical.toggle-group.source`, with the current source blob, rather than attributing the customization to upstream documentation.

## Verification

Eight new assertions were observed red before implementation: selected styling, focus separation, canonical selected dependencies, ring-offset vocabulary and the separate independent oracle. Four existing interaction/contrast checks already passed. After implementation, the same targeted selection passed all 12 checks.

The final focused command used the pinned Node 22.18.0/npm 10.9.3 runtime:

```sh
npm test -- tests/toggle-group-selected-runtime.test.tsx tests/toggle-group-selected-contract.test.ts tests/component-contract-ring-offset.test.ts tests/component-contract-imported-token-source-analysis.test.ts tests/component-contract-token-dependencies.test.ts tests/component-contract-independent-review.test.ts tests/component-contract-source-provenance.test.ts tests/component-contract-index.test.ts tests/knowledge-contracts.test.ts tests/storybook-contract-coverage.test.ts tests/release-005-toggle-group-provenance-runtime.test.tsx tests/release-005-toggle-group-context-mutations.test.ts --testTimeout=60000
```

Result: **12 files, 163 tests passed**, including the complete independent 89-test oracle, canonical index/source reconciliation, cross-family token closure, source provenance, knowledge, imported recipes and existing ToggleGroup context/runtime regressions. The existing Release 005-named tests were run without edits. `git diff --check` also passed.

```sh
npm run test-storybook -- src/components/ui/toggle-group.stories.tsx --maxWorkers=1
```

Result: **all 11 ToggleGroup stories passed**. Four new SingleLight, SingleDark, MultipleLight and MultipleDark stories show selected, unselected and disabled items. Their browser play checks verify actual selected background/foreground, selected hover persistence, distinct unselected hover, keyboard focus-visible with a two-pixel offset, stable selected focus paint, and disabled opacity. Existing Playground, Multiple, ConnectedOutline, Vertical, Disabled, Controlled and Rtl stories remain. Storybook's configured accessibility gate stays enabled.

The independent `tests/release008-toggle-group.browser.mjs` check also passed in Chromium 145.0.7632.6 with zero console/page errors and a successful Geist font response. It measured selected contrast at 6.8239:1 light / 7.5055:1 dark, selected versus unselected hover at 6.2563:1 / 5.7318:1, and the two-pixel semantic focus offset. It verified single/multiple interactions, native disabled state and 50% opacity, RTL ArrowLeft navigation and logical corner rounding, and unchanged muted selection on standalone Toggle. Evidence JSON and four screenshots are recorded in `docs/RELEASE-008-BROWSER.md` and stored outside the checkout under `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`.

`npm run typecheck` reports no ToggleGroup implementation or test errors. At this capability gate it reports three integration errors:

- `src/validator/canonical-release.ts:1`: pending `shadcn-radix-release-008.json` import.
- `tests/canonical-release-r8-binding.test.ts:4`: the same pending release artifact import.
- `tests/image-contract.test.ts:26`: `.rendering.nodes` needs narrowing because the render fact may contain alternatives.

The lead owns those integration fixes and final release/package typecheck. No full unit suite, release generation, commit, push, merge or publishing action was performed during this capability.
