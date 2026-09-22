# Release 005 → Canvas handoff

Release `shadcn-radix-release-005` merges the Release 004 Checkbox/Sidebar lineage with the Release 5 component hardening lineage. It ships 38 component families, 205 public exports, and the existing 82 token facts. Releases 001–004 are byte-for-byte unchanged.

- Source commit: `04fc344` (`codex/release005-integrated`)
- Package: `@adc/shadcn-design-system@0.0.0-release.5`
- Release payload SHA-256: `fca957dd0b403f568b71fdf472606927d3500a01fdfd09f70ac6c8e2fa3d90b2`
- Candidate tarball SHA-256: `325c149ac5435a589192a823e2dceeaaed6c00922b0ab0428736ef159600ed2b`
- Candidate tarball integrity: `sha512-sBAhJfRyYg9hHHZE77c3Feac6Vyk9YAsOa+Zu4KGpyTAFO0Xx/pNmTY4tPD0geSQprjIyJQTfPpwO4BQ7gXCVA==`
- Distribution manifest SHA-256: `2c3f0dba2de2b12f61653fb769c0bf29dfe43856790e7e43b5a0e90e5a438016`
- External candidate: `/private/tmp/release005-candidate-final.Vs7D0i/`

The candidate verifier rebuilt the package from source and compared the entire tarball byte-for-byte to the retained candidate; all 53 packed files matched. Canvas vendors that exact tarball. Its registry retains and exposes every Release 5 contract for queries, while its pre-existing closed authoring policy remains separate. In particular, new families are not automatically authorable.

The producer release binds UI source, including files observed by the Tailwind build, and retains the Release 004 `Checkbox.id` declaration fact required by existing Canvas authoring policy. No remote package publication was performed.
