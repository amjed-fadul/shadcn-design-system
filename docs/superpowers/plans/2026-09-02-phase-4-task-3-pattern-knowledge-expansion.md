# Phase 4 Task 3 Pattern Knowledge Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add only directly documented multi-component usage patterns to the existing Phase 4 knowledge set while preserving component knowledge, Phase 3 contracts, and the approved pattern schema.

**Architecture:** Keep patterns as static JSON artifacts under `contracts/knowledge/patterns/`, referenced by the existing knowledge manifest and loaded through the existing generic knowledge loader/query. Pattern roles use typed component subjects already present in the component knowledge set; claims remain advisory and source-derived, with no Phase 3 legality or API data.

**Tech Stack:** JSON Schema 2020-12, TypeScript, Vitest, npm, Vite.

**Spec:** `contracts/knowledge/pattern-knowledge.schema.json` plus the Phase 4 Task 3 request in the task thread.

## Global Constraints

- Do not modify Phase 3 contracts or the knowledge loader/query architecture.
- Do not add component guidance or start the next Phase 4 task.
- Add only patterns directly supported by official shadcn Radix documentation or already registered authoritative evidence.
- Every guidance claim has exactly one provenance basis; use `source-derived` with registered reference IDs for this task.
- Pattern roles describe intent only; do not add required children, hard composition, legal prop constraints, tokens, or Phase 3 facts.
- Leave unsupported topics absent or explicitly unresolved; do not invent guidance.
- Stop uncommitted; do not push or merge.

### Task 1: Lock the pattern expansion with regression tests

**Files:**
- Modify: `tests/knowledge-contracts.test.ts`

**Interfaces:**
- Consumes: existing `loadKnowledge`, `createKnowledgeQuery`, and canonical component knowledge.
- Produces: canonical assertions for the six supported patterns, typed role targets, advisory-only pattern fields, and unchanged component knowledge.

- [ ] **Step 1: Write the failing test**

Update the canonical pattern expectations to include:

```text
accordion-card
dialog-with-actions
table-with-row-actions
textarea-with-submit
tooltip-for-disabled-action
```

Add assertions that every canonical role target matches a loaded component or pattern subject, every canonical pattern omits API-shaped fields, and at least one unsupported topic remains absent or unresolved.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/knowledge-contracts.test.ts`

Expected: FAIL because the manifest still contains only `dialog-with-actions` and the new pattern artifacts do not exist.

### Task 2: Add the evidence-backed pattern artifacts

**Files:**
- Create: `contracts/knowledge/patterns/accordion-card.json`
- Create: `contracts/knowledge/patterns/table-with-row-actions.json`
- Create: `contracts/knowledge/patterns/textarea-with-submit.json`
- Create: `contracts/knowledge/patterns/tooltip-for-disabled-action.json`
- Modify: `contracts/knowledge/knowledge-set.json`
- Modify: `contracts/knowledge/patterns/dialog-with-actions.json` only if its evidence audit identifies a weak statement.

**Interfaces:**
- Consumes: registered `shadcn.*.docs` evidence records for the Radix documentation variant.
- Produces: four new pattern artifacts with typed roles for existing component subjects and source-derived claims only.

- [ ] **Step 1: Add the documented patterns**

Use these direct examples as the evidence boundary:

- Accordion wrapped in Card for grouped expandable content.
- Table using DropdownMenu for actions for each row.
- Textarea paired with Button for a submit action.
- Tooltip shown for a disabled Button by wrapping it with a span.

Include purpose, when-to-use, and how-to-use only where the cited page directly supports them. Omit unsupported when-not-to-use, writing, alternatives, and related topics.

- [ ] **Step 2: Add the four pattern paths to the manifest**

Keep `dialog-with-actions` and all 19 component paths. Do not add any new pattern source reference when an existing registered component reference directly supports the claim.

### Task 3: Verify the green slice and repository boundaries

**Files:**
- No additional source files.

- [ ] **Step 1: Run the focused knowledge tests**

Run: `npm test -- tests/knowledge-contracts.test.ts`

Expected: all knowledge contract and canonical pattern tests pass.

- [ ] **Step 2: Run the full verification set**

Run:

```bash
npx vitest run --testTimeout=60000
npm run typecheck
npm run build
git diff --check
git diff --exit-code ba7578c7bbc04bf7a9449462707d98657f708cbf -- contracts/components src/contracts/components provenance/component-contract-source.json
```

Expected: all tests pass, typecheck/build exit successfully, diff check is clean, and the Phase 3 baseline command reports no changes.

- [ ] **Step 3: Confirm the worktree is uncommitted**

Run: `git status --short --branch`

Expected: only the Task 3 plan, manifest, pattern artifacts, and knowledge tests are changed; no commit, push, or merge is performed.
