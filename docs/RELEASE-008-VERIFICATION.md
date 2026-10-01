# Release 008 verification

Worktree: `/Users/amjedfadul/.codex/worktrees/release008-primitives/shadcn design system`.
Branch: `codex/release008-primitives`; main baseline: `74f06c7199f723ccc9b1dd7c3ae82d797558221f`.
Pinned toolchain: Node `22.18.0`, npm `10.9.3`; no dependency additions.

## Capabilities and authorities

- Icon: 20 finite Lucide identities; size sm/default/lg (14/16/20px); optional color inherit/foreground/primary/muted-foreground/destructive; decorative by default, meaningful requires label; optional inline-start/end placement; logical directional identities mirror in RTL, physical directions remain fixed.
- Image: required src/alt/positive integer width and height; layout intrinsic/fill, fit contain/cover, loading eager/lazy; empty alt is decorative; definite parent dimensions required for fill; no Avatar fallback or arbitrary CSS.
- Toggle Group: selected primary/primary-foreground, persistent selected hover, full semantic ring with 2px background offset. Selected foreground/background contrast is 6.824:1 Light and 7.506:1 Dark; selected versus unselected hovered background is 6.256:1 and 5.732:1. Standalone Toggle and token values unchanged.
- Link: justified by duplicated inline-link treatment and existing guidance recommending a missing Link. Required href and accessible children, optional newTab (false); native paths, fragments, external, mailto and tel semantics. No disabled/router/external-indicator expansion.
- Source, public exports, native provenance, canonical family contracts, knowledge/references, independent inventories, tests and stories reconcile to 41 families, 210 exports, 204 JSX exports and six helpers/hooks. 82 tokens and 15 capabilities remain unchanged.

## Focused and browser gates

Each capability was implemented after focused red tests and received fresh independent review with Critical/Important findings fixed. The Icon semantic-color follow-up and consumer declaration fix received a separate fresh GPT-6.1 Sol review: Clean, 23 fresh tests passed, with a virtual consumer compiling without Lucide resolution. The lead's updated focused gate passed 86 tests across eight files. Its ten stories passed.

Relevant Storybook gates passed 38 stories: Icon 10, Image 9, Toggle Group 11, Link 8; configured accessibility checks stayed enabled. Independent Chromium 145.0.7632.6 browser scripts passed for all four capabilities, with zero console/page errors and loaded Geist fonts (HTTP 200). Browser checks exercise accessibility, dimensions/fit/loading, real computed Light/Dark paint, hover/focus/disabled selection, keyboard/hash navigation, wrapping and RTL. External/new-tab/mailto/tel destinations were inspected without activating external or OS handlers.

Icon explicit color contrast on supplied semantic backgrounds measured Light 19.793/6.824/4.732/4.765 and Dark 18.958/7.506/7.633/6.844 for foreground/primary/muted-foreground/destructive. Arbitrary surfaces still require author contrast judgment; inherit preserves interactive foregrounds. Color does not replace labels or text.

Browser evidence and screenshots: [RELEASE-008-BROWSER.md](RELEASE-008-BROWSER.md), external `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-browser/`.

## Integrated gates

- `npm run release:generate`: passed; generated only Release 008; historical guards passed.
- `npm run typecheck`: passed after generation, with no diagnostics.
- `npm run build-storybook`: passed (Vite's ordinary large-chunk advisory remains).
- Full unit/package/release suite ran once: 117 files, 1,548 tests; 1,547 passed and one stale active release-ID assertion failed. Duration: 1,433.42s. The failing fixture was still expecting Release 007 while loading the canonical Release 008, so it rejected identity before reaching its intended projection/hash check.
- Corrected only that test's expected ID 007→008, retaining the projection/hash tamper assertion and forged-ID rejection. Focused rerun passed (1 passed, 18 skipped). The independent reviewer approved this migration correction. All 1,548 checks are therefore green across the full run and focused correction; the complete suite was not repeated. No production semantics changed; tests are outside the bound implementation input graph, so candidate identity stayed unchanged.
- Release payload verification: passed against the independently retained generator digest.
- External candidate generation: passed, version `0.0.0-release.8`, 56 packed files.
- Candidate verification: passed against retained manifest digest; fresh tarball bytes/SHA-256/SHA-512 and all packed paths/sizes/file hashes match exactly. No expectations refreshed.
- Packed inspection: exact 210 runtime exports, three release getters, 41 families/82 tokens and new APIs; all 20 Icon names render; meaningful/decorative native markup and mailto/new-tab attributes pass. Release data equals the source artifact and is deeply frozen. Packed declarations have no repository alias or Lucide dependency. Strict NodeNext consumer compilation with skipLibCheck=false, five negative API assertions and Lucide resolution disabled passed with zero diagnostics/requests.
- Fresh independent integrated GPT-6.1 Sol review: **Clean — no Critical or Important findings remain.** The reviewer did not implement the work and checked all four APIs, accessibility/RTL/themes, source/contract/knowledge authorities, Storybook evidence, inventories, audit strictness, historical guards and packed candidate hashes/types. The reviewer also approved the stale-ID test migration and checked its focused green rerun.
- Review limits: browser evidence is Chromium; opaque Link children retain author-owned naming; Image positive-dimension/non-empty-string refinements are runtime-enforced, with guidance in knowledge. Canvas installation/publication remains deferred.

Candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-008-primitives/adc-shadcn-design-system-0.0.0-release.8.tgz`.
External manifest: `distribution-manifest.json` in that same directory.
Retained manifest SHA-256: `403d135748116a28864f0c68f7700e9323a10f0c7c4b3395506790ba25060922`.
Retained tarball SHA-256: `79f486520dbaebedd69d9bd9daecdb030aab85d72d94e235db25429a430b3122`.
Retained npm integrity: `sha512-3hcib9MKFCTwWR6EaOMmtmI2NnIuLzgRT+/pSfWA4J7+c6RbE6cxNj18H4GO0YSinOBfoy1ZnQRZLcDv4rrfmg==`.

Release payload SHA-256 retained from generator output: `f73c75626873acb9326298e43a119742d725822c47abe8440f76764c453a24ff`.
The executable record binds 363 implementation inputs, including Lucide declaration `node_modules/lucide-react/dist/lucide-react.d.ts` at SHA-256 `69ef61bf5cb44106d1553fac6d8b8b107d6304d509d0f3e4cb40137653f31374`.
Retained expectations and logs are external in `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-verification/`; expectations were captured from producer output before verification.

## Frozen history

All twelve committed Releases 001–007 and distribution records were compared byte-for-byte to the main baseline after generation and again after the full verification run. All 363 Release 008 input digests/Git blob identities also still match. Release 007 JSON file SHA-256 remains `366a2dd45490a28689effc10a8c58b68d090d8d0d86895c7e6269c9bbd2ae45c`; distribution manifest remains `3631a7f0cf0edf62951e71a5c7b52a2971c629fd5fa72ec5178179b99f8d1168`. The retained R7 dependency-rebind tarball remains `269c862f86183cfecb59f3d1e2708aa2cfc085352d116d842ed15f6f3a3d6c02`. Guards run before and after generation/candidate commands, and regression tests reject a mutated historical file.

## Deferred scope

Full icon-library management/custom SVG/CSS colors; responsive-image srcSet/sizes/editing/fallbacks; consumer routing/disabled links; additional tokens, publication, Canvas installation/acceptance and deployment. No commits, pushes, merges or publication were performed.

## Reproduction and retained evidence

```sh
npm test -- --testTimeout=60000
npm test -- tests/executable-release-validator.test.ts -t 'fails closed when the immutable release projection is changed' --testTimeout=60000
npm run typecheck
npm run build-storybook
npm run release:verify -- --release-sha256 f73c75626873acb9326298e43a119742d725822c47abe8440f76764c453a24ff
npm run candidate:verify -- --manifest /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-008-primitives/distribution-manifest.json --tarball /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-008-primitives/adc-shadcn-design-system-0.0.0-release.8.tgz --manifest-sha256 403d135748116a28864f0c68f7700e9323a10f0c7c4b3395506790ba25060922
```

External logs/records: `full-unit.log`, `targeted-rerun.log`, `typecheck.log`, `storybook-build.log`, `release-verify.log`, `candidate-generate.log`, `candidate-verify.log`, `candidate-inspection.json`, `candidate-frozen-data.json`, `final-preservation.json` and `retained-digests.json` in `/Users/amjedfadul/.artifacts/shadcn-design-system/release008-verification/`.
