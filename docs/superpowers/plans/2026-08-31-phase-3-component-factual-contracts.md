# Phase 3 Component Factual Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Use TDD and a fresh review gate after every task.

**Goal:** Build an approved, design-system-neutral factual component-contract set for all 19 pinned shadcn component families.

**Architecture:** Static family/interface contracts are checked into the repository and independently reconciled against canonical source, pinned React/Radix declarations, the approved Phase 2 token contract, and focused runtime evidence. Shared inherited interfaces prevent API duplication; capability-based composition, state channels, Slot facts, rendering identity, and structural accessibility facts preserve legal behavior without adding Phase 4 guidance or Phase 5 enforcement.

**Tech Stack:** TypeScript 5.5.4, React 18.3.1, `@types/react` 18.3.3, Radix `radix-ui` 1.6.7, CVA 0.7.1, Tailwind 4.3.3, Ajv 8.20.0, Vitest 3.2.7.

**Spec:** `docs/superpowers/specs/2026-08-31-phase-3-component-factual-contracts-design.md`

## Global constraints

* Start from `main@6f14d8f9f5b5638ab97db009d7c164a65331dca7`.
* Use branch `feat/phase-3-component-contracts`.
* Use a project-local isolated worktree.
* Required Node: `22.18.0`.
* Required npm: `10.9.3`.
* Use explicit Volta for every Node/npm/npx command if the interactive shell is unreliable.
* Do not modify `src/components/ui/**` during Phase 3.
* Do not modify the approved Phase 2 token facts.
* Do not regenerate Phase 1 historical snapshot hashes.
* No new dependency unless a blocker is independently demonstrated and approved.
* No Phase 4 usage guidance.
* No Phase 5 JSX validator.
* No Canvas/MCP integration.
* Contracts remain `candidate` until the final independent review gate.
* Do not push until the draft-PR task.
* Stop on source/contract disagreement rather than editing canonical source.
* Every task uses genuine RED → GREEN.
* Every task receives a fresh reviewer/subagent after GREEN.
* Keep factual uncertainties explicit as `unresolved`.

## Task 3 architecture amendment — 2026-08-31

This amendment resulted from independent Task 3 review. It records only the three accepted generic corrections:

1. Rendering uses a design-system-neutral tree with an explicit root node, public-props target node, host descriptors, child references, and evidence-backed data attributes. This preserves non-exported wrappers such as Table's outer `div` without inventing authoring composition constraints.
2. Component definitions record inherited-prop defaults separately from local props. This captures wrapper-supplied defaults such as Separator's `orientation: "horizontal"` and `decorative: true` without duplicating inherited API declarations.
3. Token dependencies are reconciled for completeness from canonical TSX/CVA class sources through independent utility analysis. Modifier/state prefixes and opacity suffixes do not hide dependencies; numeric spacing utilities resolve through `spacing.unit` and `spacing.multiplier`, and static contracts must match the normalized source-derived set.

The render tree preserves evidence-backed portal semantics through node-targeted portal boundaries. The tree replaces the old flat automatic-structure representation but does not discard portal facts.

Render child edges are evidence-backed references and may carry a public-prop condition; component-export hosts must identify JSX-authorable component exports.

---

## Model/session map

| Task | Recommended Codex model | Session                        |
| ---- | ----------------------- | ------------------------------ |
| 1    | Luna Medium             | New Phase 3 session            |
| 2    | Terra High              | Continue                       |
| 3    | Luna High               | Continue                       |
| 4    | Terra High              | Continue                       |
| 5    | Terra High              | Continue                       |
| 6    | Terra High              | Continue                       |
| 7    | Terra High              | Continue                       |
| 8    | Luna High               | Continue                       |
| 9    | Terra High              | New forensic review session    |
| 10   | Terra High              | New independent-review session |
| 11A  | Luna Medium             | Continue review session        |
| 11B  | Luna Medium             | Continue                       |

---

# Planned file structure

```text
contracts/components/
├── component-contract-set.json
├── component-contract-set.schema.json
├── component-family.schema.json
├── inherited-interface.schema.json
├── index.json
├── families/
│   ├── accordion.json
│   ├── badge.json
│   ├── button.json
│   ├── card.json
│   ├── checkbox.json
│   ├── dialog.json
│   ├── dropdown-menu.json
│   ├── input.json
│   ├── label.json
│   ├── scroll-area.json
│   ├── select.json
│   ├── separator.json
│   ├── sheet.json
│   ├── sidebar.json
│   ├── skeleton.json
│   ├── table.json
│   ├── tabs.json
│   ├── textarea.json
│   └── tooltip.json
└── interfaces/
    └── <only interfaces actually referenced by the 19 families>.json

provenance/
└── component-contract-source.json

src/contracts/components/
├── types.ts
├── invariants.ts
├── loader.ts
├── index.ts
└── query.ts

tests/helpers/
├── component-source-analysis.ts
├── typescript-interface-analysis.ts
└── component-token-analysis.ts

tests/
├── component-contract-source-provenance.test.ts
├── component-contract-schema.test.ts
├── component-contract-invariants.test.ts
├── component-contract-button.test.ts
├── component-contract-simple-families.test.ts
├── component-contract-stateful-families.test.ts
├── component-contract-compound-families.test.ts
├── component-contract-sidebar.test.ts
├── component-contract-token-dependencies.test.ts
├── component-contract-index.test.ts
├── component-contract-query.test.ts
├── component-contract-runtime-evidence.test.tsx
├── component-contract-mutation.test.ts
└── component-contract-ds-neutral.test.ts
```

Do not create interface files that no family references.

---

# Core public TypeScript model

Task 2 should implement the equivalent of:

```ts
export type ComponentExportKind =
  | "component"
  | "hook"
  | "helper"

export type EvidenceKind =
  | "canonical-source"
  | "inherited-interface"
  | "runtime-test"
  | "token-contract"

export type StructuredPropType =
  | { kind: "boolean" }
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "literal-union"; values: Array<string | number | boolean> }
  | { kind: "string-array" }
  | { kind: "boolean-or-indeterminate" }
  | { kind: "react-node" }
  | { kind: "callback"; typeText: string }
  | { kind: "typescript"; typeText: string }
  | { kind: "unresolved"; typeText?: string }

export type LocalPropContract = {
  name: string
  required: boolean
  type: StructuredPropType
  default?: string | number | boolean | null
  evidenceRefs: string[]
}

export type SlotContract = {
  propName: string
  default: boolean
  replacesHost: boolean
  childCardinality: {
    min: number
    max: number
  }
  forwardsProps: boolean
  refForwarding:
    | "supported"
    | "required"
    | "not-applicable"
    | "unresolved"
  childRequires: string[]
  evidenceRefs: string[]
}

export type CompositionContract = {
  requires: string[]
  provides: string[]
  hardConstraints: Array<{
    relation: "ancestor" | "direct-parent" | "direct-child"
    capability: string
    evidenceRefs: string[]
  }>
}

export type StateChannel = {
  id: string
  valueType: StructuredPropType
  controlled?: {
    valueProp: string
    onChangeProp: string
  }
  uncontrolled?: {
    defaultProp: string
  }
  evidenceRefs: string[]
}

export type ConditionalApiCase = {
  when: {
    prop: string
    equals: string | number | boolean
  }
  stateChannels: StateChannel[]
  evidenceRefs: string[]
}

export type EventContract = {
  prop: string
  typeText: string
  stateChannelId?: string
  evidenceRefs: string[]
}

export type TokenDependency = {
  tokenId: string
  viaDerivedRule?: {
    id: "spacing.multiplier"
    multiplier: number
  }
  conditions?: Array<{
    prop: string
    equals: string | number | boolean
  }>
  evidenceRefs: string[]
}

export type RenderingFact = {
  defaultHost:
    | { kind: "intrinsic"; tag: string }
    | { kind: "inherited-interface"; interfaceId: string }
    | { kind: "none" }
    | { kind: "unresolved" }

  dataAttributes: Array<{
    name: string
    source: "literal" | "prop" | "primitive-state"
    value?: string
    prop?: string
    evidenceRefs: string[]
  }>

  portals: boolean

  automaticStructure: Array<{
    exportName: string
    when?: {
      prop: string
      equals: string | number | boolean
    }
    evidenceRefs: string[]
  }>
}

export type AccessibilityFact = {
  feature: string
  owner:
    | "native"
    | "component"
    | "inherited-primitive"
    | "author"
  mechanism?: string
  value?: string
  evidenceRefs: string[]
}

export type ComponentDefinition = {
  localProps: LocalPropContract[]
  inherits: string[]
  slot?: SlotContract
  composition: CompositionContract
  stateChannels: StateChannel[]
  conditionalCases: ConditionalApiCase[]
  events: EventContract[]
  tokenDependencies: TokenDependency[]
  rendering: RenderingFact
  accessibility: AccessibilityFact[]
}

export type PublicExportContract = {
  name: string
  kind: ComponentExportKind
  authorableJsx: boolean
  component?: ComponentDefinition
  evidenceRefs: string[]
}

export type UnresolvedFact = {
  topic: string
  scope: string
  reason: string
  evidenceAttempted: string[]
}

export type ComponentFamilyContract = {
  schemaVersion: 1
  familyId: string
  source: {
    provenanceComponentId: string
    canonicalPath: string
    canonicalBlobSha: string
    upstreamPath: string
    upstreamBlobSha: string
    implementationKind: string
  }
  evidence: Record<string, {
    kind: EvidenceKind
    source: string
  }>
  exports: PublicExportContract[]
  unresolved: UnresolvedFact[]
}
```

Do not make shadcn names constants in the generic schema.

---

# Task 1 — Freeze Phase 3 scope and provenance

**Model:** Luna Medium
**Session:** new Phase 3 Codex session.

## Files

Create:

```text
docs/superpowers/specs/2026-08-31-phase-3-component-factual-contracts-design.md
docs/superpowers/plans/2026-08-31-phase-3-component-factual-contracts.md
docs/PHASE-3-COMPONENT-CONTRACT-SCOPE.md
provenance/component-contract-source.json
tests/component-contract-source-provenance.test.ts
```

Do not create component contracts yet.

## Steps

* [ ] Create isolated worktree and branch from exact `main@6f14d8f9...`.
* [ ] Confirm clean tree and exact Node/npm.
* [ ] Save the approved design spec verbatim.
* [ ] Save this implementation plan verbatim.
* [ ] Freeze the exact 19-family list from `provenance/seed-components.json`.
* [ ] Record current Phase 3 source baseline commit.
* [ ] Record the exact `seed-components.json` blob.
* [ ] Record pinned package evidence:

  * React 18.3.1
  * `@types/react` 18.3.3
  * `radix-ui` 1.6.7
  * TypeScript 5.5.4
  * CVA 0.7.1
* [ ] Record approved Phase 2 token contract identity/path/blob.
* [ ] Write a provenance test before the provenance artifact.
* [ ] Capture RED.
* [ ] Add provenance artifact.
* [ ] GREEN.
* [ ] Run full existing suite, typecheck, build, both audits, historical snapshot.
* [ ] Fresh reviewer verifies no Phase 3 implementation started.
* [ ] Commit:

```bash
git commit -m "docs: define phase 3 component contract scope"
```

## Exit gate

Exactly 19 seed families frozen.

No component contract artifacts yet.

No source components changed.

---

# Task 2 — Schema, invariants, source analyzers, inherited-interface model, and Button vertical slice

**Model:** Terra High
**Why:** This task establishes the architecture every later family depends on.

## Files

Create:

```text
contracts/components/component-contract-set.schema.json
contracts/components/component-family.schema.json
contracts/components/inherited-interface.schema.json

contracts/components/component-contract-set.json
contracts/components/families/button.json
contracts/components/interfaces/html.button.json

src/contracts/components/types.ts
src/contracts/components/invariants.ts

tests/helpers/component-source-analysis.ts
tests/helpers/typescript-interface-analysis.ts
tests/helpers/component-token-analysis.ts

tests/component-contract-schema.test.ts
tests/component-contract-invariants.test.ts
tests/component-contract-button.test.ts
```

## Contract set initial state

```json
{
  "schemaVersion": 1,
  "id": "shadcn-radix-component-contracts-001",
  "status": "candidate",
  "designSystemId": "shadcn-radix-bootstrap",
  "sourceBaselineCommit": "6f14d8f9f5b5638ab97db009d7c164a65331dca7",
  "tokenContractId": "shadcn-radix-token-contract-001",
  "familyCount": 19,
  "familyFiles": [
    "contracts/components/families/button.json"
  ],
  "interfaceFiles": [
    "contracts/components/interfaces/html.button.json"
  ]
}
```

The file lists only currently implemented artifacts until later tasks extend it.

## Source analyzer

Implement AST/type-checker helpers, not regex extraction for TypeScript structure.

Required interfaces:

```ts
export type ModuleExportEvidence = {
  name: string
  declarationKind: string
}

export function listModuleExports(
  sourcePath: string
): ModuleExportEvidence[]

export function readCanonicalSourceBlobSha(
  sourcePath: string
): string

export function extractFunctionPropDefaults(
  sourcePath: string,
  exportName: string
): Map<string, string | number | boolean | null>

export function extractCvaVariantLiterals(
  sourcePath: string,
  cvaIdentifier: string
): {
  variants: Record<string, string[]>
  defaults: Record<string, string>
}

export function extractDataSlotLiterals(
  sourcePath: string
): string[]
```

Use TypeScript compiler API.

Do not parse source structure through broad regexes.

## Interface analyzer

Required public test helper:

```ts
export type InterfacePropEvidence = {
  name: string
  required: boolean
  typeText: string
}

export function analyzeIntrinsicReactInterface(
  tag: keyof React.JSX.IntrinsicElements
): InterfacePropEvidence[]

export function classifyTypeText(
  typeText: string
): StructuredPropType
```

Create `html.button` from pinned `@types/react`.

Preserve exact type text even when structured classification is unavailable.

## Button contract must prove

Exports:

```text
Button          → component / JSX yes
buttonVariants  → helper / JSX no
```

Local props:

```text
variant
size
asChild
```

Exact variant values and defaults from canonical CVA source.

Inherited interface:

```text
html.button
```

Slot:

```text
asChild
default false
one child
host replacement
prop forwarding
```

Rendering:

```text
default host = button
data-slot = button
data-variant <- variant
data-size <- size
```

Token dependencies only to approved Phase 2 facts.

Accessibility:

```text
native semantic host = button
accessible-name responsibility = author
```

No usage guidance.

## RED

Tests must fail before schema/contract artifacts exist.

## GREEN

Button static contract must independently reconcile to source.

## Invariants

Implement contract-integrity checks for:

```text
duplicate exports
invalid authorableJsx classification
missing evidence refs
missing inherited interface refs
duplicate local props
unknown token IDs
unknown derived token rule
state/event prop references
automatic-structure references
source provenance mismatch
```

Do not implement generated-JSX validation.

## Verification

```text
Button focused suite
schema
invariants
Phase 2 token tests
historical snapshot
full suite
typecheck
build
both audits
diff check
```

Fresh reviewer specifically tries to find shadcn-specific assumptions in the generic schema.

Commit:

```bash
git commit -m "feat: add component contract model"
```

---

# Task 3 — Contract simple/native-oriented families

**Model:** Luna High

## Families

Exactly:

```text
badge
input
separator
skeleton
card
textarea
table
label
```

Button is already complete.

## Files

Create the eight family contracts.

Create only the shared HTML interfaces these eight contracts actually need.

Examples may include:

```text
html.div
html.input
html.textarea
html.table
html.thead
html.tbody
html.tfoot
html.tr
html.th
html.td
html.caption
html.label
```

Do not pre-create unused interfaces.

## Tests

Create:

```text
tests/component-contract-simple-families.test.ts
```

Test each family against canonical source.

For each family prove:

```text
exact export set
export classification
local props/defaults
inherited-interface refs
data-slot facts
CVA variants when present
token dependencies
source blob matches seed provenance
unresolved facts explicit
```

Do not assume each family has one component export.

Derive the exact export set from source.

## Important Button/Badge Slot consistency

If Badge supports `asChild`, apply the same first-class Slot model.

Do not infer Slot merely from historical shadcn knowledge; source must prove it.

## Token dependencies

Use the approved token resolver established in Task 2.

Unknown token-like utility → unresolved/report, not invented token.

## Commit

```bash
git commit -m "feat: contract simple component families"
```

Fresh review before commit.

---

# Task 4 — Contract stateful and moderately compound Radix families

**Model:** Terra High

## Families

```text
checkbox
tabs
accordion
tooltip
scroll-area
```

## Shared inherited interfaces

Add only the Radix interfaces actually referenced by these families.

Examples:

```text
radix.checkbox.root
radix.tabs.root
radix.tabs.list
radix.tabs.trigger
radix.tabs.content
radix.accordion.root
...
```

Exact interface IDs are lowercase dotted identifiers.

## Tests

Create:

```text
tests/component-contract-stateful-families.test.ts
```

## Required state evidence

Checkbox:

```text
checked
defaultChecked
onCheckedChange
checked | unchecked | indeterminate rendering state
```

Tabs:

```text
value
defaultValue
onValueChange
orientation
TabsList.variant
```

Accordion:

```text
type = single
type = multiple
conditional value/defaultValue/onValueChange shapes
```

Tooltip:

```text
open state where inherited
trigger/content composition
asChild support where inherited
```

Scroll Area:

```text
compound parts
orientation/scrollbar facts where inherited
```

## Conditional-case test

An Accordion contract that represents:

```text
type = single
value = string[]
```

as legal must fail contract integrity tests.

The contract model must preserve the conditional API distinction.

## Commit

```bash
git commit -m "feat: contract stateful component families"
```

Fresh reviewer checks state/channel accuracy against pinned Radix declarations.

---

# Task 5 — Contract complex compound/overlay families

**Model:** Terra High

## Families

```text
select
dropdown-menu
dialog
sheet
```

## Tests

Create:

```text
tests/component-contract-compound-families.test.ts
```

## Required composition coverage

Select must model at least:

```text
Select
SelectTrigger
SelectValue
SelectContent
SelectItem
SelectGroup
SelectLabel
SelectSeparator
scroll controls
```

Use capabilities rather than one rigid tree.

Dialog must model all actual exports, including:

```text
Dialog
DialogTrigger
DialogPortal
DialogClose
DialogOverlay
DialogContent
DialogHeader
DialogFooter
DialogTitle
DialogDescription
```

DialogContent local factual API:

```text
showCloseButton?: boolean
default true
```

DialogFooter local factual API:

```text
showCloseButton?: boolean
default false
```

Rendering facts must capture automatic close structure where source proves it.

Sheet receives equivalent compound/overlay treatment.

Dropdown Menu must distinguish all public renderable exports from any helpers.

## Slot coverage

Trigger/Close/etc. components inheriting `asChild` must expose Slot facts.

Nested legal composition such as:

```text
TooltipTrigger asChild
  → DialogTrigger asChild
      → Button
```

must be representable by the capability model.

Do not hardcode this exact chain as the only valid chain.

## Portal coverage

Portal facts must be factual and evidence-backed.

Do not infer a portal from the visual behavior alone.

## Commit

```bash
git commit -m "feat: contract compound component families"
```

Fresh reviewer checks especially for over-rigid composition rules.

---

# Task 6 — Contract Sidebar independently

**Model:** Terra High

Sidebar gets its own task because it is effectively a small subsystem.

## Files

Create:

```text
contracts/components/families/sidebar.json
tests/component-contract-sidebar.test.ts
```

Add only newly required shared interfaces.

## Export classification

Derive exact public exports from canonical source.

At minimum classification must correctly distinguish:

```text
Sidebar* renderable exports
useSidebar → hook / JSX false
```

Never manually assume the total export count.

## State channels

SidebarProvider must model:

```text
defaultOpen
open
onOpenChange
```

and factual controlled/uncontrolled behavior.

Record mobile open state only if it is genuinely public authoring API; internal state must not be exposed as a public prop contract.

## Composition

Model provider/context requirements with capabilities.

Examples:

```text
SidebarProvider provides sidebar.context

Sidebar
requires sidebar.context

SidebarTrigger
requires sidebar.context

SidebarMenuButton
requires appropriate sidebar context when factual
```

Do not encode one Studio navigation tree as the only legal structure.

## Runtime facts

Capture evidence for:

```text
Cmd/Ctrl+B toggle
mobile Sheet rendering
controlled open callback
SidebarTrigger callback composition
```

Reuse existing Phase 1 runtime tests where possible.

## Token dependencies

Sidebar-specific semantic colors must resolve only to the approved Phase 2 sidebar tokens.

No Canvas product token may appear.

## Commit

```bash
git commit -m "feat: contract sidebar component family"
```

Fresh reviewer should be Terra High and treat Sidebar as a high-risk family.

---

# Task 7 — Cross-family closure: interfaces, composition, tokens, evidence

**Model:** Terra High

This is the point where individual family correctness becomes one coherent contract set.

## Files

Create:

```text
tests/component-contract-token-dependencies.test.ts
tests/component-contract-runtime-evidence.test.tsx
```

Extend invariants where genuinely required.

## Contract set

Update:

```text
component-contract-set.json
```

to list exactly:

```text
19 family files
all and only referenced interface files
```

`familyCount` must remain 19.

## Interface closure

Prove:

```text
every family inherits only existing interface IDs
every interface file is referenced by at least one family
no duplicate interface IDs
no package/version drift
```

## Composition closure

Build a capability graph in test/invariant code.

Reject:

```text
required capability with no possible provider in the family/contract set
hard constraint referencing nonexistent capability/export
```

Do not require every `requires` relationship to be satisfiable in the same immediate parent.

## Token closure

Every component token dependency must resolve to:

```text
one of the 82 approved token IDs
```

or explicitly use:

```text
spacing.unit + spacing.multiplier
```

No:

```text
primitive color IDs
invented spacing IDs
Canvas product tokens
unknown tokens
```

## Variant/state-specific dependencies

Cross-check conditional dependency facts where source makes them explicit.

Button destructive/default/outline are required adversarial examples.

## Evidence closure

Every `evidenceRef` must resolve.

Every runtime-test evidence path/test name must exist.

Every token-contract evidence reference must resolve.

Every inherited-interface evidence reference must resolve.

## Commit

```bash
git commit -m "test: close component contract dependencies"
```

---

# Task 8 — Agent-facing index, loader, query API, and runtime immutability

**Model:** Luna High

## Files

Create:

```text
contracts/components/index.json

src/contracts/components/loader.ts
src/contracts/components/index.ts
src/contracts/components/query.ts

tests/component-contract-index.test.ts
tests/component-contract-query.test.ts
```

Modify `package.json` to add:

```json
"components:verify": "vitest run tests/component-contract-*.test.ts tests/component-contract-runtime-evidence.test.tsx"
```

No dependency changes.

## Index shape

Conceptually:

```json
{
  "schemaVersion": 1,
  "contractSetId": "shadcn-radix-component-contracts-001",
  "familyCount": 19,
  "families": [
    {
      "familyId": "button",
      "components": ["Button"],
      "hooks": [],
      "helpers": ["buttonVariants"]
    }
  ]
}
```

Exact family order:

lexical by `familyId`.

Export lists lexical within each kind.

The index contains no prop details.

## Loader

Deep-freeze:

```text
contract set
family contracts
interface contracts
arrays
nested facts
```

Run contract-integrity assertions before exposing data.

## Query API

Export exactly:

```ts
getComponentContractSet()

listComponentFamilies()

getComponentFamily(
  familyId: string
)

lookupComponentExport(
  familyId: string,
  exportName: string
)

getInheritedInterface(
  interfaceId: string
)

isAuthorableJsxExport(
  familyId: string,
  exportName: string
)
```

Use explicit discriminated failures:

```text
COMPONENT_FAMILY_NOT_CONTRACTED
COMPONENT_EXPORT_NOT_CONTRACTED
INHERITED_INTERFACE_NOT_CONTRACTED
```

Exact-match only.

Do not:

```text
trim
lowercase
fuzzy match
map shadcn aliases
guess family
search by display label
```

## Negative cases

At minimum reject:

```text
Button as family ID
buttonvariants
buttonVariants as JSX
useSidebar as JSX
DialogBody
dialog.body
SelectOption if not exported
case variants
whitespace variants
```

## Commit

```bash
git commit -m "feat: add component contract query index"
```

---

# Task 9 — Adversarial hardening and design-system-neutral proof

**Model:** Terra High
**Session:** start a fresh forensic Codex session.

## Files

Create:

```text
tests/component-contract-mutation.test.ts
tests/component-contract-ds-neutral.test.ts
```

Modify invariants/schema only when a failing mutation demonstrates a real gap.

## Required mutations

Prove rejection of:

```text
duplicate family ID
duplicate public export
hook marked JSX-authorable
helper marked JSX-authorable
component marked non-authorable
missing evidence reference
missing interface reference
missing token ID
primitive token dependency
spacing.17 dependency
Canvas product token dependency
duplicate local prop
local/inherited prop collision without explicit override
state channel references nonexistent value prop
state channel references nonexistent callback
conditional case references nonexistent discriminator prop
event references nonexistent prop
slot child cardinality 0..many when source says one
automatic structure references nonexistent export
hard constraint references nonexistent capability
family canonical path mismatch
family canonical blob mismatch
upstream blob mismatch
unresolved fact accidentally represented as a legal prop
index missing a family
index inventing a family
index moving hook into component list
```

## Source-drift mutations

Without editing canonical source, mutate cloned contract fixtures and prove detection for:

```text
Button variant literal
Button default
DialogContent showCloseButton default
Checkbox state prop
Accordion conditional state shape
Select export
Sidebar source hash
data-slot marker
token dependency
```

## DS-neutral synthetic fixture

Create only test fixtures in memory.

Example:

```text
family: action-button

ActionButton:
  tone = strong | quiet | critical
  density = compact | regular

helper:
  actionButtonRecipe

family: review-panel

ReviewPanel
ReviewPanelActions
```

Prove generic schema/invariants accept these names.

Also prove the schema does not require:

```text
asChild
Radix
CVA
shadcn naming
variant
size
```

This is architecture evidence, not a production contract.

## Full branch review

Use a fresh independent reviewer after mutation suite is green.

Review all changes from:

```text
6f14d8f9f5b5638ab97db009d7c164a65331dca7
```

to Phase 3 head.

No push yet.

## Commit

```bash
git commit -m "test: harden component contract integrity"
```

---

# Task 10 — Draft PR and independent Phase 3 review

**Model:** Terra High
**Session:** new independent-review session.

## Pre-PR local gate

Run fresh:

```text
npm ci
typecheck
components:verify
tokens:verify
full suite
build
npm audit --omit=dev
npm audit
snapshot integrity
git diff --check
```

All under exact Node/npm.

Required:

```text
19/19 families
contract set candidate
82-token Phase 2 contract unchanged/approved
Phase 1 snapshot green
zero vulnerabilities
```

## Push

Push:

```text
feat/phase-3-component-contracts
```

Create draft PR:

```text
Phase 3 component factual contracts review
```

PR body must explicitly say:

```text
19 component families
design-system-neutral schema
shared inherited interfaces
public export classification
Slot/asChild facts
capability composition
state channels/conditional APIs
token dependencies
rendering/accessibility facts
exact query/index
mutation hardening

Contract set remains candidate.

No usage guidance.
No executable JSX validator.
No Canvas/MCP integration.
No Phase 4+ work.
```

## Remote CI

Verify synthetic PR merge SHA.

Both:

```text
Baseline verification
Dependency security audit
```

must pass.

## Independent assistant review gate

Stop.

Do not approve/merge.

Bring the PR to the assistant for independent GitHub inspection.

---

# Task 11A — Approval transition

**Model:** Luna Medium

Only after independent Phase 3 review says PASS.

Change exactly:

```text
component-contract-set.json
status:
candidate → approved
```

Update only approval-state tests/docs.

Do not modify family facts.

Run complete verification again.

Fresh narrow reviewer compares approval commit to pre-approval head.

Push.

Wait for new PR CI.

Stop before merge.

---

# Task 11B — Merge and post-merge verification

**Model:** Luna Medium

Only after approval commit is independently reviewed.

Update stale PR body:

```text
Contract set approved after independent Phase 3 review.
```

Mark PR ready.

Merge with merge commit.

Do not squash/rebase.

Verify final `origin/main`.

Read merged contract set from `main` and prove:

```text
id = shadcn-radix-component-contracts-001
status = approved
familyCount = 19
```

Verify:

```text
approved token contract still 82 tokens + 1 spacing rule
Phase 1 historical snapshot remains approved
```

Wait for push-to-main CI.

Require:

```text
full tests green
build green
production audit 0
full audit 0
```

Only then formally close Phase 3.

Do not start Phase 4 in the same task.

---

# Phase 3 final exit gate

Phase 3 passes only if all are true:

```text
✓ exact 19-family scope
✓ every public export classified
✓ hooks/helpers never authorable JSX
✓ inherited interface registry source-pinned
✓ local props/literals/defaults source-reconciled
✓ Slot/asChild facts source/runtime reconciled
✓ capability composition coherent
✓ state channels coherent
✓ Accordion conditional APIs preserved
✓ events factual
✓ token dependencies close to approved Phase 2
✓ no fake primitive/spacings/Canvas tokens
✓ rendering identity factual
✓ structural accessibility responsibility factual
✓ important facts evidence-linked
✓ unresolved facts explicit
✓ exact immutable query boundary
✓ DS-neutral synthetic fixture passes
✓ mutation/drift suite passes
✓ source components unchanged
✓ Phase 2 approved contract unchanged
✓ Phase 1 historical snapshot green
✓ full suite/build/security green
✓ independent branch review PASS
✓ candidate → approved transition narrow
✓ merged main CI green
```
