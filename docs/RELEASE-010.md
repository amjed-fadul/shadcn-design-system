# Release 010: React 19 peer range

Release 010 lets Canvas run React 19, which `twenty-ui` requires. It changes dependencies and the
inherited-interface facts that follow from them. Component source, token contract, knowledge, visual
decisions and the Release 009 visual system are unchanged.

## Changes

- **Peer range:** `react` and `react-dom` widen from `18.3.1` to `^18.3.1 || ^19.0.0`.
- **Development dependencies:** `react` and `react-dom` 19.3.0, `@types/react` 19.3.0,
  `@types/react-dom` 19.2.3. Typecheck needed no source changes.
- **Inherited interfaces:** the 24 interfaces that pin `@types/react` directly now pin 19.3.0 and its
  declaration hash. `scripts/generate-inherited-interfaces.ts` regenerated 75 of the 129 interfaces;
  the other 54 do not resolve React DOM props.
  - Added: `popover`, `popoverTarget`, `popoverTargetAction`, `inert`, `enterKeyHint`, `part`,
    `exportparts`, `onToggle`, `onBeforeToggle`, `onScrollEnd`, and the `onTransition*` events,
    each with its capture variant.
  - Removed: `onResize` and `onResizeCapture`, which React 19's types no longer declare.
  - Type text only: `ReactNode` now includes `bigint` and promises. No prop names change.
- **Source provenance:** `provenance/component-contract-source.json` pins react and @types/react 19.3.0.
- **Identity:** package `0.0.0-release.10`, release `shadcn-radix-release-010`. The Release 009 record
  and distribution manifest are now frozen in `scripts/historical-artifacts.mjs`, like 001–008.
- **Linux builds:** the input guard in `scripts/release-inputs.ts` ignores OS files under `/proc`,
  `/sys`, `/dev`, `/usr`, `/etc`, `/lib`, `/lib64` and `/bin`. On Linux, Node reads `/proc/self/exe`
  and native tools read `/usr/bin/ldd`, so the guard rejected every Linux build. macOS reads none of
  these, so builds there behave as before.
- **Build input guard covers module loading:** `scripts/build-library.mjs` now starts observing reads
  before it loads the producer modules (`release-inputs.ts`, the validators and contract loaders). It
  started after them, so a file read while those modules loaded was never checked. Release 004's
  build script had the right order; a later release reversed it. The "real producer build rejects
  an omitted runtime input read by scripts/release-inputs.ts" test exposed this once it rebuilt the
  active release, and now passes.
- **Historical artifacts test:** expects 15 frozen files, including the Release 009 record and
  manifest.
- **Tests:** expectations that named Release 009 or React 18 now name 010 and React 19. The binding
  test is renamed `canonical-release-r10-binding`. Prop-count assertions rise by exactly 15 (17 added,
  2 removed). The "real producer build rejects an omitted runtime input" test now rebuilds the active
  release instead of Release 004, whose contracts pin React 18 declarations that are no longer installed.
- **CI:** `baseline.yml` and `release-qualification.yml` target the r10 binding test and the 010
  distribution manifest and tarball.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `304783025e032f99e3d75df904b6bb12498a0f8302034a9e2570107f2ea60ef9` |
| Release record file | `6450355882fe28d3b17ec94bcdf379fdf80dfa4c88538356bb15cc1e0bf8cdac` |
| Distribution manifest | `49d4e2e65027011c8b7b861cc6b60778be0c4fb5151e2188058d3ab520845beb` |
| Tarball `adc-shadcn-design-system-0.0.0-release.10.tgz` | `e271740669829ad96c925904ce4a0263be7a1716125acb826ee19b1856e91c52` |

Integrity: `sha512-NFslftYNiG6CCjSHfI/GB4rNeW9sLyTQkUm4IUTe0zoCy0iqgYsFiUUQMUMp+pKBrFNF3au/f0xFGQKcARV9Rw==`.
56 packed files.

These were built in a Linux cloud container with Node 22.18.0 / npm 10.9.3. Release generation
used `ADC_R3_ARTIFACT_DIRECTORY` pointing at Canvas's vendored Release 3 tarball, whose SHA-256 matches
the pinned `bf8fdd1b…c629`. `candidate:verify` rebuilt the package from source and matched these
bytes exactly. The tarball itself is not committed; Canvas vendors it.

## Verification

- `npm run typecheck`: passed.
- `release:verify` and `candidate:verify`: passed, with no expectations refreshed.
- Full unit suite: see the PR description for the final counts. The failures that remain need
  artifacts that exist only on the owner's laptop (`/Users/amjedfadul/.artifacts/…` Release 3 and
  Release 4 candidates). They fail identically on Release 009.

## Not yet done (owner)

- **macOS re-qualification:** the `release-qualification` workflow: Storybook interaction tests, the
  browser matrices and a byte-identical rebuild on macOS. It needs Chromium, which this container
  lacks. Run it before Canvas treats 010 as final.
- **Visual review on React 19:** React 19 changes no styling, but Radix and vaul behavior under React 19
  is only covered by the unit suite here.
