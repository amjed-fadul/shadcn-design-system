# Phase 2 — Token Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Execute this plan task-by-task. Every task uses TDD where behavior or validation is introduced, ends in a separate commit, and stops for review before the next task unless explicitly instructed otherwise.

**Goal:** Create a machine-readable, source-reconciled factual token contract for the approved `shadcn-radix-bootstrap-000` baseline, plus a compact agent-facing token index and query boundary.

**Architecture:** The committed token contract is a factual projection of already-approved sources, not a second source of truth. Local canonical theme values in `src/index.css` have precedence over Tailwind defaults; Tailwind 4.3.3 supplies only namespaces not overridden locally. Semantic color relationships are recorded only when they are explicit in source—never inferred by matching identical values.

**Tech stack:** Node 22.18.0, TypeScript 5.5.4, JSON, JSON Schema Draft 2020-12, Ajv 8.20.0 as a pinned dev-only schema validator, Vitest 3.2.7, Tailwind CSS 4.3.3.

**Spec:** `docs/MASTER-PLAN.md`, Phase 2.

## Starting state

Start from exactly:

```text
Repository: amjed-fadul/shadcn-design-system
Branch: main
Required starting main: f9682ce3238f1fc5f41a91b1d6953a40c12d2288
Approved baseline: shadcn-radix-bootstrap-000
Pinned shadcn upstream: 1773ecfeeb4a04366978d353e69b5c7ded78dcb2
Pinned Tailwind CSS: 4.3.3
```

Create an isolated worktree and branch:

```bash
git fetch origin
git worktree add .worktrees/phase-2-token-contracts -b feat/phase-2-token-contracts origin/main
cd .worktrees/phase-2-token-contracts
git rev-parse HEAD
git status --short
```

Required starting HEAD:

```text
f9682ce3238f1fc5f41a91b1d6953a40c12d2288
```

Stop immediately if it differs.

## Global constraints

1. Do not modify the Agentic Design Canvas repository.
2. Do not modify any component implementation under `src/components/ui/`.
3. Do not regenerate the approved Phase 1 snapshot's recorded governed hashes.
   Bootstrap Snapshot 0 is a historical immutable baseline anchored to approved Phase 1 commit
   `f9682ce3238f1fc5f41a91b1d6953a40c12d2288`; later repository evolution must not rewrite its historical facts.
4. Do not begin component contracts, patterns, usage guidance, Canvas integration, MCP integration, or Phase 5 executable validation.
5. `src/index.css` is the canonical source for:

   * shadcn semantic colors;
   * light/dark mappings;
   * sidebar colors;
   * canonical radius;
   * canonical font-family overrides.
6. `tailwindcss@4.3.3/theme.css` is a secondary factual source only for namespaces not overridden by the canonical CSS.
7. Local canonical values always win over Tailwind defaults.
8. Do not contract Tailwind primitive color palettes such as `neutral-500`.
9. Do not infer semantic → primitive relationships by comparing equal color values.
10. No semantic color primitive mapping exists unless an actual source expression references another token.
11. Do not invent a border-width token. Tailwind's default theme does not expose a named canonical border-width token.
12. Contract only the standard box-shadow namespace `--shadow-*`; do not add inset, drop, or text-shadow tokens in Phase 2.
13. Do not contract breakpoints, containers, blur, animation, aspect ratio, or transition tokens in Phase 2.
14. The Phase 2 contract remains `"candidate"` until independent review passes.
15. Every test used as a release gate must work without live GitHub/upstream access.
16. Every direct dependency added must be exact-pinned.
17. Preserve `npm audit` at 0 known vulnerabilities.
18. Every task is a separate commit.

---

# Final Phase 2 Vocabulary

The final contract contains **82 token definitions**.

## Semantic colors — 31

IDs:

```text
color.background
color.foreground
color.card
color.card-foreground
color.popover
color.popover-foreground
color.primary
color.primary-foreground
color.secondary
color.secondary-foreground
color.muted
color.muted-foreground
color.accent
color.accent-foreground
color.destructive
color.border
color.input
color.ring
color.chart-1
color.chart-2
color.chart-3
color.chart-4
color.chart-5
color.sidebar
color.sidebar-foreground
color.sidebar-primary
color.sidebar-primary-foreground
color.sidebar-accent
color.sidebar-accent-foreground
color.sidebar-border
color.sidebar-ring
```

Each maps directly:

```text
color.background -> --background -> --color-background
color.primary -> --primary -> --color-primary
color.sidebar-primary -> --sidebar-primary -> --color-sidebar-primary
...
```

Each contains exact `light` and `dark` values from `src/index.css`.

No color token may contain a reference to `neutral-*`, `zinc-*`, or any other Tailwind palette value.

## Radius — 8

```text
radius.base
radius.sm
radius.md
radius.lg
radius.xl
radius.2xl
radius.3xl
radius.4xl
```

Required facts:

```text
radius.base = 0.625rem
radius.sm   = calc(var(--radius) * 0.6)
radius.md   = calc(var(--radius) * 0.8)
radius.lg   = var(--radius)
radius.xl   = calc(var(--radius) * 1.4)
radius.2xl  = calc(var(--radius) * 1.8)
radius.3xl  = calc(var(--radius) * 2.2)
radius.4xl  = calc(var(--radius) * 2.6)
```

`radius.sm` through `radius.4xl` explicitly depend on `radius.base`.

Do not use Tailwind's default radius values because the canonical theme overrides them.

## Font family — 2

```text
font.sans
font.heading
```

Required facts:

```text
font.sans    -> "Geist Variable", sans-serif
font.heading -> alias of font.sans
```

Do not expose Tailwind's default serif or mono families in Phase 2.

## Font sizes — 13

```text
font-size.xs
font-size.sm
font-size.base
font-size.lg
font-size.xl
font-size.2xl
font-size.3xl
font-size.4xl
font-size.5xl
font-size.6xl
font-size.7xl
font-size.8xl
font-size.9xl
```

Each definition contains both the factual Tailwind `fontSize` and its companion default `lineHeight`, read from:

```text
--text-*
--text-*--line-height
```

## Font weights — 9

```text
font-weight.thin
font-weight.extralight
font-weight.light
font-weight.normal
font-weight.medium
font-weight.semibold
font-weight.bold
font-weight.extrabold
font-weight.black
```

Corresponding values are the pinned Tailwind values `100` through `900`.

## Letter spacing — 6

```text
letter-spacing.tighter
letter-spacing.tight
letter-spacing.normal
letter-spacing.wide
letter-spacing.wider
letter-spacing.widest
```

## Line height — 5

```text
line-height.tight
line-height.snug
line-height.normal
line-height.relaxed
line-height.loose
```

## Spacing — 1 token + 1 derivation rule

Token:

```text
spacing.unit
```

Required value:

```text
0.25rem
```

Binding:

```text
--spacing
```

Additionally expose one factual derivation rule:

```text
spacing.multiplier
```

Meaning:

```text
calc(var(--spacing) * <number>)
```

Tailwind syntax:

```text
--spacing(<number>)
```

This derivation rule does **not** manufacture individual design-token IDs such as `spacing.17`.

## Box shadows — 7

```text
shadow.2xs
shadow.xs
shadow.sm
shadow.md
shadow.lg
shadow.xl
shadow.2xl
```

Values come directly from the pinned Tailwind 4.3.3 `--shadow-*` variables.

---

# Required file structure

At Phase 2 completion:

```text
contracts/
  tokens/
    token-contract.json
    token-contract.schema.json
    index.json

src/
  contracts/
    tokens/
      types.ts
      invariants.ts
      contract.ts
      index.ts
      query.ts

provenance/
  token-contract-source.json

docs/
  PHASE-2-TOKEN-CONTRACT-SCOPE.md
  superpowers/
    plans/
      2026-08-31-phase-2-token-contracts.md

tests/
  helpers/
    css-custom-properties.ts
  token-contract-source-provenance.test.ts
  token-contract-schema.test.ts
  token-contract-canonical-source.test.ts
  token-contract-tailwind-source.test.ts
  token-contract-scope.test.ts
  token-contract-index.test.ts
  token-contract-query.test.ts
  token-contract-invariants.test.ts
```

Also modify:

```text
package.json
package-lock.json
src/tokens/README.md
```

Do not create additional token files unless a concrete technical need emerges and is reported before implementation.

---

# Contract Model

Use these TypeScript concepts exactly.

```ts
export type TokenMode = "light" | "dark"

export type TokenCategory =
  | "color"
  | "radius"
  | "font-family"
  | "font-size"
  | "font-weight"
  | "letter-spacing"
  | "line-height"
  | "spacing"
  | "shadow"

export type TokenSourceId = "canonical-theme" | "tailwind-theme"

export type TokenBinding = {
  cssVariable: `--${string}`
  tailwindThemeVariable?: `--${string}`
  tailwindExpression?: string
  companionVariables?: Record<string, `--${string}`>
}

export type LiteralTokenValue = {
  kind: "literal"
  value: string | number
}

export type ModeTokenValue = {
  kind: "modes"
  values: {
    light: string
    dark: string
  }
}

export type AliasTokenValue = {
  kind: "alias"
  tokenId: string
}

export type DerivedTokenValue = {
  kind: "derived"
  expression: string
  dependencies: string[]
}

export type TypographySizeTokenValue = {
  kind: "typography-size"
  fontSize: string
  lineHeight: string
}

export type TokenValue =
  | LiteralTokenValue
  | ModeTokenValue
  | AliasTokenValue
  | DerivedTokenValue
  | TypographySizeTokenValue

export type TokenDefinition = {
  id: string
  category: TokenCategory
  sourceId: TokenSourceId
  binding: TokenBinding
  value: TokenValue
}

export type DerivedTokenRule = {
  id: "spacing.multiplier"
  category: "spacing"
  baseTokenId: "spacing.unit"
  parameter: {
    name: "multiplier"
    type: "number"
    minimum: 0
  }
  expression: "calc(var(--spacing) * <multiplier>)"
  tailwindSyntax: "--spacing(<multiplier>)"
  producesTokenIds: false
}

export type TokenContract = {
  schemaVersion: 1
  id: "shadcn-radix-token-contract-001"
  status: "candidate" | "approved"
  baselineSnapshotId: "shadcn-radix-bootstrap-000"
  sourceBaselineCommit: string
  sourceProvenancePath: "provenance/token-contract-source.json"
  modes: ["light", "dark"]
  coverage: {
    contracted: TokenCategory[]
    representedElsewhere: Array<{
      namespace: string
      tokenIds: string[]
      reason: string
    }>
    notContracted: Array<{
      namespace: string
      reason: string
    }>
  }
  derivedRules: DerivedTokenRule[]
  tokens: TokenDefinition[]
}
```

JSON Schema must mirror these types and use `additionalProperties: false` for every structured object.

Token IDs must match:

```regex
^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$
```

CSS variable names must match:

```regex
^--[a-z0-9-]+$
```

---

# Task 1 — Freeze Phase 2 Scope and Source Provenance

**Recommended Codex model:** Luna Medium.

**Session:** Start a new Phase 2 Codex session.

**Files:**

```text
Create: docs/superpowers/plans/2026-08-31-phase-2-token-contracts.md
Create: docs/PHASE-2-TOKEN-CONTRACT-SCOPE.md
Create: provenance/token-contract-source.json
Create: tests/token-contract-source-provenance.test.ts
```

## Required provenance model

`provenance/token-contract-source.json` must record:

```json
{
  "schemaVersion": 1,
  "baseline": {
    "snapshotId": "shadcn-radix-bootstrap-000",
    "sourceCommit": "f9682ce3238f1fc5f41a91b1d6953a40c12d2288"
  },
  "sources": {
    "canonicalTheme": {
      "path": "src/index.css",
      "blobSha": "d8c0cfe33f88e04af7aea72c952abee5903d836e"
    },
    "shadcnNeutral": {
      "repository": "shadcn-ui/ui",
      "release": "shadcn@4.19.0",
      "commit": "1773ecfeeb4a04366978d353e69b5c7ded78dcb2",
      "path": "apps/v4/public/r/colors/neutral.json"
    },
    "tailwindTheme": {
      "package": "tailwindcss",
      "version": "4.3.3",
      "path": "node_modules/tailwindcss/theme.css"
    }
  }
}
```

Extend `tailwindTheme` with:

```text
themeCssSha256
packageLockIntegrity
```

Both values must be computed from the actual clean `npm ci` installation / lockfile and then verified by test.

## Scope document must explicitly state

```text
Canonical-theme precedence over Tailwind defaults.
31 semantic color tokens.
No raw Tailwind color-palette contract.
No inferred semantic-to-primitive color links.
8 canonical radius tokens.
Geist sans + heading alias.
Complete named Tailwind typography primitive namespaces.
One Tailwind spacing base token plus derivation rule.
Seven standard box-shadow tokens.
Border color represented by color.border/color.input.
No named border-width token.
No inset/drop/text shadows.
No breakpoints/containers/blur/animation.
No Canvas product tokens.
Final expected token count: 82.
```

## TDD steps

* [ ] Write `token-contract-source-provenance.test.ts` first.
* [ ] Assert the provenance file does not yet exist or does not satisfy the required fields.
* [ ] Run the focused test and capture RED.
* [ ] Create provenance and scope files.
* [ ] Re-run and capture GREEN.
* [ ] Run `git diff --check`.
* [ ] Commit:

```bash
git commit -m "docs: define phase 2 token contract scope"
```

**Stop and report Task 1 for review.**

---

# Task 2 — Add the Contract Schema and Semantic Invariants

**Recommended Codex model:** Terra High.

**Session:** Continue the Phase 2 session after Task 1 review.

**Files:**

```text
Modify: package.json
Modify: package-lock.json
Create: contracts/tokens/token-contract.schema.json
Create: src/contracts/tokens/types.ts
Create: src/contracts/tokens/invariants.ts
Create: tests/token-contract-schema.test.ts
Create: tests/token-contract-invariants.test.ts
```

Add exactly:

```json
"ajv": "8.20.0"
```

under `devDependencies`.

Run:

```bash
npm install --save-dev --save-exact ajv@8.20.0
```

Do not change unrelated packages.

## Invariant API

Implement:

```ts
export function validateTokenContractInvariants(
  contract: TokenContract
): string[]

export function assertTokenContractInvariants(
  contract: TokenContract
): void
```

`validateTokenContractInvariants()` returns deterministic human-readable errors.

It must detect:

1. duplicate token IDs;
2. unknown `sourceId`;
3. alias targets that do not exist;
4. derived dependencies that do not exist;
5. alias cycles;
6. derived-reference cycles;
7. color tokens that are not `kind: "modes"`;
8. color mode maps missing light or dark;
9. a token category not declared in `coverage.contracted`;
10. duplicate canonical `binding.cssVariable` values;
11. `status: "approved"` before an approval metadata field is present if approval metadata is added;
12. any `derivedRule.baseTokenId` that does not exist.

Do **not** make the generic invariant library enforce the number 82. That belongs to the real-contract scope test, not the reusable model validator.

## Schema RED tests

Create a minimal valid fixture in the test.

Prove these invalid documents fail schema validation:

```text
unknown top-level property
invalid token ID
invalid CSS variable
unknown category
mode token without dark
literal value with an illegal extra field
derived rule with wrong producesTokenIds value
```

Use:

```ts
import Ajv2020 from "ajv/dist/2020"
```

with:

```ts
new Ajv2020({
  allErrors: true,
  strict: true,
})
```

## Verification

```bash
npm run typecheck
npx vitest run tests/token-contract-schema.test.ts tests/token-contract-invariants.test.ts
npm audit
git diff --check
```

Commit:

```bash
git commit -m "feat: add token contract schema"
```

**Stop and report Task 2 for review.**

---

# Task 3 — Contract Canonical shadcn Tokens

**Recommended Codex model:** Luna High.

**Files:**

```text
Create: contracts/tokens/token-contract.json
Create: tests/helpers/css-custom-properties.ts
Create: tests/token-contract-canonical-source.test.ts
```

The initial contract must have:

```json
{
  "schemaVersion": 1,
  "id": "shadcn-radix-token-contract-001",
  "status": "candidate",
  "baselineSnapshotId": "shadcn-radix-bootstrap-000",
  "sourceBaselineCommit": "f9682ce3238f1fc5f41a91b1d6953a40c12d2288",
  "sourceProvenancePath": "provenance/token-contract-source.json",
  "modes": ["light", "dark"]
}
```

Do not set it to approved.

## CSS helper

Implement a small test helper that:

```ts
export function extractCssBlock(
  source: string,
  marker: string
): string

export function parseCustomProperties(
  block: string
): Map<string, string>

export function normalizeCssValue(
  value: string
): string
```

`extractCssBlock` must use brace-depth matching, not a naïve regex that stops at the first nested brace.

`parseCustomProperties` must support multi-line declaration values.

Normalization may collapse insignificant whitespace only. It must not rewrite values.

## Add 41 canonical-theme tokens

Exactly:

```text
31 colors
8 radii
2 font-family tokens
```

### Color requirements

For every semantic color:

```json
{
  "id": "color.background",
  "category": "color",
  "sourceId": "canonical-theme",
  "binding": {
    "cssVariable": "--background",
    "tailwindThemeVariable": "--color-background",
    "tailwindExpression": "var(--background)"
  },
  "value": {
    "kind": "modes",
    "values": {
      "light": "exact :root value",
      "dark": "exact .dark value"
    }
  }
}
```

Apply that structure to all 31 color IDs.

### Radius example

```json
{
  "id": "radius.sm",
  "category": "radius",
  "sourceId": "canonical-theme",
  "binding": {
    "cssVariable": "--radius-sm"
  },
  "value": {
    "kind": "derived",
    "expression": "calc(var(--radius) * 0.6)",
    "dependencies": ["radius.base"]
  }
}
```

### Font example

```json
{
  "id": "font.heading",
  "category": "font-family",
  "sourceId": "canonical-theme",
  "binding": {
    "cssVariable": "--font-heading"
  },
  "value": {
    "kind": "alias",
    "tokenId": "font.sans"
  }
}
```

## Canonical-source tests must prove

```text
31/31 color variables exist in both :root and .dark.
All contract light/dark values equal canonical CSS.
All 31 --color-* Tailwind aliases resolve to their corresponding semantic variable.
Radius source and all seven derived expressions match exactly.
font.sans matches Geist Variable.
font.heading explicitly aliases font.sans.
No color token ID begins color.neutral-, color.zinc-, etc.
No color token contains an alias/reference to a Tailwind primitive color.
The contract passes JSON Schema and semantic invariants.
```

RED first, then GREEN.

Verification:

```bash
npx vitest run tests/token-contract-canonical-source.test.ts tests/token-contract-schema.test.ts tests/token-contract-invariants.test.ts
npm run typecheck
git diff --check
```

Commit:

```bash
git commit -m "feat: contract canonical theme tokens"
```

**Stop and report Task 3 for review.**

---

# Task 4 — Contract Pinned Tailwind Typography, Spacing, and Shadows

**Recommended Codex model:** Luna High.

**Files:**

```text
Modify: contracts/tokens/token-contract.json
Create: tests/token-contract-tailwind-source.test.ts
Create: tests/token-contract-scope.test.ts
```

Add exactly 41 further token definitions.

Final total must become:

```text
82
```

## Tailwind source

Read only:

```text
node_modules/tailwindcss/theme.css
```

Verify before extraction that:

```text
package.json dependencies.tailwindcss === "4.3.3"
```

Do not retrieve current Tailwind values from the internet.

## Font-size representation

Example:

```json
{
  "id": "font-size.sm",
  "category": "font-size",
  "sourceId": "tailwind-theme",
  "binding": {
    "cssVariable": "--text-sm",
    "companionVariables": {
      "lineHeight": "--text-sm--line-height"
    }
  },
  "value": {
    "kind": "typography-size",
    "fontSize": "0.875rem",
    "lineHeight": "calc(1.25 / 0.875)"
  }
}
```

Use exact source values for all 13 sizes.

## Spacing

```json
{
  "id": "spacing.unit",
  "category": "spacing",
  "sourceId": "tailwind-theme",
  "binding": {
    "cssVariable": "--spacing"
  },
  "value": {
    "kind": "literal",
    "value": "0.25rem"
  }
}
```

Add exactly this derived rule:

```json
{
  "id": "spacing.multiplier",
  "category": "spacing",
  "baseTokenId": "spacing.unit",
  "parameter": {
    "name": "multiplier",
    "type": "number",
    "minimum": 0
  },
  "expression": "calc(var(--spacing) * <multiplier>)",
  "tailwindSyntax": "--spacing(<multiplier>)",
  "producesTokenIds": false
}
```

## Coverage metadata

Final `coverage.contracted`:

```text
color
radius
font-family
font-size
font-weight
letter-spacing
line-height
spacing
shadow
```

`coverage.representedElsewhere` must state:

```text
border-color -> color.border and color.input
```

`coverage.notContracted` must explicitly include:

```text
primitive-color
border-width
inset-shadow
drop-shadow
text-shadow
breakpoint
container
blur
animation
canvas-product-token
```

Each needs a factual reason.

## Scope tests

Assert exact category counts:

```text
color:           31
radius:           8
font-family:      2
font-size:       13
font-weight:      9
letter-spacing:   6
line-height:      5
spacing:          1
shadow:           7
--------------------
total:           82
```

Also prove:

```text
radius.sm uses the canonical shadcn expression, not Tailwind's default radius.sm.
No primitive color palette is present.
No border-width token exists.
No inset/drop/text shadow token exists.
All 41 Tailwind-derived values reconcile to the installed 4.3.3 theme.css.
```

Verification:

```bash
npx vitest run tests/token-contract-tailwind-source.test.ts tests/token-contract-scope.test.ts
npm run typecheck
npm run test
git diff --check
```

Commit:

```bash
git commit -m "feat: contract tailwind theme tokens"
```

**Stop and report Task 4 for review.**

---

# Task 5 — Add the Agent-Facing Index and Query Boundary

**Recommended Codex model:** Luna High.

**Files:**

```text
Create: contracts/tokens/index.json
Create: src/contracts/tokens/contract.ts
Create: src/contracts/tokens/index.ts
Create: src/contracts/tokens/query.ts
Create: tests/token-contract-index.test.ts
Create: tests/token-contract-query.test.ts
Modify: package.json
```

## Contract loader

`contract.ts` must:

1. import committed `token-contract.json`;
2. type it as `TokenContract`;
3. call `assertTokenContractInvariants()` once;
4. export an immutable/read-only contract reference.

Do not silently repair malformed contracts.

## Query API

Expose exactly:

```ts
export type TokenLookupSuccess = {
  ok: true
  token: TokenDefinition
}

export type TokenLookupFailure = {
  ok: false
  code: "TOKEN_NOT_CONTRACTED"
  tokenId: string
}

export type TokenLookupResult =
  | TokenLookupSuccess
  | TokenLookupFailure

export function getTokenContract(): Readonly<TokenContract>

export function listTokens(
  category?: TokenCategory
): readonly TokenDefinition[]

export function listTokenIds(
  category?: TokenCategory
): readonly string[]

export function lookupToken(
  tokenId: string
): TokenLookupResult

export function isContractedToken(
  tokenId: string
): boolean
```

No fuzzy matching.

No aliases like `"primary"` → `"color.primary"`.

No automatic conversion from CSS literals.

## Index shape

`contracts/tokens/index.json`:

```ts
type TokenIndex = {
  schemaVersion: 1
  contractId: "shadcn-radix-token-contract-001"
  baselineSnapshotId: "shadcn-radix-bootstrap-000"
  tokenCount: 82
  modes: ["light", "dark"]
  categories: Array<{
    id: TokenCategory
    tokenIds: string[]
  }>
}
```

`buildTokenIndex(contract)` in `src/contracts/tokens/index.ts` must deterministically produce this projection.

Committed `index.json` must equal `buildTokenIndex(tokenContract)` exactly.

Sort category order using the canonical Phase 2 category order, and sort token IDs lexically inside each category.

## Negative query requirements

Tests must prove:

```ts
lookupToken("color.background").ok === true
lookupToken("radius.sm").ok === true

lookupToken("color.neutral-500")
=> TOKEN_NOT_CONTRACTED

lookupToken("#fff")
=> TOKEN_NOT_CONTRACTED

lookupToken("oklch(1 0 0)")
=> TOKEN_NOT_CONTRACTED

lookupToken("spacing.17")
=> TOKEN_NOT_CONTRACTED

lookupToken("radius.unknown")
=> TOKEN_NOT_CONTRACTED
```

The last two are important:

`spacing.multiplier` is a derivation rule, not permission to invent token IDs.

## Focused verification script

Add:

```json
"tokens:verify": "vitest run tests/token-contract-*.test.ts"
```

Run:

```bash
npm run tokens:verify
npm run typecheck
npm run test
npm run build
git diff --check
```

Commit:

```bash
git commit -m "feat: add token contract query index"
```

**Stop and report Task 5 for review.**

---

# Task 6 — Harden the Contract Against False Success

**Recommended Codex model:** Terra High for independent forensic review; implementation remains bounded.

**Files:**

```text
Modify: src/contracts/tokens/invariants.ts only if evidence requires
Modify: tests/token-contract-invariants.test.ts
Modify: src/tokens/README.md
```

No contract vocabulary changes without explicit approval.

## Mutation tests

Start from a deep clone of the real valid contract and prove these mutations fail:

### Duplicate token

Duplicate:

```text
color.background
```

Expected invariant failure.

### Dangling alias

Change:

```text
font.heading -> font.nonexistent
```

Expected invariant failure.

### Alias cycle

Change:

```text
font.sans -> font.heading
font.heading -> font.sans
```

Expected cycle failure.

### Missing derived dependency

Change:

```text
radius.sm.dependencies = ["radius.nonexistent"]
```

Expected invariant failure.

### Missing dark value

Remove:

```text
color.background.value.values.dark
```

Expected JSON Schema failure.

### Invalid extra property

Add an unknown property to a token.

Expected JSON Schema failure due to `additionalProperties: false`.

### Scope drift

Add:

```text
color.neutral-500
```

Expected `token-contract-scope.test.ts` failure.

### Fake border token

Add:

```text
border-width.default
```

Expected scope failure.

### Index drift

Delete one ID from `contracts/tokens/index.json`.

Expected index reconciliation failure.

## README update

Update `src/tokens/README.md` to say Phase 2 now has:

```text
machine-readable token contract
source reconciliation
agent-facing index
candidate status pending independent review
```

Do not add “when to use” guidance.

Do not write usage recommendations.

## Full local gate

Run fresh:

```bash
npm ci
npm run typecheck
npm run tokens:verify
npm run test
npm run build
npm audit --omit=dev
npm audit
git diff --check
```

Required:

```text
all pass
0 vulnerabilities
82 contracted token definitions
1 spacing derivation rule
```

Commit:

```bash
git commit -m "test: harden token contract integrity"
```

---

# Task 6 Exit Handoff — DO NOT MERGE

Push:

```bash
git push -u origin feat/phase-2-token-contracts
```

Create a **draft PR** to `main`.

Do not merge.

Remote CI must run.

Report:

```text
branch
full head SHA
base SHA
PR number
GitHub synthetic merge SHA
token count by category
contract status
focused test count/results
full test count/results
typecheck
build
production audit
full audit
baseline verification workflow
dependency security workflow
working-tree status
```

The contract must still say:

```json
"status": "candidate"
```

Stop here for independent review.

---

# Independent Phase 2 Review Gate

The reviewer must independently verify:

1. all 82 tokens exist and only those 82;
2. all 31 semantic colors reconcile to canonical light/dark CSS;
3. no primitive color mappings were inferred;
4. radius local overrides beat Tailwind defaults;
5. Geist is the canonical sans family;
6. typography values match Tailwind 4.3.3;
7. spacing is represented as one base token + one derivation rule;
8. box-shadow values match Tailwind 4.3.3;
9. border width was not invented;
10. query/index reject unknown/raw token identifiers;
11. source tests are offline;
12. mutation tests genuinely fail when facts drift;
13. Bootstrap Snapshot 0 is independently verified against approved Phase 1 commit `f9682ce…`, and no recorded historical hash was regenerated;
14. no component source changed;
15. no Phase 3+ work began;
16. remote CI is green on the PR merge SHA.

Possible verdicts:

```text
PASS
PASS WITH FIXES
FAIL
```

---

# Task 7 — Approval and Merge

**GATED. Codex must not execute this task until explicit independent-review approval.**

**Recommended Codex model:** Luna Medium.

After explicit PASS only:

1. Change:

```json
"status": "candidate"
```

to:

```json
"status": "approved"
```

2. If approval metadata is part of the final schema, record the actual approval date.

3. Do not alter token vocabulary or values.

4. Re-run:

```bash
npm ci
npm run typecheck
npm run tokens:verify
npm run test
npm run build
npm audit --omit=dev
npm audit
git diff --check
```

5. Push.

6. Require both remote gates green again.

7. Merge the PR into `main`.

8. Report final `main` SHA.

9. Confirm Phase 3 was not started.

---

# Phase 2 Formal Exit Gate

Phase 2 passes only when all are true:

```text
[ ] 82 factual tokens approved
[ ] 1 spacing derivation rule approved
[ ] semantic colors have exact light/dark source reconciliation
[ ] no inferred primitive-color relationships
[ ] canonical radius overrides verified
[ ] typography provenance verified
[ ] spacing provenance verified
[ ] box-shadow provenance verified
[ ] border-width non-contract decision explicit
[ ] schema validation green
[ ] semantic invariants green
[ ] mutation tests green
[ ] committed index exactly matches contract
[ ] unknown token identifiers reject deterministically
[ ] raw literals do not masquerade as token IDs
[ ] Bootstrap Snapshot 0 verified against its approved historical Phase 1 commit without regenerating governed hashes
[ ] component implementation unchanged
[ ] fresh npm ci passes
[ ] typecheck passes
[ ] focused token tests pass
[ ] full tests pass
[ ] production build passes
[ ] production audit: 0 vulnerabilities
[ ] full audit: 0 vulnerabilities
[ ] remote baseline CI passes
[ ] remote security CI passes
[ ] independent review PASS
[ ] token contract status = approved
[ ] merged into main
[ ] Phase 3 not started
```

Only after that is **Phase 3 — Component Factual Contracts** unlocked.
