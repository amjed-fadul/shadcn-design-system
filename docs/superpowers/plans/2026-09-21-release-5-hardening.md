# Release 5 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a green, canonical, immutable 38-family release.5 from the reviewed cumulative branch.

**Architecture:** First reconcile branch inputs so the filesystem contains the final 38-family inventory. Then repair component truth, promote that truth through manifests and loaders, generate a new executable release, and finally remove CI/security exceptions. Each layer consumes the previous layer's verified output.

**Tech Stack:** React 18, TypeScript 5.5, Vite 7, Vitest, Storybook, Tailwind CSS 4, Radix UI, shadcn/ui, Node 22.18.0.

**Spec:** `docs/superpowers/specs/2026-09-21-release-5-hardening.md`

## Global Constraints

- Final inventory is exactly 38 families: the original 19 plus the 19 named release.5 families.
- Preserve release 001 unchanged; publish a new immutable release artifact and activate it explicitly.
- No typecheck allowlists, test `continue-on-error`, skipped families, or unregistered contract/knowledge files.
- Use test-first fixes for behavior and failing-baseline/passing-result evidence for integration and generated artifacts.
- Use Node 22.18.0 for every verification command.

## Review Focus

- Divergent histories: merging `main` and Collapsible must preserve both old and new stories/components.
- Inventory drift: implementation, contract, index, provenance, knowledge, and executable release family sets must be identical.
- Source truth: inherited interfaces and token/render facts must match the actual TSX rather than being taught as exceptions.
- Immutable release activation: release 001 stays byte-identical while canonical validation consumes the new release.
- CI honesty: ordinary local commands and CI commands must fail on any regression and pass without diagnostic exemptions.

---

### Task 1: Reconcile `main` and restore package-wide Storybook

**Files:**
- Merge from: `main`
- Resolve: `package.json`, `package-lock.json`, Storybook configuration/tests, any overlapping documentation
- Preserve: every existing release.5 component and story

**Interfaces:**
- Consumes: release.5 tree at `644f2098fd2ff54e66de27b39f951a341421687a`; `main` at `9b3d2be608eb568ddfa02fe4a530f561588c95a4`
- Produces: one tree with Storybook config/scripts/dependencies, 19 original stories, and 18 currently integrated release.5 stories

- [ ] Record the red baseline: `npm run typecheck` must fail on missing `@storybook/react-vite` and `npm run build-storybook` must be unavailable.
- [ ] Merge `main` with a real merge commit; resolve dependency/config conflicts by retaining the union of release.5 runtime dependencies and `main` Storybook dev dependencies/scripts.
- [ ] Assert with tests or a manifest check that the 37 present component files have 37 story files and Storybook includes `src/**/*.stories.tsx`.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run test-storybook`, `npm run build-storybook`, and `npm run build`.
- [ ] Commit the integration resolution.

### Task 2: Integrate Collapsible as the nineteenth release.5 family

**Files:**
- Add from `075283fc9268ac18e0264e61754a9f59d4814633`: `src/components/ui/collapsible.tsx`, its story, family contract, knowledge file, three Radix interfaces, and reference entry
- Test: add or extend release.5 inventory/Collapsible verification

**Interfaces:**
- Consumes: Task 1's 37-component/37-story tree
- Produces: 38 component implementations and 38 Storybook families; Collapsible artifacts remain unregistered until Tasks 4–5

- [ ] Write an inventory test that fails because Collapsible is absent and expects its source, story, contract, knowledge, and interface artifacts.
- [ ] Cherry-pick or transplant only the Collapsible branch commits after merge-base `0803642dd23a9a192d27a86357f457d9a3fcedcc`, resolving references without removing later families.
- [ ] Run the new inventory test, Collapsible-focused tests, typecheck, `npm run test-storybook`, `npm run build-storybook`, and application build.
- [ ] Commit the Collapsible integration.

### Task 3: Correct PopoverTitle source and contract truth

**Files:**
- Modify: `src/components/ui/popover.tsx`
- Modify: `contracts/components/families/popover.json`
- Modify: `contracts/components/interfaces/html.h2.json` only by deleting it after an exact repository-wide reference check proves zero remaining consumers
- Test: `tests/release-5-popover.test.ts`

**Interfaces:**
- Consumes: React intrinsic interface modeling and Popover family contract
- Produces: one consistent `div` public interface/host model for `PopoverTitle`

- [ ] Change the focused test first so it expects `React.ComponentProps<"div">`, `html.div`, and a rendered `div`; run it and confirm the old `html.h2` contract fails.
- [ ] Change the component signature and contract inheritance to `div`, remove `html.h2` only if no longer referenced, and update manifests/evidence affected by that removal.
- [ ] Run `tests/release-5-popover.test.ts`, typecheck, and all component-contract tests.
- [ ] Commit the Popover correction.

### Task 4: Promote all 38 component contracts into the canonical graph

**Files:**
- Modify: `contracts/components/component-contract-set.json`, `contracts/components/index.json`
- Modify: `provenance/component-contract-source.json`, `provenance/seed-components.json`
- Modify: `src/contracts/components/canonical-loader.ts` and reconciliation/analyzer helpers
- Modify: component-contract tests, especially independent review/runtime evidence/query/provenance tests
- Repair: any release.5 family or inherited-interface artifacts proven inaccurate by the independent audit

**Interfaces:**
- Consumes: final 38 source families from Tasks 1–3
- Produces: canonical loader/query returning exactly 38 reconciled families with no orphan interfaces/evidence

- [ ] Change canonical inventory tests from hard-coded Phase-3 scope to exact manifest/provenance equality and confirm they fail at 19.
- [ ] Register all 38 family files and only referenced interface files; make the loader derive expected count/scope from pinned provenance rather than a numeric literal.
- [ ] Extend canonical source identity and capability authority for every new family.
- [ ] Run the independent audit; repair root causes for every reported release.5 mismatch rather than suppressing findings.
- [ ] Run `npm run components:verify` and the full test suite; require zero contract/audit failures.
- [ ] Commit the canonical component graph.

### Task 5: Promote all 38 knowledge artifacts

**Files:**
- Modify: `contracts/knowledge/knowledge-set.json`, `contracts/knowledge/references.json`
- Modify: `tests/knowledge-contracts.test.ts` and canonical knowledge query tests

**Interfaces:**
- Consumes: Task 4's exact 38-family component IDs
- Produces: knowledge loader/query exposing the same exact family set

- [ ] Add a failing equality test comparing knowledge component IDs with canonical component family IDs.
- [ ] Register all 38 knowledge component files and close any missing/unused reference evidence.
- [ ] Run knowledge tests, component-contract tests, and full tests.
- [ ] Commit the canonical knowledge graph.

### Task 6: Generate and activate immutable release 002

**Files:**
- Create: `provenance/releases/shadcn-radix-release-002.json`
- Modify: `src/validator/release.ts`, `src/validator/canonical-release.ts`, `scripts/generate-executable-release.ts`, `tests/executable-release.test.ts`, `tests/executable-release-validator.test.ts`, `tests/executable-contract-19-families.test.ts`, `tests/executable-contract-projection.test.ts`, `tests/executable-contract-validator.test.ts`
- Preserve byte-for-byte: `provenance/releases/shadcn-radix-release-001.json`

**Interfaces:**
- Consumes: approved 38-family component contract set and token contract
- Produces: content-addressed release 002 with exact family/export parity and canonical validator activation

- [ ] Add failing tests for active release ID/path, 38 unique family IDs, export parity with the canonical index, digest verification, and release-001 immutability.
- [ ] Update the generator/release constants for release 002, generate the artifact deterministically, and activate only release 002 in the canonical validator.
- [ ] Re-run generation and assert no diff; run executable contract/release tests and full tests.
- [ ] Commit release 002.

### Task 7: Make release-wide CI and security gates honest and green

**Files:**
- Modify: `.github/workflows/alert-dialog-final-verify.yml`, `.github/workflows/command-final-verify.yml`, `.github/workflows/drawer-final-verify.yml`, `.github/workflows/popover-final-verify.yml`, `.github/workflows/baseline.yml`
- Modify: `package.json`, `package-lock.json`, `vitest.config.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, `.storybook/vitest.setup.ts`, and their verification tests
- Remove: Storybook typecheck allowlists and full-suite `continue-on-error`

**Interfaces:**
- Consumes: Tasks 1–6 green local verification commands
- Produces: CI commands that run the same green gates without exceptions; zero npm audit vulnerabilities

- [ ] Add/adjust workflow assertions so a fixture containing `continue-on-error: true` or the Storybook type-error allowlist fails.
- [ ] Upgrade Vitest and compatible packages to a non-vulnerable version, keeping test behavior stable.
- [ ] Replace component-specific diagnostic workflows with a release-wide blocking sequence: install, typecheck, full tests, application build, Storybook tests/build, production audit, full audit.
- [ ] Run typecheck, full tests, application build, `npm run test-storybook`, `npm run build-storybook`, `npm audit --omit=dev`, and `npm audit`; require all to exit zero.
- [ ] Commit CI/security hardening.

### Task 8: Final whole-release verification

**Files:**
- Test-only changes are allowed only for defects found by final verification and must receive their own red-green evidence.

**Interfaces:**
- Consumes: Tasks 1–7
- Produces: reviewed release-ready branch with exact command/output evidence

- [ ] Verify exact 38-way parity across implementations, stories, contract manifest/index/provenance, knowledge, and release 002.
- [ ] Run the complete release command matrix on Node 22.18.0 from a clean install.
- [ ] Dispatch a whole-branch review against this plan and resolve every Critical/Important finding through the normal fix/re-review loop.
- [ ] Record final commit, counts, audit result, and any deferred minor findings.
