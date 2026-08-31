# Phase 3 Task 4A Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make conditional component API facts explicit, deterministic, and safe for a later authoring validator without implementing component-family contracts.

**Architecture:** A conditional case identifies a selected discriminant value and supplies named refinements of already-known public props and events. A production resolver overlays exactly one matching case onto the base factual shape; invariant validation rejects ambiguous, invalid, or non-narrowing facts before consumers can resolve them.

**Tech Stack:** TypeScript, JSON Schema draft 2020-12, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-phase-3-component-factual-contracts-design.md`

## Global Constraints

- Work only on Phase 3 Task 4A; do not add Checkbox, Tabs, Accordion, Tooltip, or Scroll Area family contracts.
- Do not modify the nine existing family JSON files, component implementations, token contracts, provenance, or snapshots.
- Do not commit, push, or merge.
- Use Node 22.18.0 and npm 10.9.3 for final verification.

---

### Task 1: Prove conditional API failures in production invariants

**Files:**
- Test: `tests/component-contract-model-extension.test.ts`
- Test: `tests/component-contract-invariants.test.ts`

- [ ] Add a literal broad-base fixture for `type`, `value`, `defaultValue`, `onValueChange`, and single-only `collapsible`.
- [ ] Add focused failures for invalid discriminants, duplicate cases, unknown prop/event targets, non-narrowing refinements, invalid role targets, and incompatible controlled/default types.
- [ ] Run the focused test file and confirm it fails because the current production API lacks explicit refinement semantics.

### Task 2: Add the generic factual representation and invariants

**Files:**
- Modify: `src/contracts/components/types.ts`
- Modify: `contracts/components/component-family.schema.json`
- Modify: `src/contracts/components/invariants.ts`

- [ ] Define branch prop refinements with target name, structured type, availability, and requiredness.
- [ ] Define event refinements with target name and structured payload.
- [ ] Align JSON Schema and TypeScript union cardinality and state-channel role presence.
- [ ] Validate discriminator type compatibility, unique cases, refinement targets/narrowing, state-channel role kinds, and branch-effective compatibility.
- [ ] Export the small `contract + selected discriminator -> effective factual API shape` resolver; it must not validate user-authored runtime props.
- [ ] Run focused tests and confirm they pass.

### Task 3: Preserve scope and verify

**Files:**
- Test: existing component-contract suite

- [ ] Compare all nine existing family JSON blobs with `HEAD` and stop if any differ.
- [ ] Run focused, component-contract, full, token, snapshot, typecheck, build, dependency-audit, and whitespace checks using Node 22.18.0.
- [ ] Investigate the named full-suite timeout only if it reproduces; do not hide it through timeout or runner changes.
