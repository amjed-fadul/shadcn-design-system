# Storybook Contract Verification Design

**Status:** Implemented
**Date:** 2026-09-03  
**Repository:** `amjed-fadul/shadcn-design-system`

## Purpose

Add Storybook as the human-facing visual and interaction verification surface for the contracted shadcn design system.

Storybook must not become a second source of truth for component facts. The existing component implementation and factual contracts remain authoritative:

- `src/components/ui/*` = real component implementation
- `contracts/components/*` = factual governed contract used by agents/validators
- Storybook = human visual/runtime evidence for those same components

The goal is to make it easy to inspect what a contracted component actually renders and how its meaningful states and interactions behave, while preserving the existing contract architecture.

## Current Context

The repository is a React 18 + Vite 7 + TypeScript design-system package with Tailwind CSS, Vitest, and 19 approved component families. Components live under `src/components/ui`, while factual contracts and validators live separately under `contracts` and `src/contracts`.

At the time of this design, Storybook was not installed.

The current stack is compatible with Storybook's React/Vite framework. Storybook's current React/Vite documentation requires React >=16.8 and Vite >=5. The repository uses React 18.3.1 and Vite 7.3.6. Storybook's Vitest integration requires a Vite-based Storybook and Vitest >=3; the repository uses Vitest 3.2.7.

**Implementation note:** Vitest 3 uses `@vitest/browser@3.2.7` with Playwright and Chromium. Ordinary unit tests are capped at `maxWorkers=1` because Storybook dependency overhead exposed parallel 5-second timeout flakiness under Node `22.18.0`. GitHub Ubuntu CI installs Chromium with `--with-deps`; PR #7 Ubuntu Baseline verification passed.

## Core Decision

Storybook is an independent verification surface, not a contract-generation system.

A story must import the real component from `src/components/ui`. It must not reimplement a component or define an alternate wrapper that changes the public behavior being verified.

The factual component contracts remain the authority for what an agent is allowed to use. Storybook stories provide human-readable evidence that those contract facts correspond to real renderable behavior.

## Architecture

```text
                         +--------------------------+
                         | src/components/ui/*      |
                         | real component code      |
                         +------------+-------------+
                                      |
                    +-----------------+-----------------+
                    |                                   |
                    v                                   v
       +---------------------------+       +---------------------------+
       | contracts/components/*    |       | Storybook stories         |
       | governed factual contract |       | visual/runtime evidence   |
       +-------------+-------------+       +-------------+-------------+
                     |                                   |
                     v                                   v
       +---------------------------+       +---------------------------+
       | Agent / Canvas validator  |       | Human inspection + tests  |
       +---------------------------+       +---------------------------+
```

No Storybook story is consumed by the Canvas validator. No contract is generated from Storybook in V1.

## Storybook Foundation

Use the React + Vite Storybook framework and keep it aligned with the repository's existing Vite, TypeScript, Tailwind, font, and path-alias setup.

Storybook preview rendering must load the same global stylesheet used by the existing app (`src/index.css`) so components render with the real design-system tokens, Tailwind configuration, and font setup.

Add only the minimum scripts needed for local use, static build verification, and component-story tests:

- `storybook`
- `build-storybook`
- one explicit Storybook test command once the Vitest integration is configured

Storybook configuration should live under `.storybook/` and story files should live near the component evidence they represent, using a predictable `*.stories.tsx` naming scheme.

## Story Coverage Strategy

Do not create all 19 stories in one undifferentiated batch. Establish the pattern using Button first, verify the architecture, then cover the remaining contracted families.

### First proof: Button

Button is the acceptance component for the Storybook architecture because it has meaningful variants, sizes, disabled behavior, and icon composition while remaining small enough to review completely.

The Button stories should cover only factual, supported behavior from the real component and its approved contract. The exact story matrix should be derived from the implementation plus `contracts/components/families/button.json`, not invented from generic shadcn documentation.

The Button gate passes only when:

1. Storybook renders the real Button component with repository styles.
2. The production Storybook build succeeds.
3. The story matrix does not advertise unsupported contract facts.
4. Existing Button/component-contract verification still passes.
5. Storybook component tests can exercise the Button story in a real browser environment.

### Remaining contracted families

After the Button gate passes, add story coverage for the currently approved component families:

- Accordion
- Badge
- Button
- Card
- Checkbox
- Dialog
- Dropdown Menu
- Input
- Label
- Scroll Area
- Select
- Separator
- Sheet
- Skeleton
- Sidebar
- Table
- Tabs
- Textarea
- Tooltip

Each family should receive only the stories necessary to expose meaningful public variants, states, composition, and interactions. Avoid exhaustive permutations that add maintenance without increasing confidence.

## Contract Relationship

Storybook and contracts must stay deliberately independent enough to catch drift.

Do not auto-generate stories from contract JSON in V1. If both the contract and story were produced from the same generator, one incorrect assumption could make both agree while the real component behaves differently.

Instead:

- story author reads the real implementation;
- story author cross-checks the approved family contract;
- tests verify the story renders and interactions work;
- existing contract invariant/schema/runtime-evidence tests continue to verify the governance side.

This gives three separate signals: implementation, contract, and visual/runtime evidence.

## Interaction Testing

Use Storybook's Vitest integration for browser-based component-story testing because the repository already uses Vitest and the current Storybook integration supports Vitest >=3 with Vite-based frameworks.

Interaction tests should be added only where interaction is part of the component's public behavior. Examples include:

- Accordion opens/closes an item.
- Checkbox toggles.
- Dialog opens and closes.
- Dropdown Menu opens and exposes items.
- Select opens and selects an option.
- Sheet opens and closes.
- Tabs changes the active content.
- Tooltip appears from the supported trigger interaction.

Static presentation components such as Separator or Skeleton need render evidence but do not need artificial interaction tests.

Storybook tests are additive. They do not replace the existing Vitest contract suites.

## Visual Testing Scope

V1 does not add Chromatic, hosted Storybook, screenshot baselines, or image-diff CI.

Those can be considered later if the team needs automated visual regression. For this phase, the goal is local human inspection, deterministic static build verification, and browser interaction testing.

## Documentation Scope

Use Storybook's normal component/story metadata and controls only where they expose real supported props cleanly.

Do not attempt to recreate Design System Studio usage guidance, changelog, approval workflow, or governance status inside Storybook.

Storybook may identify component/story names and supported controls, but approved contract data and future Studio guidance remain authoritative elsewhere.

## CI / Verification

The implementation should add Storybook-specific verification without weakening existing gates.

At minimum, the final repository must prove:

1. `npm run typecheck` passes.
2. Existing `npm test` / focused contract verification remains green.
3. Storybook static build succeeds from a clean install.
4. Storybook/Vitest component-story tests succeed in the configured browser mode.
5. `git diff --check` passes.

A failing Storybook build or Storybook component test must fail the relevant CI verification command rather than being treated as optional output.

## Package Version Policy

Use the current stable Storybook 10 release line at implementation time and keep all Storybook packages on the same compatible release line. Do not use alpha/beta/canary Storybook packages.

The generated lockfile is the exact dependency record. If the Storybook CLI proposes unrelated dependency migrations or changes to existing component source files, reject those changes unless they are strictly necessary and separately justified.

## File Boundaries

Expected new/modified areas:

- `.storybook/main.ts` — Storybook framework, story discovery, addons.
- `.storybook/preview.ts` — global design-system stylesheet and preview configuration.
- `.storybook/vitest.setup.ts` — only if required by the chosen Storybook/Vitest setup.
- Story files associated with `src/components/ui/*`.
- Vitest workspace/config only as needed to isolate Storybook browser tests from the repository's existing jsdom/unit suites.
- `package.json` and `package-lock.json` for exact dependencies/scripts.
- CI workflow only if the repository already has a suitable verification workflow to extend.

Do not modify component public APIs simply to make Storybook easier to author.

## Error and Drift Handling

If a story cannot represent a state claimed by the contract, treat that as a potential contract/implementation discrepancy. Do not patch the component or contract silently while adding Storybook.

The implementation task should stop that family, record the discrepancy, and resolve it explicitly through the existing contract workflow before advertising the state in Storybook.

Likewise, if a component requires hidden application context that prevents isolated rendering, add the smallest factual decorator/provider needed to reproduce its real runtime dependency. Do not introduce fake production behavior.

## Out of Scope

- Auto-generating stories from contracts.
- Generating contracts from stories.
- Replacing existing contract runtime-evidence tests.
- Replacing Design System Studio.
- Chromatic or hosted Storybook.
- Screenshot/image-diff regression testing.
- Building new design-system components.
- Refactoring existing component APIs solely for Storybook.
- Adding usage-writing or approval workflows to Storybook.

## Success Criteria

Storybook is successful when a designer or developer can run one command, browse the contracted shadcn components in isolation with real repository styling, exercise meaningful states/interactions, and trust that the stories are showing the same real components governed by the contracts.

The strongest success signal is not the existence of Storybook itself. It is that Button first, and then all approved families, have a consistent three-way relationship:

```text
real implementation <-> approved factual contract <-> Storybook runtime evidence
```

with independent verification capable of exposing drift between them.
