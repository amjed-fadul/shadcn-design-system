# Phase 4 Task 1 — Knowledge Architecture + Vertical Slice

**Starting main:** `ba7578c7bbc04bf7a9449462707d98657f708cbf`

## Goal

Add a design-system-neutral knowledge layer that answers what a component or pattern is for, when to use it, how to use it, and what content guidance is supported. Phase 3 remains the factual/legal API boundary; Phase 4 stores advisory knowledge only.

## Scope

This task adds knowledge for exactly three components and one multi-component pattern:

- `subject: { kind: "component", id: "button" }`
- `subject: { kind: "component", id: "dialog" }`
- `subject: { kind: "component", id: "select" }`
- `subject: { kind: "pattern", id: "dialog-with-actions" }`

No other component knowledge is added. No component implementation or Phase 3 contract artifact is changed.

## Boundary

```text
Phase 3 factual contracts
contracts/components/
src/contracts/components/

Phase 4 usage knowledge
contracts/knowledge/
src/contracts/knowledge/
```

`src/contracts/knowledge/` does not import from `src/contracts/components/`. Knowledge subjects and pattern roles are typed opaque references; they do not copy factual props, variants, tokens, or composition constraints.

## Knowledge schema

Every artifact has `schemaVersion`, `id`, a typed `subject`, `guidanceStatus`, and optional advisory topics:

```ts
type KnowledgeSubject = {
  kind: "component" | "pattern"
  id: string
}

type GuidanceClaim = {
  statement: string
  basis:
    | { kind: "source-derived"; referenceIds: string[] }
    | { kind: "ds-owner-authored"; authoredBy: string; revision: string; date: string }
}

type GuidanceStatus = Partial<Record<
  | "purpose"
  | "whatItIs"
  | "whenToUse"
  | "whenNotToUse"
  | "howToUse"
  | "options"
  | "writing"
  | "useInstead"
  | "related",
  "available" | "unresolved"
>>
```

An unresolved topic is represented only by `guidanceStatus`. It is never a `GuidanceClaim` and cannot be consumed as advice. An omitted topic means no guidance was supplied.

Component relations use typed subjects and an advisory reason claim:

```ts
type RelatedGuidance = {
  target: KnowledgeSubject
  guidance: GuidanceClaim
}
```

Patterns add only a purpose claim and descriptive roles:

```ts
type PatternRole = {
  subject: KnowledgeSubject
  role: string
  guidance?: GuidanceClaim
}
```

The knowledge schemas have no fields named `props`, `tokens`, `composition`, `hardConstraints`, `requiredChildren`, or equivalent legal API declarations.

## Evidence model

Source-derived claims reference IDs in `contracts/knowledge/references.json`. A reference record contains:

- stable `id`;
- `kind`;
- title;
- locator URL or repository path;
- locator hint such as a page heading;
- access date for external sources;
- optional source revision and content hash.

Repository/source-controlled references require both `sourceRevision` and `contentHash`. External standards and documentation use locator, locator hint, and access date when no immutable revision is available.

DS-owner-authored claims require `authoredBy`, `revision`, and `date`. This task uses source-derived production claims only. Tests exercise the owner-authored branch with an in-memory fixture.

The loader rejects unknown reference IDs and malformed source-reference identity. It does not fetch URLs or enforce claim truth; the registry makes the evidence independently findable and the source basis explicit.

## Runtime

The generic runtime exposes:

```ts
createKnowledgeLoader(options): () => LoadedKnowledge
createKnowledgeQuery(load): KnowledgeQuery
loadKnowledge()
listComponentKnowledge()
getComponentKnowledge(subjectId)
listPatternKnowledge()
getPatternKnowledge(patternId)
```

The query has independent component and pattern indexes and distinct not-found errors. Loaded data is deeply frozen.

## Vertical-slice guidance

### Button

Use source-derived guidance for button activation semantics, navigation-vs-action distinction, documented sizing, link treatment through the helper, stable toggle labels, and the component description. Do not claim unsupported semantic meanings for visual variants.

### Dialog

Use source-derived guidance for an overlaid/inert dialog, the documented trigger/content/header/title/description/footer anatomy, title and description semantics, visible close controls, and the documented close-button option. Leave unsupported “when not to use” guidance unresolved.

### Select

Use source-derived guidance for choosing from a list triggered by a button, the documented trigger/value/content anatomy, groups/labels/separators, keyboard/focus behavior, custom placeholders, and accessible labelling. Leave unsupported alternatives unresolved.

### Pattern: `dialog-with-actions`

This pattern is supported by the official shadcn Dialog composition and examples that show Dialog + Button usage. It records a dialog surface, a trigger/action control, and footer action roles. Roles are descriptive intent only; the pattern does not require a child, prop, token, or composition shape.

## Tests

Tests cover:

1. Phase 3 files remain byte-for-byte unchanged from the starting main commit.
2. Knowledge loads from an artifact source with no Phase 3 artifacts.
3. Missing topics are legal; explicit unresolved status is not a claim.
4. Unknown evidence references fail closed.
5. Owner-authored claims require author metadata.
6. Forbidden API-shaped fields fail schema validation.
7. Component and pattern indexes query independently.
8. The canonical four-artifact slice loads with source-derived references.

## Non-goals

- adding the remaining 16 component families;
- changing Phase 3 factual contracts or contract runtime;
- fetching or validating live web content;
- enforcing guidance as JSX/API rules;
- adding Phase 5 executable validation;
- committing, pushing, merging, or releasing.
