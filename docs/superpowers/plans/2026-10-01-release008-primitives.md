# Release 008 primitives implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development task by task. User authorizes continuous execution and prohibits commits, pushes, merges and publishing.

**Goal:** Govern generic Icon and Image composition, strengthen Toggle Group selection, and resolve first-class Link support for the next release.

**Architecture:** Extend the existing canonical component, contract, knowledge and Storybook authorities. Keep the active release isolated from frozen Release 007; use existing Lucide and semantic tokens. Execute capabilities serially with fresh review after each, then independently review the integrated candidate.

**Tech Stack:** React 18, strict TypeScript, pinned Lucide/Radix, Tailwind semantic tokens, Vitest/Storybook/Playwright.

**Spec:** User request supplied in /Users/amjedfadul/.codex/attachments/ec83c183-befa-4003-9a5f-52e65c515953/Pasted text.txt.

## Global constraints

- Release 007 and its distribution records remain byte-for-byte unchanged.
- No dependency additions; no arbitrary CSS/SVG API on new primitives.
- No commits, pushes, merges, publishing or deployment.
- Preserve accessibility, light/dark themes, logical RTL direction, package identity and strict canonical audits.
- Work one capability at a time; independent investigation and release safety setup may run in parallel.
- Sol leads APIs/reviews; Luna handles mechanical setup/docs/tests. Requested Terra is unavailable in the agent tools.

## Review focus

- Decorative content must not add names; meaningful Icon/Image content must retain an accessible naming path.
- Invalid/empty names and destinations must not produce silent inaccessible or actionable content.
- Logical direction follows nested RTL; physical imagery and direction do not flip unexpectedly.
- Selected Toggle Group colors persist under hover and keyboard focus, with disabled semantics preserved.
- Active release generation/test fixtures must never rewrite historical artifacts.

## Task 1: Icon

- [x] Inspect existing imports, spacing tokens, contracts and accessibility.
- [x] Add bounded Lucide identity API, token sizes and explicit decorative/meaningful naming, logical direction policy.
- [x] Add source/export, truthful repo-native provenance, contracts/knowledge, inventories and stories.
- [x] Observe focused runtime/type tests fail, implement, verify tests/typecheck/Storybook.
- [x] Fresh Sol review; fix real Critical/Important findings before Task 2.

## Task 2: Image

- [x] Inspect Avatar and native image/layout conventions.
- [x] Require src/alt; expose intrinsic dimensions and minimal governed contain/cover and intrinsic/container behavior.
- [x] Preserve native empty-alt decorative semantics; reserve intrinsic aspect; avoid Avatar fallbacks and arbitrary CSS.
- [x] Add source/export/contracts/knowledge/stories/inventory; focused semantic/layout tests and Storybook checks.
- [x] Fresh Sol review and fix findings before Task 3.

## Task 3: Toggle Group

- [x] Compare primary/primary-foreground to current muted selected background in both themes.
- [x] Apply pair to group selected items with selected hover persistence, keeping standalone Toggle scope unchanged where possible.
- [x] Add focused contrast/state regressions and single/multiple/light/dark/RTL stories.
- [x] Verify contracts/source evidence, browser states; fresh review and fix findings before Task 4.

## Task 4: Link

- [x] Record evidence: no standalone Link; existing Button link styling and nested description anchors duplicate treatments.
- [x] Decide whether DS should expose native anchors with governed focus and inline styling.
- [x] If justified implement minimal href/children native semantics, mailto/tel, optional explicit new tab; no disabled model or unsolicited indicator.
- [x] Record decision and add all authorities/tests/stories; fresh review and fix.

## Integration and release

- [x] Redirect active package/release bindings to 008, guard 001–007 before any generator runs.
- [x] Reconcile exact inventory and release-input graph; generate 008 only after all capabilities pass.
- [x] Run full unit/package/release verification once, typecheck and Storybook build/browser checks.
- [x] Generate and verify an external candidate with pinned Node 22.18.0/npm 10.9.3; inspect packed APIs/contracts.
- [x] Independently compare historical bytes to main; dispatch fresh integrated Sol review, fix and re-review semantic findings.
- [x] Save verification and concise final report including any deferred scope.

User follow-up: Icon semantic color and self-contained consumer declarations were added, focused/browser verified and freshly reviewed before release generation. Integrated final review is Clean; completion evidence is in docs/RELEASE-008-VERIFICATION.md.
