# Phase 3 — Component-Contract Scope

## Goal

Phase 3 creates design-system-neutral factual component contracts answering:

```text
What component APIs actually exist and what usage is factually legal?
```

It does not answer:

```text
Which component should the designer choose?
```

## Exact seed scope

Phase 3 freezes exactly 19 component families, derived from `provenance/seed-components.json`:

```text
accordion
badge
button
card
checkbox
dialog
dropdown-menu
input
label
scroll-area
select
separator
sheet
sidebar
skeleton
table
tabs
textarea
tooltip
```

No new components are added in Phase 3. Canonical component implementations must not be modified merely to simplify contracts.

## Architectural boundaries

- Design-system-neutral schema.
- Canonical source → pinned inherited source → runtime evidence → unresolved.
- Unresolved rather than guessed.
- Shared inherited-interface registry.
- Public exports classified as `component | hook | helper`.
- Only component exports are JSX-authorable.
- First-class Slot/`asChild` facts.
- Capability-based composition.
- State channels and conditional API cases.
- Token dependencies close only against approved Phase 2 tokens.
- Structural rendering/accessibility facts only.
- No Phase 4 usage guidance.
- No Phase 5 JSX enforcement.
- No Canvas/MCP integration.

A later private anti-prior design system will be used for product validation, but is not part of this Phase 3 production scope.
