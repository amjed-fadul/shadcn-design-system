# Phase 4 Task 2: Component Knowledge Expansion

## Goal

Expand the existing static JSON knowledge set from the Button, Dialog, and Select vertical slice to all 19 Phase 3 component family subjects without changing the approved Phase 4 schema, loader, query API, or any Phase 3 factual contract.

## Scope

Add component knowledge artifacts for exactly these 16 subjects:

- accordion
- badge
- card
- checkbox
- dropdown-menu
- input
- label
- scroll-area
- separator
- sheet
- sidebar
- skeleton
- table
- tabs
- textarea
- tooltip

Do not add or change pattern knowledge. Keep the existing `dialog-with-actions` pattern unchanged.

## Evidence policy

Use registered first-party references only. Each claim has exactly one `source-derived` or `ds-owner-authored` basis. This task uses source-derived claims only, backed by official shadcn or Radix documentation and, where needed, WAI-ARIA/APG guidance. A topic is omitted or marked unresolved when its evidence is not direct enough. No claim may copy Phase 3 props, tokens, legal composition, hard constraints, or required-child facts.

## Implementation steps

1. Add regression tests for the complete 19-subject component query, preservation of the existing three artifacts, unsupported-topic handling, API-shaped-field rejection, unknown-reference rejection, and Phase 3 baseline immutability.
2. Run the focused knowledge suite and confirm the new expectations fail because the 16 artifacts are absent.
3. Register each official reference once and add one JSON artifact per remaining component family, using only directly supported topics.
4. Expand the knowledge manifest with the 16 component paths; leave its pattern list unchanged.
5. Run the focused knowledge suite, full suite, typecheck, build, and `git diff --check`.
6. Audit the final claims and reference IDs, confirm no Phase 3 paths changed, and leave all work uncommitted for review.

## Acceptance checks

- All 19 component subjects can be listed and queried independently from patterns.
- Existing Button, Dialog, and Select artifacts retain their guidance and statuses.
- Missing or unresolved guidance is valid and carries no claim.
- Every source-derived reference ID is registered; source-controlled references retain revision and hash.
- No knowledge artifact contains Phase 3 API-shaped fields or hard legality language.
- No pattern artifact is added or expanded.
- Phase 3 factual contracts remain byte-for-byte unchanged from `ba7578c4928635000c14e2f71bd41325e526a5d5`.
