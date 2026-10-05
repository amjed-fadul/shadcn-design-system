# Release 014: Accordion, Sidebar and CardHeader layout fixes

Release 014 fixes three layout gaps Canvas found in its composition study
(amjed-fadul/agentic-design-canvas#62, §8), tracked as amjed-fadul/shadcn-design-system#26. The owner
scoped this release to these fixes only; the other requests are #27 (variants), #28 (chart legend
marker) and #29 (colour tokens). Tokens, props and the export inventory are unchanged.

The Canvas handoff is [CANVAS-RELEASE-014](CANVAS-RELEASE-014.md).

**Status: candidate, awaiting owner review.** The macOS release qualification runs next. The producer does
not tag or approve the release.

## Changes

- **DS1, AccordionTrigger start alignment.**
  - **Problem:** the trigger is a button, and its `text-align: center` reached a direct-text label, so
    a question that wraps was centred.
  - **Fix:** the trigger adds logical `text-start`, as `SidebarMenuButton` already has. Single-line
    questions are unchanged.
- **DS6, Sidebar variant styling (upstream parity, and beyond it for `collapsible="none"`).**
  - **Inner panel:** `sidebar-inner` carries the sidebar surface (`bg-sidebar`). A `floating` panel
    is a card with a rounded corner (`radius.lg`), a `sidebar-border` border and `shadow.sm`.
  - **Inset:** `SidebarInset` beside an `inset` sidebar becomes a rounded (`radius.xl`), shadowed
    (`shadow.sm`) card with an 8 px margin. While the sidebar is expanded, the margin on the
    sidebar's side is 0. Sides are physical, as the sidebar's placement is.
  - **`collapsible="none"`:** Release 013 drew every variant like `sidebar` here, and upstream does
    too. This path now uses the same inner panel and padding, and is the peer `SidebarInset` reads,
    so `floating` and `inset` render as they do elsewhere. This was Canvas's case.
- **DS10, CardHeader action column.**
  - **Problem:** beside `CardAction`, the header's implicit columns sized to content, so the title
    column was too narrow (240 px of a 700 px card).
  - **Fix:** upstream's `has-data-[slot=card-action]:grid-cols-[1fr_auto]`.
- **Contracts:** the accordion, card and sidebar family contracts are regenerated.
  - The canonical source hashes change.
  - Recomputed token dependencies add `shadow.sm`, `radius.lg`, `radius.xl`,
    `color.sidebar-border` and spacing to `Sidebar` and `SidebarInset`, for the new padding and
    margins.
  - The `collapsible="none"` render tree gains the inner panel node.
- **Release identity:** `0.0.0-release.14`. Release 013's record (`aaa0ced0…`) and manifest
  (`112cc081…`) are frozen.

## Render changes from Release 013

- A wrapping Accordion question is start-aligned.
- Every desktop sidebar's inner panel draws `bg-sidebar`. Release 013's collapsible desktop sidebars
  left it transparent over the page.
- `floating` and `inset` sidebars render their upstream styling, including with `collapsible="none"`.
- A `collapsible="none"` sidebar's children now sit inside a `[data-slot=sidebar-inner]` element, as
  the collapsible paths' children already did.
- A CardHeader with a CardAction gives the title the free width.

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

## Candidate

| Identity | SHA-256 |
| --- | --- |
| Release payload | `cee873785f1cab82c3ea5008cd48243ccea91935d30ac02ece8ad1fbd5d558a4` |
| Release record file `provenance/releases/shadcn-radix-release-014.json` | `43f87895c1a04317142940b7dc363a909a3f6e1c944078be52b2dd64ee00e2f3` |
| Distribution manifest | `cf163a115d27cb42c30f4ce66fe53e5e4e7689ba54a739e35cd5b4e1d4db93a7` |
| Tarball `adc-shadcn-design-system-0.0.0-release.14.tgz` | `b7041f0e82022b01a712039b127f17dcb57286a1dd7f45144c1f8639d6ba97bb` |

- **Integrity:** `sha512-8om7sUK+hCvYXSclk3wET1JnoF5DAFP3R+UY3kZ1Z2sos2jF29KwJFJnrzgdUQY/8yz7Iu8xgKFavxKwLwwF5w==`.
- **Packing:** 64 packed files.
- **Producer commit:** `65d73871a5c7e7756381bf7b859b13df1b0b4cf8`.
- **Location:** `~/.artifacts/shadcn-design-system/shadcn-radix-release-014-candidate/`. The manifest is
  also committed as `provenance/distributions/shadcn-radix-release-014.distribution.json`.
