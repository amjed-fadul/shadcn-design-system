# Release 005 → Canvas handoff

Release `shadcn-radix-release-005` merges the Release 004 Checkbox/Sidebar lineage with the Release 5 component hardening lineage. It ships 38 component families, 205 public exports, and the existing 82 token facts. Releases 001–004 are byte-for-byte unchanged.

## Final exact distribution

- Base source commit: `009483fca81d6bd47ab5d7d263009095b0a232e7` (`codex/release005-integrated`)
- Producer source commit: `3deb8c24f7e5fd8081fc6cfcbcb7618baecb0cb1` (`codex/release005-overlay-rtl`, Storybook accessibility gate)
- Package: `@adc/shadcn-design-system@0.0.0-release.5`
- Release payload SHA-256: `dda7e812b0a6eb5bb336a4d37a4fe514a6d425faed4842946cd97799036970ac`
- Candidate tarball SHA-256: `e227566f97b1ed8062c4007dd105ab187a95a6a520776a8f9d2fb948535d66b9`
- Candidate tarball integrity: `sha512-21lxXvlm+JvvTJ+RWdadsKvLV5wOlL15nADcfX49kbWIbIybasdAiiGCoPrp8QPGxGqLUqwDVtqCZSGyfZESIw==`
- Distribution manifest SHA-256: `a6c108f252c453f9baa3ee078d7ecdea7ac443c25c4a9624d51fac620ab2a85d`
- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-005-a11y-vitest4/`
- Packed files: 53; executable implementation inputs: 349.
- Toolchain: Node 22.18.0, npm 10.9.3, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2. Tests run on Vitest 4.1.11.

The candidate verifier rebuilt the package from the producer source commit and compared the entire tarball byte-for-byte to the retained candidate; all 53 packed files matched. Canvas can vendor that exact tarball when integration begins. Its registry retains and exposes every Release 5 contract for queries, while its pre-existing closed authoring policy remains separate. In particular, new families are not automatically authorable.

## Portals

`PopoverContent`, `AlertDialogContent`, and `CommandDialog` accept the generic optional `portalContainer` prop. Each internal portal uses the supplied target; omitting it preserves the default body portal. Alert Dialog keeps its overlay and content within the same portal boundary, with modal behavior and Action/Cancel semantics intact. `CommandDialog` forwards the prop to its internal `DialogContent`, so the dialog overlay and content stay in the provided host. No Canvas implementation is included in this producer handoff.

## Resolved render facts

The scoped unresolved facts carried by earlier Release 005 candidates are now resolved in the full producer contracts. The executable projection carries no unresolved markers; it still carries public API and composition facts rather than rendering or accessibility trees, so consumers query the full contracts for render behavior.

- `FieldError` records its ordered branches: truthy `children` first, then `null` for an absent or empty `errors` array, then `message`-keyed deduplication that renders a single message or a `ul` of truthy messages. The outer `role="alert"` element exists only for truthy content. See `docs/release-005-patch-b-source-audit.md`.
- Slider renders one Thumb per element of the first array among `value`, `defaultValue`, then `[min]`; empty arrays yield zero Thumbs.
- Toggle Group items resolve `variant` and `size` as `context ?? local`, read `data-spacing` from context, and write their data attributes before the public prop spread, so forwarded `data-*` values can replace them. Toggle Group's factual contract is resolved; Canvas authoring still requires an explicit policy decision. See `docs/release-005-patch-c-source-audit.md`.

Spinner inherits the pinned React SVG interface, with its wrapper defaults and forwarded overrides backed by runtime evidence. Drawer retains Vaul's snap-point presence union.

## Component changes since the portal handoff

- Slider accepts optional `thumbAriaLabels` or `thumbAriaLabelledBy`, one entry per Thumb, to name generated Thumbs by index. Supplying both, a length that differs from the Thumb count, or a blank entry throws.
- Alert Dialog, Dialog, Dropdown Menu, Select, and Sheet use logical inline utilities (`start`/`end`, `ps`/`pe`, `ms`) so overlay chrome mirrors under `dir="rtl"`; submenu chevrons rotate in RTL. `npm run test:overlay-rtl` checks both directions in a browser.
- Sidebar animates its gap, container, and flow spacer widths together with a 200 ms `ease-out` transition on desktop, so collapse motion stays synchronized. Mobile and `collapsible="none"` sidebars do not animate the flow spacer.

## Accessibility gate

Every Storybook story passes the axe gate (`a11y.test: "error"`). Four component classes changed to meet WCAG AA contrast; token values are unchanged.

- `AvatarFallback` and `AvatarGroupCount` use `text-foreground` on `bg-muted`; `text-muted-foreground` measured 4.34:1.
- The destructive `Alert` description uses full `text-destructive` (4.76:1) instead of `text-destructive/90`.
- `CommandShortcut` uses `text-accent-foreground` inside a selected `CommandItem`, whose `bg-accent` left the muted shortcut at 4.34:1.

The Progress, Field slider, and open Popover stories now give their controls accessible names; the components are unchanged. The Command Playground and Empty stories disable only axe's `aria-required-children` rule: cmdk hard-codes `role="separator"` inside its listbox and keeps the listbox when a search has no results, as upstream shadcn does.

Vitest moved from 3.2.7 to 4.1.11 for GHSA-82fw-gwwq-j7x9. Because `package.json` and `package-lock.json` are implementation inputs, this also changes the release payload.

The producer release binds UI source, including files observed by the Tailwind build, and retains the Release 004 `Checkbox.id` declaration fact required by existing Canvas authoring policy. No remote package publication was performed.

## Superseded Release 005 candidates

These identities are historical only and are not the final handoff above:

| Candidate | Release payload SHA-256 | Tarball SHA-256 |
| --- | --- | --- |
| `shadcn-radix-release-005-producer-convergence` (before the accessibility gate) | `414509ea325fd1cc94d0b42f572abc6fd387bf1b5a3e8d50b0a21537964aab45` | `8b99449592eaf1114c47449d5b64458a3eb741ff372b5afd9227d708ca757796` |
| `shadcn-radix-release-005-patch-a` (portal correction) | `3eb8e00456118c9085f7a9faf246c82d134252d5346afb8c525268001d5e5bf1` | `18493ac39611e5d3a236eb75835cf715689403734de423ec9a003df0b9d04f49` |
| `shadcn-radix-release-005-patch-c-final` (render facts) | `82b01c3948a2a70e87830a017f5bb9b41d8f0a6d6e19ab5eb4fcf71c54be3d80` | `cdf1a27acbfcdc3bf5b94ab12e3f16980581e8eaef5bcfa166f7a30a7d620f6b` |
| `release-005-slider-naming-candidate-final` | `af10e2d8c63a26aca88ffaf1d89fc1459b68de37048809d22596558344ba6001` | `916db3ad6ccce315e9507a6b529087e0f74dc392b97c23a85feaaa770e464cf0` |
| `shadcn-radix-release-005-overlay-rtl-final` | `755b6090c3daac3a7afd2dc53a7325af7784e4307dd51a8dc34bfd1b34aeb588` | `3ac45ccd2309c2cc034d0de0e7daf21c5992de4bd9029f15f69a873289438de6` |
