# Executable Contract + Validator Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest design-system-neutral Phase 5 projection and validator proof over the approved Phase 2/3 factual contracts.

**Architecture:** Project loaded factual contracts into an immutable executable graph, then validate a neutral authored tree with exact identity, prop/value, conditional, state, Slot, capability, and token rules. Phase 4 knowledge is outside the dependency graph.

**Tech Stack:** TypeScript, Vitest, existing Phase 2/3 loaders and contract types.

**Spec:** `docs/superpowers/specs/2026-09-02-phase-5-task-1-executable-contract-validator-design.md`

## Global Constraints

- Start from `b215a4015021e0a501def2e13bd6835419699a94` on an isolated branch.
- Phase 2, Phase 3, and Phase 4 approved artifacts are read-only inputs.
- Do not implement the full 19-family validator.
- Phase 4 advisory knowledge cannot produce validation errors.
- Unsupported or unresolved factual constructs fail closed.
- Do not push, merge, or commit; leave all Task 1 changes uncommitted.

---

### Task 1: Define executable projection and neutral authored input

**Files:**
- Create: `src/validator/types.ts`
- Create: `src/validator/projection.ts`
- Test: `tests/executable-contract-projection.test.ts`

**Interfaces:**
- Consumes: `LoadedComponentContracts`, `TokenContract`, `StructuredPropType`, `resolveConditionalApiShape`.
- Produces: `projectExecutableContract(source): ExecutableContract`, immutable projected export facts, and neutral authored node/value types.

- [x] **Step 1: Write failing projection/type tests** for canonical Button, Accordion, and a fictional family.
- [x] **Step 2: Run `npx vitest run tests/executable-contract-projection.test.ts` and verify failure because the projection module is absent.**
- [x] **Step 3: Implement the immutable projection and neutral input types, including effective inherited props, conditional cases, capability/token sets, and explicit unresolved facts.**
- [x] **Step 4: Run the focused projection test and verify it passes.**

### Task 2: Define structured validation errors and implement the neutral validator

**Files:**
- Create: `src/validator/errors.ts`
- Create: `src/validator/validate.ts`
- Test: `tests/executable-contract-validator.test.ts`

**Interfaces:**
- Consumes: `ExecutableContract`, `AuthoredUi`, `AuthoredNode`, and `AuthoredValue` from Task 1.
- Produces: `validateAuthoredUi(input, contract): ValidationResult` with stable error codes and factual targets/expected/received data.

- [x] **Step 1: Write failing tests** for legal Button, unknown Button prop, invalid Button variant, Accordion branch mismatch, Dialog capability/Slot violations, Sidebar context, and invalid token.
- [x] **Step 2: Run the focused validator test and verify the expected missing-module failure.**
- [x] **Step 3: Implement deterministic depth-first validation: exact export resolution, authorability, props/value types, conditional cases, state conflicts, Slot cardinality, capabilities, tokens, and unresolved expressions.**
- [x] **Step 4: Run the focused validator test and verify all cases pass.**

### Task 3: Expose the Phase 5 boundary and prove design-system neutrality

**Files:**
- Create: `src/validator/index.ts`
- Modify: `tests/executable-contract-validator.test.ts`
- Create: `tests/fixtures/executable-neutral-contract.ts`

**Interfaces:**
- Consumes: canonical loader/token contract plus generic projection/validator APIs.
- Produces: one public Phase 5 import boundary with no Phase 4 dependency.

- [x] **Step 1: Add the fictional `ActionButton` contract fixture and failing assertions that its non-shadcn `tone` enum validates without special cases.**
- [x] **Step 2: Run the focused test and verify it fails before the fixture/public boundary exists.**
- [x] **Step 3: Add the public exports and neutral fixture wiring without changing existing contract artifacts.**
- [x] **Step 4: Run the focused proof and verify canonical plus fictional cases pass.**

### Task 4: Verify scope, type safety, and regression safety

**Files:**
- No source changes expected; inspect all Task 1 changes.

- [x] **Step 1: Run `npm run typecheck`.**
- [x] **Step 2: Run `npm test`.**
- [x] **Step 3: Run `npm run build`.**
- [x] **Step 4: Confirm `git diff --name-only b215a4015021e0a501def2e13bd6835419699a94` contains only new Phase 5 files/docs/tests and no Phase 2–4 artifact modifications.**
