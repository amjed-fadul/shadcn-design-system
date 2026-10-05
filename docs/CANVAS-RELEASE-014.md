# Release 014 → Canvas handoff

Release `shadcn-radix-release-014` fixes three layout gaps from Canvas's composition study
(amjed-fadul/agentic-design-canvas#62, §8: DS1, DS6, DS10), tracked as
amjed-fadul/shadcn-design-system#26. Tokens, props and the export inventory are unchanged, and
Releases 001–013 remain byte-for-byte unchanged.

**Status: accepted by the owner on 2026-10-05; macOS release qualification running.**
- **Candidate:** the owner accepted tarball `b7041f0e…` (payload `cee87378…`).
- **Qualification:** the manual macOS `release-qualification` workflow is running on `1ba5c02`
  ([run 37275097186](https://github.com/amjed-fadul/shadcn-design-system/actions/runs/37275097186)).
  Commits after the source `65d7387` change tests, the vitest config, docs and the committed
  manifest only.
- **Merge:** the owner merges.

## Exact distribution

- Producer source commit: `65d73871a5c7e7756381bf7b859b13df1b0b4cf8`
- Package: `@adc/shadcn-design-system@0.0.0-release.14`, licence `UNLICENSED`
- Release: `shadcn-radix-release-014`
- Token contract: `shadcn-radix-token-contract-003` (unchanged)
- Release payload SHA-256: `cee873785f1cab82c3ea5008cd48243ccea91935d30ac02ece8ad1fbd5d558a4`
- Release JSON SHA-256: `43f87895c1a04317142940b7dc363a909a3f6e1c944078be52b2dd64ee00e2f3`
- Candidate tarball SHA-256: `b7041f0e82022b01a712039b127f17dcb57286a1dd7f45144c1f8639d6ba97bb`
- Candidate tarball integrity: `sha512-8om7sUK+hCvYXSclk3wET1JnoF5DAFP3R+UY3kZ1Z2sos2jF29KwJFJnrzgdUQY/8yz7Iu8xgKFavxKwLwwF5w==`
- Distribution manifest SHA-256: `cf163a115d27cb42c30f4ce66fe53e5e4e7689ba54a739e35cd5b4e1d4db93a7` (also committed as
  `provenance/distributions/shadcn-radix-release-014.distribution.json`)
- Candidate: `~/.artifacts/shadcn-design-system/shadcn-radix-release-014-candidate/` (64 packed files)

## Adoption steps

1. **Vendor the candidate** and re-pin the identities above.
2. **Refresh visual baselines** for the render changes below: wrapping Accordion questions, every
   desktop sidebar, `floating` and `inset` sidebars, and card headers with an action.
3. **Check DOM selectors on sidebars with `collapsible="none"`.** Their children now sit inside
   `[data-slot=sidebar-inner]`, as on the collapsible paths.
4. **Authoring policy:** no prop changes. `variant="inset"` and `variant="floating"` now render as
   intended with `collapsible="none"`, so Canvas can offer them on static pages.

## Render changes from Release 013

- **DS1, Accordion:** a question that wraps starts every line at the trigger's start edge. Release
  013 centred the wrapped lines. Single-line questions are unchanged.
- **DS6, Sidebar:**
  - The inner panel carries `bg-sidebar` on every path. Release 013's collapsible desktop sidebars
    left it transparent over the page.
  - **`floating`:** an 8 px inset panel with a rounded corner (`radius.lg`), a `sidebar-border`
    border and `shadow.sm`.
  - **`inset`:** `SidebarInset` becomes a rounded (`radius.xl`), shadowed (`shadow.sm`) card with an
    8 px margin, 0 on the sidebar's side while it is expanded.
  - Both work with `collapsible="none"`, where Release 013 drew them like `sidebar`.
- **DS10, CardHeader:** beside a `CardAction`, the title column takes the free width
  (`grid-cols-[1fr_auto]`) and the action fits its content.

## Evidence

Browser stories check each fix with real computed styles, and every one of them fails on Release
013's source:
- `Accordion/LongQuestion`: a wrapping question's every line starts at the trigger's start edge.
- `Card/HeaderWithAction`: in a 700 px card the title takes all but the action's width.
- `Sidebar/InsetVariant`, `FloatingVariant`, `DefaultVariantSurface` (all `collapsible="none"`) and
  `InsetCollapsible`: margins, radius, border, shadow and surface per variant, and the inset margin
  returning when the sidebar collapses.

## Verification

From a detached clean worktree at `65d7387`, with Node 22.18.0, npm 10.9.3 and CI's exact commands
(vitest's default timeouts):
- **Release generation:** ran twice, with byte-identical output. Release 013's record and manifest
  are frozen.
- **`release:verify`:** accepted payload `cee87378…`.
- **`candidate:verify`:** a fresh rebuild matched all 64 packed files byte for byte, with no
  expectations refreshed.
- **Typecheck and build:** passed.
- **Unit suite (`npm run test`):** at `65d7387`, 1,841 of 1,847 tests passed.
  - **Pinned Sidebar facts (3 failures):** two preservation checks pinned the Sidebar's Release 008
    semantic identity, and one its source hash. DS6 changes both on purpose.
  - **Time limits (3 failures):** three tests hit vitest's 5 s default under load.
  - **Fix, `3ea9a9d` (tests and the vitest config only, not release inputs):**
    - the Sidebar leaves the "unchanged" checks, and `tests/release-014-delta.test.ts` proves the
      `collapsible="none"` inner panel is its only semantic change;
    - Accordion and Card keep their exact Release 008 identities;
    - the unit project defaults to 30 s.
  - **Rerun:** the six tests pass with CI's command, and the full suite is being rerun at `3ea9a9d`.
- **Storybook:** 257 of 257 tests in 44 files, with the axe gate at
  `error`; `build-storybook` passed. The six new stories fail on Release 013's source.
- **`npm audit`:** full and production audits found 0 vulnerabilities.
