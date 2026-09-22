# Release 005 Canvas Consumption Implementation Plan

> **For agentic workers:** Execute task by task with focused review and verification.

**Goal:** Ship one immutable package containing the hardened 38-family contracts and connect its complete factual inventory to Canvas.

**Architecture:** Merge the two Release 004 producer source lines and the Release 5 hardening history. Generate a new Release 005 package from the reconciled source. Canvas vendors that exact archive and projects every shipped export into its factual registry while retaining its closed authoring policy.

**Tech Stack:** Node 22.18.0, TypeScript, React 18.3.1, Vitest, npm file tarballs.

**Spec:** `docs/superpowers/specs/2026-09-23-release-005-canvas-consumption-design.md`

## Global Constraints

- Preserve previously accepted release artifacts and tarballs byte for byte.
- Never assign historical release IDs or package versions to new bytes.
- Preserve the package's public root, `styles.css`, and `release` entrypoints.
- Keep Canvas authoring policy and adapters independent of shipped factual contracts.
- Existing governed Canvas components must continue to render and validate.

## Review Focus

- A colliding Release 002 or Release 004 payload must never be accepted under an old identity.
- Every new family must be factually queryable while unsupported authoring is rejected.
- Checkbox/Label and Sidebar source behavior from the two Release 004 lines must both survive.
- Portal containment, Sheet sizing, and existing runtime providers must survive the package change.
- All three Canvas consumers must resolve the same archive and npm integrity.

---

### Task 1: Reconcile producer histories

**Files:** Producer contracts, component source, validator, package scripts, tests, provenance, and this design/plan.

**Interfaces:** Produces one source tree with 38 canonical families and the Release 004 library/distribution machinery.

- [ ] Record hashes of accepted release artifacts and archives before the merge.
- [ ] Merge `codex/sidebar-release004` and `codex/release5-hardening` into a branch based on `codex/checkbox-label-release004`; retain all three parent histories.
- [ ] Resolve conflicts from source evidence and tests. Regenerate derived indexes/contracts where the repository generator owns them. Retain accepted historical release files instead of choosing colliding new bytes.
- [ ] Run canonical inventory, component contracts, source authority, and typecheck. Resolve failures before release generation.
- [ ] Commit the reconciled source as a coherent merge/fix sequence.

### Task 2: Cut and verify Release 005

**Files:** `package.json`, `package-lock.json`, `src/validator/release.ts`, `src/validator/canonical-release.ts`, package/release build scripts, `provenance/releases/shadcn-radix-release-005.json`, `provenance/distributions/shadcn-radix-release-005.distribution.json`, `docs/CANVAS-RELEASE-005.md`, related tests.

**Interfaces:** Produces `@adc/shadcn-design-system@0.0.0-release.5` with the existing three public entrypoints and literal handoff hashes.

- [ ] Add failing tests for the new ID/version, exact 38-family/export parity, package identity, historical hashes, and deterministic archive.
- [ ] Update release constants and package version, generate Release 005 from reconciled source, build the library, and generate a candidate archive/manifest.
- [ ] Run producer typecheck, focused and full unit tests, Storybook build/tests where the environment permits, release verification, isolated consumer proof, and repeat build/hash comparison.
- [ ] Record literal payload SHA-256, archive SHA-256, npm SRI, source commit, and manifest SHA-256 in the handoff; commit the release and handoff.

### Task 3: Vendor factual Release 005 into Canvas

**Files:** `vendor/shadcn-design-system/`, `canvas/package.json` and lock, `design-system-registry/package.json` and lock, `semantic-renderer/package.json` and lock, `design-system-registry/src/shadcn-release.ts` and tests, current status/validation docs.

**Interfaces:** Consumes the exact Task 2 archive. Produces a connected Canvas registry and MCP factual reads for all 38 families.

- [ ] Add failing registry/MCP tests: release identity and hash; all 38 families available as factual records; a new family query succeeds; unsupported new family authoring fails; existing governed behavior remains.
- [ ] Copy the verified archive byte for byte, pin it in all three package manifests and lockfiles, and update only the connected release constants and necessary factual projection compatibility.
- [ ] Run all three package tests/typechecks plus Canvas and MCP focused integration checks; verify exact archive SHA-256 and lockfile SRI.
- [ ] Update the factual consumption and validation records and commit the Canvas integration.
