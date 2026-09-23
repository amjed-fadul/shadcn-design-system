# Release 005 → Canvas handoff

Release `shadcn-radix-release-005` merges the Release 004 Checkbox/Sidebar lineage with the Release 5 component hardening lineage. It ships 38 component families, 205 public exports, and the existing 82 token facts. Releases 001–004 are byte-for-byte unchanged.

- Base source commit: `009483fca81d6bd47ab5d7d263009095b0a232e7` (`codex/release005-integrated`)
- Implementation commit: `ef637ac` (overlay portal correction)
- Package: `@adc/shadcn-design-system@0.0.0-release.5`
- Release payload SHA-256: `3dd233fa0245c0a3713836902b8f18c3ff1565b85cdb86d686320d90a368400e`
- Candidate tarball SHA-256: `b5e690f899d2ffe3ffb2b834a4be295442ac535271066a92a8be4d727919f3ec`
- Candidate tarball integrity: `sha512-PuE32FT4WK/xtEsXeKA3zv7t2wVgL/7fiqqBq/BoSHXs0BKYdEPliYKpRdr2BKTTCFnALODp6h3o8ACxeF5u1Q==`
- Distribution manifest SHA-256: `e4d5a144f153b0fb7673277028cc2f3ab3d0e69a06edf10fb9b5802106a2336f`
- External candidate: `/private/tmp/release005-overlay-portals-candidate-v1/`

`PopoverContent` and `AlertDialogContent` now accept the generic optional `portalContainer` prop. Each internal portal uses the supplied target; omitting it preserves the default body portal. Alert Dialog keeps its overlay and content within the same portal boundary, with modal behavior and Action/Cancel semantics intact.

The candidate verifier rebuilt the package from source and compared the entire tarball byte-for-byte to the retained candidate; all 53 packed files matched. Canvas can vendor that exact tarball when integration begins. Its registry retains and exposes every Release 5 contract for queries, while its pre-existing closed authoring policy remains separate. In particular, new families are not automatically authorable.

Release 005 carries scoped unresolved facts for `FieldError` conditional rendering, Slider Thumb cardinality, and context-derived Toggle Group item attributes. The executable projection retains these markers but does not carry rendering or accessibility trees; consumers can query the full contracts for those facts. The producer validator fails closed on authored nodes in affected families. Spinner now inherits the pinned React SVG interface, with its wrapper defaults and forwarded overrides backed by runtime evidence. Drawer retains Vaul's snap-point presence union.

The producer release binds UI source, including files observed by the Tailwind build, and retains the Release 004 `Checkbox.id` declaration fact required by existing Canvas authoring policy. No remote package publication was performed.
