# Release 005 → Canvas handoff

Release `shadcn-radix-release-005` merges the Release 004 Checkbox/Sidebar lineage with the Release 5 component hardening lineage. It ships 38 component families, 205 public exports, and the existing 82 token facts. Releases 001–004 are byte-for-byte unchanged.

- Source commit: `79bc9d07585bf5484ee8a4b23900bc8ee917625a` (`codex/release005-integrated`)
- Package: `@adc/shadcn-design-system@0.0.0-release.5`
- Release payload SHA-256: `5913ccae4330cb1284fc0017c8cc9f4fcc9810d9d0b468e8b074e6c33094eba5`
- Candidate tarball SHA-256: `4dc648881ac5bc65f21faa40c949be6fe3915487f24f285fa711bf9f2d17a5d9`
- Candidate tarball integrity: `sha512-zQITl/F7LPMy8YHD1Yukj4CULdf2Q8WU6hFd5EaVHpwRXJaZIcb9nOPjPjpxxuQb5hbpUPUwSjHg9v7sUUaOdA==`
- Distribution manifest SHA-256: `3195de019ee0903c71d36f022e6503267a867cd9c5e4a252e1e6fce3876facac`
- External candidate: `/private/tmp/release005-candidate-corrected-v1/`

The candidate verifier rebuilt the package from source and compared the entire tarball byte-for-byte to the retained candidate; all 53 packed files matched. Canvas can vendor that exact tarball when integration begins. Its registry retains and exposes every Release 5 contract for queries, while its pre-existing closed authoring policy remains separate. In particular, new families are not automatically authorable.

Release 005 carries scoped unresolved facts for `FieldError` conditional rendering, Slider Thumb cardinality, and context-derived Toggle Group item attributes. The executable projection retains these markers but does not carry rendering or accessibility trees; consumers can query the full contracts for those facts. The producer validator fails closed on authored nodes in affected families. Spinner now inherits the pinned React SVG interface, with its wrapper defaults and forwarded overrides backed by runtime evidence. Drawer retains Vaul's snap-point presence union.

The producer release binds UI source, including files observed by the Tailwind build, and retains the Release 004 `Checkbox.id` declaration fact required by existing Canvas authoring policy. No remote package publication was performed.
