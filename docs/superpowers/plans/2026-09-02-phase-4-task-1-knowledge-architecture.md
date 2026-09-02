# Phase 4 Task 1 Knowledge Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, advisory knowledge layer with independently queryable Button, Dialog, Select, and Dialog-with-actions guidance while preserving the Phase 3 baseline.

**Architecture:** Static JSON artifacts under `contracts/knowledge/` are validated and deep-frozen by a generic loader in `src/contracts/knowledge/`. A separate query indexes components and patterns independently. Claims have one explicit provenance basis; unresolved topics are statuses, never claims.

**Tech Stack:** TypeScript 5.5.4, JSON Schema 2020-12, Ajv 8.20.0, Vitest 3.2.7, Node 22.18.0.

**Spec:** `docs/superpowers/specs/2026-09-02-phase-4-task-1-knowledge-architecture-design.md`

## Global Constraints

- Start from main commit `ba7578c7bbc04bf7a9449462707d98657f708cbf`.
- Keep `contracts/components/` and `src/contracts/components/` unchanged.
- Add exactly three component knowledge subjects: `button`, `dialog`, and `select`.
- Add exactly one pattern knowledge subject: `dialog-with-actions`.
- Every guidance claim has exactly one basis: `source-derived` or `ds-owner-authored`.
- `unresolved` is a status only and never a guidance claim.
- Source-derived claims use IDs resolved through a reference registry.
- Repository/source-controlled references require `sourceRevision` and `contentHash`.
- Knowledge must not encode legal props, tokens, composition, hard constraints, or required children.
- Do not add dependencies.
- Do not commit, push, merge, or release.

---

### Task 1: Establish failing boundary and schema tests

**Files:**
- Create: `tests/knowledge-contracts.test.ts`

**Interfaces:**
- Tests target `createKnowledgeLoader`, `createKnowledgeQuery`, and the canonical knowledge entrypoints implemented by later tasks.

- [ ] **Step 1: Write the failing tests**

Add tests asserting that a fixture containing only knowledge artifacts loads, missing topics are allowed, an unresolved status has no claim, unknown reference IDs fail closed, API-shaped fields fail schema validation, owner-authored claims require metadata, and component/pattern queries use independent indexes.

The core assertions are:

```ts
expect(loaded.components).toHaveLength(1)
expect(loaded.components[0].whenNotToUse).toBeUndefined()
expect(loaded.components[0].guidanceStatus.whenNotToUse).toBe("unresolved")
expect(() => loadWithUnknownReference()).toThrow("KNOWLEDGE_REFERENCE_NOT_FOUND")
expect(() => loadWithExtraField("tokens")).toThrow("KNOWLEDGE_SCHEMA_INVALID")
expect(query.getComponentKnowledge("button").subject.kind).toBe("component")
expect(query.getPatternKnowledge("dialog-with-actions").subject.kind).toBe("pattern")
expect(() => query.getComponentKnowledge("dialog-with-actions")).toThrow("COMPONENT_KNOWLEDGE_NOT_FOUND")
expect(() => query.getPatternKnowledge("button")).toThrow("PATTERN_KNOWLEDGE_NOT_FOUND")
```

Use real in-memory JSON objects consumed by the loader, not mocks of loader behavior.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- tests/knowledge-contracts.test.ts
```

Expected: FAIL because the knowledge runtime and schemas do not exist yet.

- [ ] **Step 3: Keep the failure focused**

If an import path is missing, add only the smallest type/import placeholder needed to reach the intended missing-behavior failure. Do not add production behavior before the failing behavior is observable.

---

### Task 2: Implement generic schema, types, loader, and query

**Files:**
- Create: `contracts/knowledge/knowledge-set.schema.json`
- Create: `contracts/knowledge/knowledge-reference-set.schema.json`
- Create: `contracts/knowledge/component-knowledge.schema.json`
- Create: `contracts/knowledge/pattern-knowledge.schema.json`
- Create: `src/contracts/knowledge/types.ts`
- Create: `src/contracts/knowledge/loader.ts`
- Create: `src/contracts/knowledge/query.ts`
- Create: `src/contracts/knowledge/index.ts`

**Interfaces:**
- `createKnowledgeLoader(options: KnowledgeLoaderOptions): () => LoadedKnowledge`
- `createKnowledgeQuery(load: () => LoadedKnowledge): KnowledgeQuery`
- `GuidanceClaim.basis` is the only claim provenance field.
- `KnowledgeSubject` is `{ kind: "component" | "pattern"; id: string }`.

- [ ] **Step 1: Implement the discriminated TypeScript types**

Define:

```ts
export type KnowledgeSubject = { kind: "component" | "pattern"; id: string }
export type GuidanceStatus = "available" | "unresolved"
export type GuidanceTopic = "purpose" | "whatItIs" | "whenToUse" | "whenNotToUse" | "howToUse" | "options" | "writing" | "useInstead" | "related"
export type GuidanceClaim = {
  statement: string
  basis:
    | { kind: "source-derived"; referenceIds: string[] }
    | { kind: "ds-owner-authored"; authoredBy: string; revision: string; date: string }
}
export type RelatedGuidance = { target: KnowledgeSubject; guidance: GuidanceClaim }
export type PatternRole = { subject: KnowledgeSubject; role: string; guidance?: GuidanceClaim }
export type KnowledgeArtifact = {
  schemaVersion: 1
  id: string
  subject: KnowledgeSubject
  guidanceStatus: Partial<Record<GuidanceTopic, GuidanceStatus>>
  purpose?: GuidanceClaim
  whatItIs?: GuidanceClaim
  whenToUse?: GuidanceClaim[]
  whenNotToUse?: GuidanceClaim[]
  howToUse?: GuidanceClaim[]
  options?: GuidanceClaim[]
  writing?: GuidanceClaim[]
  useInstead?: RelatedGuidance[]
  related?: RelatedGuidance[]
  roles?: PatternRole[]
}
```

Represent references with `id`, `kind`, `title`, `locator`, `locatorHint`, `accessedOn`, and optional `sourceRevision`/`contentHash`.

- [ ] **Step 2: Add JSON schemas with closed object shapes**

Use JSON Schema 2020-12 and `additionalProperties: false` throughout. The claim basis is a two-branch `oneOf`: source-derived requires a non-empty `referenceIds` array, and DS-owner-authored requires `authoredBy`, `revision`, and `date`. Do not add an unresolved branch.

- [ ] **Step 3: Implement loader validation and reference resolution**

The loader reads the manifest, reference registry, component files, and pattern files; validates each document; checks unique IDs, file-kind alignment, source-reference identity, and every source-derived reference ID; then deep-freezes:

```ts
return deepFreeze({ set, references, components, patterns })
```

It must not import any Phase 3 loader, query, type, schema, or artifact. Empty guidance and omitted topics are valid.

- [ ] **Step 4: Implement independent query indexes**

Build a component map keyed by component subject ID and a pattern map keyed by pattern subject ID. Expose:

```ts
export type KnowledgeQuery = Readonly<{
  listComponentKnowledge(): readonly DeepReadonly<ComponentKnowledge>[]
  getComponentKnowledge(subjectId: string): DeepReadonly<ComponentKnowledge>
  listPatternKnowledge(): readonly DeepReadonly<PatternKnowledge>[]
  getPatternKnowledge(patternId: string): DeepReadonly<PatternKnowledge>
}>
```

Throw distinct `COMPONENT_KNOWLEDGE_NOT_FOUND` and `PATTERN_KNOWLEDGE_NOT_FOUND` errors. Sort lists by subject ID and return frozen arrays.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run:

```bash
npm test -- tests/knowledge-contracts.test.ts
```

Expected: PASS for generic fixture coverage.

---

### Task 3: Add canonical registry and vertical-slice artifacts

**Files:**
- Create: `contracts/knowledge/knowledge-set.json`
- Create: `contracts/knowledge/references.json`
- Create: `contracts/knowledge/components/button.json`
- Create: `contracts/knowledge/components/dialog.json`
- Create: `contracts/knowledge/components/select.json`
- Create: `contracts/knowledge/patterns/dialog-with-actions.json`
- Create: `src/contracts/knowledge/canonical-loader.ts`
- Create: `src/contracts/knowledge/canonical-query.ts`
- Modify: `src/contracts/knowledge/index.ts`

- [ ] **Step 1: Add immutable reference records**

Create official documentation/standard records for the shadcn Button, Dialog, and Select pages, Radix Dialog and Select pages, and WAI-ARIA Button, Dialog, and Combobox patterns. Add canonical-source records for Button, Dialog, and Select with source revision `ba7578c7bbc04bf7a9449462707d98657f708cbf` and the corresponding checked-in source blob SHA from `provenance/seed-components.json`.

- [ ] **Step 2: Add the manifest and four artifacts**

List exactly three component files and one pattern file. Use typed subjects. Add only claims supported by the references. Omit unsupported topics or set their status to unresolved without adding a claim.

- [ ] **Step 3: Add canonical loader/query wiring**

Resolve the repository root from `import.meta.url`, read only `contracts/knowledge/*`, and construct the generic loader/query. The canonical module must not import `src/contracts/components/*`.

- [ ] **Step 4: Extend tests for the canonical slice**

Assert exactly three component records and one pattern record, every production source-derived reference ID resolves, and the pattern exposes descriptive roles without legal constraint fields.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm test -- tests/knowledge-contracts.test.ts
```

Expected: PASS for canonical artifacts and generic fixtures.

---

### Task 4: Add Phase 3 immutability regression and boundary checks

**Files:**
- Modify: `tests/knowledge-contracts.test.ts`

- [ ] **Step 1: Add the baseline diff assertion**

Use:

```ts
execFileSync("git", ["diff", "--exit-code", "ba7578c7bbc04bf7a9449462707d98657f708cbf", "--", "contracts/components", "src/contracts/components", "provenance/component-contract-source.json"])
```

This assertion inspects only Phase 3 paths and does not compare knowledge files.

- [ ] **Step 2: Add the no-coupling fixture assertion**

Load the generic knowledge fixture through `createKnowledgeLoader` with no component contract files in its source map. This proves the runtime boundary by behavior rather than by grepping implementation text.

- [ ] **Step 3: Run the focused tests**

Run:

```bash
npm test -- tests/knowledge-contracts.test.ts
```

Expected: PASS with the Phase 3 path assertion showing no diff.

---

### Task 5: Verify the complete repository and hand off

**Files:**
- No additional production files.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: exit code 0 with zero failed tests.

- [ ] **Step 2: Run the typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Verify Phase 3 paths and scope**

Run:

```bash
git diff --exit-code ba7578c7bbc04bf7a9449462707d98657f708cbf -- contracts/components src/contracts/components provenance/component-contract-source.json
git status --short
```

Expected: the Phase 3 diff command exits 0; status lists only new Phase 4 spec/plan/runtime/schema/artifact/test files.

- [ ] **Step 4: Report without committing**

Report the schema, evidence model, created guidance, pattern rationale, tests/results, the non-blocking owner-authorship verification question, and explicitly state that no commit/push/merge occurred.
