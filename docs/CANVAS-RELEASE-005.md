# Release 005 → Canvas handoff

Release `shadcn-radix-release-005` merges the Release 004 Checkbox/Sidebar lineage with the Release 5 component hardening lineage. It ships 38 component families, 205 public exports, and the existing 82 token facts. Releases 001–004 are byte-for-byte unchanged.

- Base source commit: `009483fca81d6bd47ab5d7d263009095b0a232e7` (`codex/release005-integrated`)
- Producer source commit: `1499e51eb191ee83622d82d500f064832e787d6f` (CommandDialog portal correction)
- Verification commit: `9ae1b5affe98362301498389b9c2758f18f2fc8a` (test typing correction)
- Package: `@adc/shadcn-design-system@0.0.0-release.5`
- Release payload SHA-256: `3eb8e00456118c9085f7a9faf246c82d134252d5346afb8c525268001d5e5bf1`
- Candidate tarball SHA-256: `18493ac39611e5d3a236eb75835cf715689403734de423ec9a003df0b9d04f49`
- Candidate tarball integrity: `sha512-KayvOoabxOLzynu06YHxFIO1c3pJNralUswSkovpdZl6crjAn9fU41voPAj01WS4MLaGFjUza018oFJLVcCDSA==`
- Distribution manifest SHA-256: `e02ce7d11483faa6aba1852cf21a22ec7ebdacdf7c1af1746fa718faa8e7a8f6`
- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-005-patch-a/`

`PopoverContent` and `AlertDialogContent` now accept the generic optional `portalContainer` prop. Each internal portal uses the supplied target; omitting it preserves the default body portal. Alert Dialog keeps its overlay and content within the same portal boundary, with modal behavior and Action/Cancel semantics intact.

`CommandDialog` now also accepts the same optional generic `portalContainer` prop and forwards it to its internal `DialogContent`. Omitting the prop preserves the default body portal; supplying it keeps the dialog overlay and content in the provided host. No Canvas implementation is included in this producer handoff.

The candidate verifier rebuilt the package from source and compared the entire tarball byte-for-byte to the retained candidate; all 53 packed files matched. Canvas can vendor that exact tarball when integration begins. Its registry retains and exposes every Release 5 contract for queries, while its pre-existing closed authoring policy remains separate. In particular, new families are not automatically authorable.

Release 005 carries scoped unresolved facts for `FieldError` conditional rendering, Slider Thumb cardinality, and context-derived Toggle Group item attributes. The executable projection retains these markers but does not carry rendering or accessibility trees; consumers can query the full contracts for those facts. The producer validator fails closed on authored nodes in affected families. Spinner now inherits the pinned React SVG interface, with its wrapper defaults and forwarded overrides backed by runtime evidence. Drawer retains Vaul's snap-point presence union.

The producer release binds UI source, including files observed by the Tailwind build, and retains the Release 004 `Checkbox.id` declaration fact required by existing Canvas authoring policy. No remote package publication was performed.
