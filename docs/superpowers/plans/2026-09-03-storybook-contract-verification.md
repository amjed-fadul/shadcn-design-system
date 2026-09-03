# Storybook Contract Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lean Storybook 10 visual/runtime verification surface for all 19 approved shadcn component families without making Storybook a second contract source.

**Architecture:** Storybook imports the real `src/components/ui/*` components and the real `src/index.css`; factual contracts remain authoritative for governance. Storybook's Vitest integration runs stories in Chromium for render and interaction evidence, while the existing contract tests remain separate and unchanged in purpose.

**Tech Stack:** React 18.3.1, Vite 7.3.6, TypeScript 5.5.4, Vitest 3.2.7, Storybook 10.5.10 React/Vite, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-03-storybook-contract-verification-design.md`

## Global Constraints

- Implement tasks sequentially. Stop after each task for independent review before beginning the next task.
- Use an isolated worktree/feature branch based on the commit containing this plan.
- Do not modify factual contract JSON, validator behavior, token contracts, component public APIs, or Phase 4 knowledge to make Storybook easier.
- Every story imports the real component from `src/components/ui/*`; do not copy or reimplement components inside stories.
- Storybook is visual/runtime evidence only. Do not generate contracts from stories or stories from contracts.
- Use exact stable Storybook `10.5.10` packages for this plan. Keep all Storybook-owned packages on that compatible release line; no prereleases.
- Preserve Node `22.18.0`, React `18.3.1`, Vite `7.3.6`, Vitest `3.2.7`, and the current application build.
- Reuse `vite.config.ts` and `src/index.css`; add Storybook-specific Vite overrides only if a demonstrated failure requires them.
- Do not add Chromatic, hosted Storybook, screenshot diffing, MDX documentation, Design System Studio guidance, or unrelated addons.
- If a component implementation and approved contract disagree, stop that family and report the discrepancy; do not silently repair either side within this work.
- Task 1 must be left uncommitted for review. Later commit boundaries are decided only after each review gate.

---

### Task 1: Prove Storybook end-to-end with Button only

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `tsconfig.json`
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.ts`
- Create: `.storybook/vitest.setup.ts`
- Create: `vitest.config.ts`
- Create: `src/components/ui/button.stories.tsx`
- Test/read-only inputs: `src/components/ui/button.tsx`, `contracts/components/families/button.json`, existing `tests/component-contract-button.test.ts`, existing `tests/component-contract-runtime-evidence.test.tsx`

**Interfaces:**
- Consumes: real Button implementation, Button factual contract, root Vite config, global CSS.
- Produces: `npm run storybook`, `npm run build-storybook`, `npm run test-storybook`, one Button story module, and an isolated Storybook Vitest project named `storybook`.

- [ ] **Step 1: Record the baseline before changing dependencies.**

Run:

```bash
node --version
npm ci --ignore-scripts
npm run typecheck
npm run test
npm run build
git status --short
git rev-parse HEAD
```

Expected: Node `v22.18.0`; existing typecheck/tests/build pass; working tree is clean.

- [ ] **Step 2: Install only the approved Storybook/browser-test dependencies with exact versions.**

Use exact versions:

```bash
npm install --save-dev --save-exact \
  storybook@10.5.10 \
  @storybook/react-vite@10.5.10 \
  @storybook/addon-vitest@10.5.10 \
  @vitest/browser@3.2.7 \
  playwright@1.58.2
```

Do not run `npm create storybook` or an initializer that rewrites existing app files. Inspect the resulting dependency diff before continuing.

Add scripts:

```json
{
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build",
  "test-storybook": "vitest run --project=storybook"
}
```

Keep all existing scripts unless the Storybook Vitest project demonstrably requires an explicit `--project` for the existing unit suite. If that is required, stop and report it rather than broadening Task 1 automatically.

- [ ] **Step 3: Add the minimal Storybook configuration.**

`.storybook/main.ts` must use `@storybook/react-vite`, discover only `../src/**/*.stories.@(ts|tsx)`, and register only `@storybook/addon-vitest`.

Target shape:

```ts
import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
}

export default config
```

Do not add `viteFinal` unless the first build proves the existing root Vite config is not being merged correctly.

`.storybook/preview.ts` must import the real stylesheet:

```ts
import type { Preview } from "@storybook/react-vite"
import "../src/index.css"

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
    },
  },
}

export default preview
```

- [ ] **Step 4: Isolate Storybook browser tests without changing the meaning of existing tests.**

Create `vitest.config.ts` by merging the existing `vite.config.ts`. Define a `storybook` project using `storybookTest({ configDir: path.join(dirname, ".storybook") })`, `@vitest/browser` with the Playwright provider, headless Chromium, and `.storybook/vitest.setup.ts`.

The setup file must apply preview annotations through `setProjectAnnotations` from `@storybook/react-vite`.

The critical regression requirement is: plain `npm run test` must continue to run the existing repository tests successfully. If adding a Vitest project causes `npm run test` to execute Storybook unexpectedly or changes existing suite semantics, do not paper over it; implement the smallest explicit unit-project separation and report the exact script changes.

- [ ] **Step 5: Write the Button story matrix from the real implementation and approved contract.**

`src/components/ui/button.stories.tsx` must import `Button` from `@/components/ui/button` and cover exactly the factual local API:

```text
variant: default | outline | secondary | ghost | destructive | link
size: default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg
asChild: false | true
```

Required stories:

```text
Playground
Variants
Sizes
Disabled
AsChild
```

Requirements:

- `Playground` exposes controls for `variant`, `size`, `disabled`, and `asChild` only where the Storybook control can represent the real prop honestly.
- `Variants` renders all six contract variants.
- `Sizes` renders the four text sizes plus all four icon sizes; icon-only buttons have an accessible name.
- `Disabled` renders the native disabled state and has a `play` assertion that the button is disabled.
- `AsChild` renders a semantic anchor as the single Slot child and has a `play` assertion that the rendered host is an anchor and keeps the expected accessible name.
- Do not claim Button-specific events that the family contract does not declare as local events.

Use Storybook test utilities from the current Storybook 10 API (`storybook/test`) for `expect`, `within`, and interaction helpers when needed.

- [ ] **Step 6: Prove static build and real-browser execution.**

Install only the local Chromium binary needed for the test run:

```bash
npx playwright install chromium
npm run build-storybook
npm run test-storybook
```

Expected: Storybook static build succeeds; every Button story smoke test passes; `Disabled` and `AsChild` play assertions pass in headless Chromium.

- [ ] **Step 7: Prove existing contract/application gates were not weakened.**

Run:

```bash
npm run typecheck
npm run components:verify
npm run test
npm run build
git diff --check
git status --short
```

Also inspect that `storybook-static/` is ignored and no generated Storybook output is tracked.

- [ ] **Step 8: Stop for review with Task 1 uncommitted.**

Report:

```text
starting SHA
worktree path
branch
exact changed files
exact Storybook package versions
Button story names
build-storybook result
test-storybook result
components:verify result
full npm test result
typecheck/build result
git diff --check result
any warnings, dependency conflicts, or contract/story discrepancies
```

Do not start Task 2.

---

### Task 2: Add non-interactive and simple composition families

**Files:**
- Create stories beside: `badge.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `skeleton.tsx`, `table.tsx`, `textarea.tsx`
- Read-only inputs: matching family contracts under `contracts/components/families/`

**Interfaces:**
- Consumes: Task 1 Storybook foundation.
- Produces: truthful render coverage for 8 additional approved families without artificial interaction tests.

- [ ] **Step 1: For each family, read the real component and approved family contract before authoring the story.**
- [ ] **Step 2: Add the minimum useful stories:** Badge variants; Card composed anatomy; Input default/disabled/invalid; Label associated control; Separator horizontal/vertical; Skeleton shapes; Table composed header/body/caption/footer only if the contract supports those exports; Textarea default/disabled/invalid.
- [ ] **Step 3: Do not invent controls for inherited HTML props broadly; expose only high-signal authored controls.**
- [ ] **Step 4: Run `npm run build-storybook`, `npm run test-storybook`, `npm run components:verify`, `npm run test`, `npm run typecheck`, `git diff --check`.**
- [ ] **Step 5: Stop for review before Task 3.**

---

### Task 3: Add direct stateful interaction families

**Files:**
- Create stories beside: `accordion.tsx`, `checkbox.tsx`, `tabs.tsx`, `tooltip.tsx`
- Read-only inputs: matching contracts.

**Interfaces:**
- Produces browser-proven interaction stories for four families with direct user-visible state transitions.

- [ ] **Step 1: Accordion:** author a legal root/item/trigger/content composition and a `play` test that opens an item and verifies its content becomes observable.
- [ ] **Step 2: Checkbox:** author unchecked/checked/disabled coverage and a `play` test that toggles the supported checked state.
- [ ] **Step 3: Tabs:** author legal root/list/trigger/content composition and a `play` test that switches active content.
- [ ] **Step 4: Tooltip:** use the required provider/root/trigger/content composition from the contract and a `play` test for the supported reveal interaction; do not bypass provider requirements with a fake wrapper.
- [ ] **Step 5: Run Storybook build/tests plus the complete existing verification gates and stop for review.**

---

### Task 4: Add portal/overlay and scroll families

**Files:**
- Create stories beside: `dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `sheet.tsx`, `scroll-area.tsx`
- Read-only inputs: matching contracts.

**Interfaces:**
- Produces isolated portal/overlay runtime evidence without modifying component source.

- [ ] **Step 1: Dialog:** legal trigger/content/title/description/actions composition; `play` opens and closes it and queries portal content by accessible role/name.
- [ ] **Step 2: Dropdown Menu:** legal trigger/content/items composition; `play` opens and verifies expected menu items.
- [ ] **Step 3: Select:** legal trigger/value/content/item composition; `play` opens and selects an option, then verifies the trigger value.
- [ ] **Step 4: Sheet:** legal trigger/content/header/title/description composition; `play` opens and closes it.
- [ ] **Step 5: Scroll Area:** render a bounded viewport with enough real content to expose scrolling; smoke/render evidence only unless the contract exposes a meaningful authored interaction worth testing.
- [ ] **Step 6: Run Storybook build/tests plus all existing verification gates and stop for review.**

---

### Task 5: Prove Sidebar, full 19-family parity, and CI enforcement

**Files:**
- Create: `src/components/ui/sidebar.stories.tsx`
- Create: `tests/storybook-contract-coverage.test.ts`
- Modify: `.github/workflows/baseline.yml`
- Modify: `package.json` only if a final aggregate verification script is useful and does not duplicate existing commands

**Interfaces:**
- Produces: the final 19-family visual evidence set and a CI gate that cannot silently lose Storybook coverage.

- [ ] **Step 1: Build Sidebar from its real provider/context composition.** Include a representative desktop sidebar with `SidebarProvider`, `Sidebar`, trigger, content/group/menu primitives, and a `play` test that toggles collapsed/expanded state through the public trigger. Do not mock `useSidebar` or remove its provider requirement. Add only the smallest browser primitive/polyfill if a real browser API required by `useIsMobile` is absent in the test runner, and keep that test-only setup factual.
- [ ] **Step 2: Add parity regression test.** `tests/storybook-contract-coverage.test.ts` reads `contracts/components/component-contract-set.json`, derives the 19 family IDs from `familyFiles`, and asserts there is exactly one matching `src/components/ui/<family>.stories.tsx` for every approved family. It must fail if an approved family has no story file or if the expected story file naming convention drifts.
- [ ] **Step 3: Extend the existing `Baseline verification` workflow rather than creating a second baseline workflow.** After `npm ci --ignore-scripts`, install Chromium with Playwright, then preserve existing typecheck/test/build and add `npm run build-storybook` plus `npm run test-storybook`. A Storybook failure must fail the job.
- [ ] **Step 4: Run the final clean verification:**

```bash
rm -rf node_modules storybook-static
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run typecheck
npm run test
npm run components:verify
npm run build
npm run build-storybook
npm run test-storybook
git diff --check
```

Expected: all existing and Storybook gates pass from a clean install.

- [ ] **Step 5: Verify scope.** Confirm all 19 approved family story files exist, no contract JSON/component API was changed for Storybook convenience, and no out-of-scope visual-regression/hosting dependency was added.
- [ ] **Step 6: Stop for final independent review before merge/push decisions.**
