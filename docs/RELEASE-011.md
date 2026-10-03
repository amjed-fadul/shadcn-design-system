# Release 011: Canvas visual-gap requests

Release 011 answers amjed-fadul/shadcn-design-system#19.

- **Tokens:** status colours, a coloured chart palette, `radius.full` and `line-height.display`,
  under token contract `shadcn-radix-token-contract-003`.
- **Components:** Badge, Alert, Icon and Avatar options. Every existing default renders as before.

The design and rulings are in
[the spec](superpowers/specs/2026-10-03-release-011-canvas-requests-design.md), and the Canvas handoff
is in [CANVAS-RELEASE-011](CANVAS-RELEASE-011.md). The chart component family is the separate
[Release 012 draft spec](superpowers/specs/2026-10-03-release-012-chart-family-proposal.md).

**Status: candidate.** The owner approved token contract `-003` on 2026-10-03 after reviewing light
and dark renders. The release itself awaits owner acceptance.

## Changes

- **Token contract `-003` (82 → 90 tokens):**
  - new: `color.success`, `color.warning`, `color.info` and their `-foreground` pairs,
    `radius.full` and `line-height.display`;
  - new values: `color.chart-1..5`.

  The values come from the pinned Tailwind 4.3.3 palette; `provenance/token-contract-source.json`
  `release011Layer` records which steps.
- **Contrast floors (new tests):**
  - `token-contract-status-contrast`: status text reaches 4.5:1 on background, card, muted and its
    own 10% and 15% tints, and each foreground reaches 4.5:1 on its fill.
  - `token-contract-chart-palette`: chart marks reach 3:1 against card and background, sit in the
    categorical lightness band, and stay apart under protanopia, deuteranopia and normal vision,
    including the 5 → 1 donut wrap.
- **Badge:** adds a `primary` fill and tinted `success`, `warning` and `info` variants; `default`
  stays neutral.
- **Alert:** adds `success`, `warning` and `info` variants mirroring `destructive`.
- **Icon:** adds 19 physical content identities (39 in total) and `success`, `warning` and `info`
  colours.
- **Avatar:** adds `shape?: "circle" | "rounded" | "square"` with `data-shape`. AvatarImage,
  AvatarFallback and the border follow the shape.
- **Contracts:**
  - family token facts come from the canonical analyzer;
  - the analyzer maps the six status utilities, `leading-display` and `rounded-full`;
  - once `--radius-full` exists, Tailwind 4.3.3 compiles `rounded-full` from it, so the 12 exports in
    8 families that use it gain a `radius.full` dependency. The value is unchanged, so they render
    the same.
- **Preservation:**
  - `release-011-delta` proves that stripping the listed additions restores each changed family's
    exact Release 008 semantic identity;
  - `release009-preservation` keeps checking the other 37 families and the Image, Link and Toggle
    Group bytes.
- **Knowledge:** guidance for the new options, backed by canonical source references.
- **Stories:**
  - Badge `StatusLinksLight` and `StatusLinksDark`;
  - Alert `StatusVariants`;
  - Avatar `Shapes`;
  - Icon `ContentIcons` and `ContentIconsRtl`;
  - Icon colour checks extended to the status colours.
- **Build heap:** `scripts/package-candidate.mjs` and the `package-identity` real-build tests now give
  the library build an 8192 MB heap.
  - **Why it no longer fit:** since Release 010 the producer phase retains about 3 GB while Vite
    bundles the 16 MB release data, peaking near 7 GB before collection.
  - **History:** Release 009 fit in 6144 MB with almost no margin (6.6 GB RSS). Release 010's React
    19 interfaces grew the data by about 5%.
  - **Effect:** the Release 010 commit itself runs out of memory at 6144 MB on this Mac, and two
    Release 010 baseline tests failed the same way. At 12 GB the build completes with a 4.8 GB
    maximum RSS.
  - **Later:** releasing the producer state before Vite runs would lower the peak.
- **Identity:** package `0.0.0-release.11` and release `shadcn-radix-release-011`. The Release 010
  record and manifest are frozen in `scripts/historical-artifacts.mjs`. CI targets the r11 binding.

## Not included

- **Container and breakpoint tokens:** the token contract's Phase 2 scope invariant excludes the
  `container` and `breakpoint` namespaces. Custom properties cannot drive media queries. Lifting the
  exclusion is an owner decision.
- **The chart component family:** Release 012.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `e207a258a32bd862c676c586e3d334ac721785cf03d5ce4b8681339b07ad98a6` |
| Release record file `provenance/releases/shadcn-radix-release-011.json` | `92e5cd7cf635b19b6bbbeeb9a8710da1572cd839ca7730baa53bcdd08a3487f7` |
| Distribution manifest | `d75c50c9d0d38c9ff158d1d130c4458f6e2167e5b0e9874e64a7e5acac207552` |
| Tarball `adc-shadcn-design-system-0.0.0-release.11.tgz` | `240e8f09351f71cc8795a59560b0f5e6b2cc3a76dcf14f6ebdda4135d24b6a58` |

- **Integrity:** `sha512-X7lsA+7mXqnNbzosKgNmYzMsrMCrrZVk5GXs8nyAa9bLFk6ZK8QthzQrJqiOL6DBrcvHg1VJZkcJOF0fGLcPZA==`.
- **Packing:** 56 packed files, from 364 implementation inputs (the same paths as Release 010).
- **Producer commit:** `c5942c47b69bd004b55b1c54d3821bcf955a780f`.
- **Toolchain:** Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1,
  esbuild 0.28.2.
- **Determinism:** release generation ran twice with byte-identical output. Historical Releases
  001–010 were checked before and after each run.
- **Location:** the external candidate is in
  `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-011-candidate/`. Its manifest
  is also committed as `provenance/distributions/shadcn-radix-release-011.distribution.json`. The
  tarball is not committed; Canvas vendors it.
- **Superseded candidates:** two earlier candidates were never accepted, and their artifacts are kept
  aside.
  - Payload `fc2d8b84…` (tarball `82cf2471…`) omitted the `radius.full` facts. Its artifacts are in
    `shadcn-radix-release-011-superseded-fc2d8b84/`.
  - Payload `a671bdfa…` was built before the heap fix; its tarball build ran out of memory.
- **Packed stylesheet:** it emits every new variable in both modes (`--success`, `--warning`,
  `--info` and their foregrounds, the new `--chart-1..5`, `--radius-full` and `--leading-display`).

## Verification

@@VERIFICATION@@

## Build location

The library build guard rejects every file read outside the frozen input manifest. Tools probe
ancestor directories:

- TypeScript loads every ancestor `node_modules/@types`.
- Vite reads the nearest ancestor `package.json`.

So a build fails with `UNBOUND_INPUT: ../../../…` when the checkout sits inside another project, or
under a directory that has a `package.json` (this machine has `~/package.json`). The guard is right
to refuse. Build candidates from a checkout with no ancestor `package.json` or `node_modules`. This
candidate was built from a detached worktree in a session temporary directory.
