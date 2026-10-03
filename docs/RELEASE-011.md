# Release 011: Canvas visual-gap requests

Release 011 answers amjed-fadul/shadcn-design-system#19.

- **Tokens:** status colours, a coloured chart palette, `radius.full` and `line-height.display`,
  under token contract `shadcn-radix-token-contract-003`.
- **Components:** Badge, Alert, Icon and Avatar options. Every existing default renders as before.

The design and rulings are in
[the spec](superpowers/specs/2026-10-03-release-011-canvas-requests-design.md), and the Canvas handoff
is in [CANVAS-RELEASE-011](CANVAS-RELEASE-011.md). The chart component family is the separate
[Release 012 draft spec](superpowers/specs/2026-10-03-release-012-chart-family-proposal.md).

**Status: accepted; merge waits for macOS release qualification.**
- **Token contract:** the owner approved token contract `-003` on 2026-10-03, after reviewing light
  and dark renders.
- **Candidate:** the owner accepted the Release 011 candidate the same day. The accepted candidate is
  tarball `1b76e05e…` (payload `915ee7ab…`).
- **Before merge:** the manual macOS `release-qualification` workflow must pass.

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
  - **Later:** a follow-up session traced the retained state. The component loader keeps 23
    TypeScript programs (about 2.8 GB) alive through the Vite bundle. The owner scheduled that fix
    for Release 012.
- **Vendored shadcn stylesheet:** the repo only imports `shadcn/tailwind.css` and never runs the
  shadcn CLI.
  - **What moved:** the stylesheet and its MIT licence were copied byte for byte into
    `src/vendor/shadcn/`. `vendored.json` records their origin (shadcn@4.19.0, lockfile integrity and
    file SHA-256s).
  - **Dependency removed:** the `shadcn` dev dependency is gone: 234 lockfile entries, with no other
    version changes. Its tree carried GHSA-vfj7-8cjw-p6xm (`braces`, high severity, no patched
    version), which had turned the full `npm audit` red. The full audit now finds 0 vulnerabilities.
  - **Effect on outputs:** none. The compiled stylesheet, JS bundle, licence notices and type
    declarations are byte-identical. Release inputs walk `src/vendor`.
- **Identity:** package `0.0.0-release.11` and release `shadcn-radix-release-011`. The Release 010
  record and manifest are frozen in `scripts/historical-artifacts.mjs`. CI targets the r11 binding.

## Not included

- **Container and breakpoint tokens:** the token contract's Phase 2 scope invariant excludes the
  `container` and `breakpoint` namespaces. On 2026-10-03 the owner decided to keep them excluded:
  - Canvas pages are fixed at 1440×900, and responsive layouts are not in V1, so the tokens would
    drive nothing yet;
  - custom properties cannot drive media queries anyway.

  Revisit when Canvas gets responsive pages.
- **The chart component family:** Release 012. The owner approved its spec on 2026-10-03.

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `915ee7ab6345f7f550f599beea432c143b18c9c45dce264e1a2376bb2670f2e6` |
| Release record file `provenance/releases/shadcn-radix-release-011.json` | `fd3afb47e710fa18f4007ad759134018ce4114ec0b5bfd5acb64bbcad4d35773` |
| Distribution manifest | `9190ce39c049cc6016fdd976d6a2bb405ce74119bfda4847b4d7548a3f6577ea` |
| Tarball `adc-shadcn-design-system-0.0.0-release.11.tgz` | `1b76e05e538fde70c4cb399f8e9e5c7d0b6cf93b6f94068e793aa4b6e96bae63` |

- **Integrity:** `sha512-hkKxDkuPT5ylF6zIjRlFFmpTgw0AURCCeOFT8crTAMVt75sVgpWS4izDOMUMIO5WYwYPeUnK93VOReeeIEtkCA==`.
- **Packing:** 56 packed files, from 365 implementation inputs.
- **Producer commit:** `20b0e162b41343da34b3349c0e4c669753939489`.
- **Toolchain:** Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1,
  esbuild 0.28.2.
- **Determinism:** release generation ran twice with byte-identical output. Historical Releases
  001–010 were checked before and after each run.
- **Location:** the external candidate is in
  `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-011-candidate/`. Its manifest
  is also committed as `provenance/distributions/shadcn-radix-release-011.distribution.json`. The
  tarball is not committed; Canvas vendors it.
- **Superseded candidates:** three earlier candidates were never accepted. Their artifacts are kept
  aside under `~/.artifacts/shadcn-design-system/`.
  - Payload `fc2d8b84…` (tarball `82cf2471…`) omitted the `radius.full` facts. Artifacts:
    `shadcn-radix-release-011-superseded-fc2d8b84/`.
  - Payload `a671bdfa…` was built before the heap fix; its tarball build ran out of memory.
  - Payload `e207a258…` (tarball `240e8f09…`) still depended on the shadcn CLI package. Artifacts:
    `shadcn-radix-release-011-superseded-e207a258/`. Against the final candidate, only
    `dist-library/release.js` and the packed `package.json` differ; the other 54 packed files are
    identical.
- **Packed stylesheet:** it emits every new variable in both modes (`--success`, `--warning`,
  `--info` and their foregrounds, the new `--chart-1..5`, `--radius-full` and `--leading-display`).

## Verification

All commands ran with Node 22.18.0 and npm 10.9.3.

- **Release generation:** ran twice per regeneration, with byte-identical output. Historical Releases
  001–010 were checked before and after each run.
- **`release:verify`:** accepted payload `915ee7ab…`.
- **`candidate:verify`:** rebuilt the package from producer inputs. All 56 packed files matched the
  retained candidate byte for byte, and no expectations were refreshed.
- **`npm run typecheck`:** passed.
- **`npm run build`:** passed.
- **Unit suite at the PR head (clean worktree):** @@UNIT@@
- **Storybook:** `vitest --project=storybook` passed 43 files and 230 tests. That is Release 009's
  224 plus 6 new stories, with the axe gate at `error`, so the new colours pass rendered contrast
  checks in light and dark. `build-storybook` passed.
- **Owner review:** the owner reviewed light and dark renders of every new token and option, and
  approved token contract `-003` on 2026-10-03.
- **Release 010 baseline (clean worktree, unmodified):** 1,550 of 1,554 tests passed. All 4 failures
  were in `package-identity`:
  - two real builds ran out of memory (fixed in this release by the 8 GB build heap);
  - one timed out;
  - one candidate-verification child process errored.
- **Timing-sensitive tests:**
  - `provenance.test.ts` spawns `git hash-object` 41 times. At about 0.17 s per spawn it can exceed
    Vitest's 5 s default when the machine is loaded; it passes with a longer timeout.
  - Under a load spike (load average 45 on 8 cores), nine `component-contract-independent-review`
    tests also exceeded 5 s. That file passes all 89 tests when re-run.
- **`npm audit`:** full and production audits find 0 vulnerabilities after the shadcn stylesheet
  was vendored. Before that, GHSA-vfj7-8cjw-p6xm (`braces`, published after main's last green run)
  failed the full audit for both Release 010 and this branch.
- **CI:** @@CI@@

## Build location

The library build guard rejects every file read outside the frozen input manifest. Tools probe
ancestor directories:

- TypeScript loads every ancestor `node_modules/@types`.
- Vite reads the nearest ancestor `package.json`.

So a build fails with `UNBOUND_INPUT: ../../../…` when the checkout sits inside another project, or
under a directory that has a `package.json` (this machine has `~/package.json`). The guard is right
to refuse. Build candidates from a checkout with no ancestor `package.json` or `node_modules`. This
candidate was built from a detached worktree in a session temporary directory.
