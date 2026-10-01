# Release 008 — Link

Link is a repo-native inline navigation primitive exported through `src/package/index.ts`. Its family, source knowledge, canonical source reference and provenance are registered alongside the independent inventory oracles. The active scope is 41 families, 210 public exports, 204 authorable JSX exports and six nonauthorable helpers/hooks.

## API and decisions

```tsx
<Link href="/docs">Documentation</Link>
<Link href="#details">Read details</Link>
<Link href="https://example.com/docs" newTab>
  Documentation (opens in a new tab)
</Link>
<Link href="mailto:team@example.com">Email the team</Link>
<Link href="tel:+9715550100">Call the team</Link>
```

The closed API has required `href: string`, required `children: React.ReactNode`, and optional `newTab: boolean = false`. It renders a native anchor. The browser owns focus, Enter activation and destination handling; internal, external, hash, mailto and tel destinations share this path. No origin or scheme is inferred. Explicit `newTab=true` writes `target="_blank"` and `rel="noopener"`. The author can disclose the new tab in the link content.

The runtime requires a nonempty string destination. `React.Children.toArray` rejects plainly empty child content, including null, booleans, empty arrays and whitespace-only text. Numbers and opaque child elements remain allowed. Authors must give opaque elements meaningful accessible content; the component does not evaluate arbitrary child components. These checks are runtime refinements beyond the structural string and ReactNode contract. Authored JSX children satisfy the required children prop through the existing validator.

Link inherits surrounding font, text size, inline wrapping and reading direction. It uses permanent underline with offset four and semantic primary text. Keyboard focus has a full semantic ring with a two-pixel background offset. The existing Task 3 ring-offset audit vocabulary supports this source without a parser exception or token-policy change.

The API exposes no `className`, `style`, `role`, `ref`, `asChild`, disabled state, native attribute bag, routing adapter or event interception. TypeScript checks the governed identifier-shaped props. JSX itself permits unknown hyphenated attributes; runtime forwarding and the authored contract independently reject their effect/authorization. Native provenance is independently bounded to Icon, Image and Link, retaining existing upstream and historical assertions. The family has no inherited authoring interface and its host is the intrinsic `a` element.

## Verification

The missing capability was observed red before source implementation: the initial runtime, contract and TypeScript API run reported 26 failures caused by absent Link export/registration. The implementation then passed the following focused gate:

```sh
npm test -- tests/link-runtime.test.tsx tests/link-contract.test.ts tests/link-api.test.ts tests/component-contract-inventory.test.ts tests/component-contract-source-provenance.test.ts tests/knowledge-contracts.test.ts tests/storybook-contract-coverage.test.ts tests/provenance.test.ts tests/executable-contract-20-families.test.ts --testTimeout=60000
```

All 102 tests across nine files passed. Runtime coverage includes native destination preservation, explicit new-tab protection, ignored escape hatches, inherited prose treatment and empty destination/content guards. TypeScript fixtures prove required props and reject styling, native target/rel, event, ref and polymorphic escape hatches. Authoring tests exercise required structural JSX children and the closed prop set. A final runtime/public-entrypoint rerun passed 24 selected checks (nine unrelated package checks skipped), including all 23 Link runtime checks and the exact 210-export public entrypoint.

```sh
npm test -- tests/component-contract-independent-review.test.ts -t '41-family|has no unreferenced evidence' --testTimeout=60000
npm run test-storybook -- src/components/ui/link.stories.tsx --maxWorkers=1 --testTimeout=60000
```

The independent complete 41-family source audit, physical inventory oracle and evidence closure passed all three selected checks, with 86 unrelated checks skipped. All eight Link stories passed with the configured axe gate enabled. Independent Chromium evidence confirms native hash navigation by Enter, explicit new-tab attributes, inline multiline wrapping, inherited typography, RTL and semantic Light/Dark treatment. External, mailto and tel destinations were inspected without activation. Measured text contrast was 6.8239:1 Light and 7.5055:1 Dark; zero console or page errors occurred. Browser details and screenshots are in `docs/RELEASE-008-BROWSER.md`.

`git diff --check` passed, and the historical-artifact guard confirmed all 12 frozen release/distribution artifacts unchanged. Repository typecheck reports only the two pending Release 008 JSON imports and the already reserved Image RenderingFact test-narrowing issue; no Link source/API/story errors remain. Final generation, full-suite and package checks belong to the integrated Release 008 gate.

No commit, push, publication, release generation or historical artifact mutation was performed. Fresh independent review is coordinated by the lead after this focused capability gate.
