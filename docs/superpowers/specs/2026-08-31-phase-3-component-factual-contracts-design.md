# Phase 3 — Component Factual Contracts Design

**Target repository:** `amjed-fadul/shadcn-design-system`
**Starting `main`:** `6f14d8f9f5b5638ab97db009d7c164a65331dca7`
**Approved token contract:** `shadcn-radix-token-contract-001`
**Seed scope:** 19 component families

## Goal

Create a design-system-neutral, machine-readable factual component-contract layer that can answer:

> What components and public APIs actually exist, and what usage is factually legal?

Phase 3 must not answer:

> Which component should the designer choose?

That belongs to Phase 4.

Phase 3 must not yet enforce generated Canvas code.

That belongs to Phase 5.

---

# 1. Scope

Contract exactly the 19 component families already pinned by Phase 1:

1. button
2. badge
3. input
4. separator
5. skeleton
6. card
7. textarea
8. checkbox
9. table
10. label
11. tabs
12. select
13. dropdown-menu
14. accordion
15. dialog
16. sheet
17. tooltip
18. scroll-area
19. sidebar

Do not add new shadcn components during Phase 3.

Do not modify their implementations merely to simplify contracts.

If contract work discovers a genuine implementation/provenance defect, stop and report it separately.

---

# 2. Design-system neutrality

The schema must not encode shadcn-specific component names, props, Radix names, or conventions.

The same schema must be able to describe a future private design system such as:

```text
ActionButton
tone = critical | quiet

ReviewPanel
ReviewPanelActions

ChoicePicker
optionId
```

without schema changes.

Shadcn is the first real contract instance, not the architecture.

A synthetic non-shadcn fixture will be used before Phase 3 closes to prove this.

The real private anti-prior design system will be created later as validation evidence, not as part of Phase 3 production scope.

---

# 3. Evidence hierarchy

Every factual contract entry must be grounded in evidence.

Authority order:

```text
1. canonical checked-in component source
2. pinned inherited React / Radix interface
3. focused runtime evidence
4. unresolved
```

External shadcn documentation, UX Components, blogs, examples, or model knowledge may not define legal Phase 3 API facts.

If a fact cannot be established reliably:

```text
unresolved
```

Never infer or guess it.

---

# 4. Static contracts, independent reconciliation

Phase 3 does not build the future Design System Studio automatic extractor.

Contracts are committed static JSON artifacts.

Tests independently analyze canonical TypeScript/TSX sources and pinned package declarations and reconcile the static contracts.

This follows the same anti-false-success principle as Phase 2:

```text
static artifact
        versus
independently extracted evidence
```

Do not generate the production contract dynamically during tests and compare it to itself.

---

# 5. Contract-set architecture

Create one component-contract set manifest:

```text
contracts/components/component-contract-set.json
```

Conceptual shape:

```json
{
  "schemaVersion": 1,
  "id": "shadcn-radix-component-contracts-001",
  "status": "candidate",
  "designSystemId": "shadcn-radix-bootstrap",
  "sourceBaselineCommit": "6f14d8f9f5b5638ab97db009d7c164a65331dca7",
  "tokenContractId": "shadcn-radix-token-contract-001",
  "familyCount": 19,
  "familyFiles": [],
  "interfaceFiles": []
}
```

Approval occurs at the contract-set level so final Phase 3 approval can remain a narrow:

```text
candidate → approved
```

transition.

Family contracts do not independently carry approval state.

---

# 6. One file per component family

Store:

```text
contracts/components/families/button.json
contracts/components/families/badge.json
...
contracts/components/families/sidebar.json
```

Each family contains:

```text
identity
source provenance
public exports
component definitions
evidence references
unresolved facts
```

Do not create one enormous 19-family JSON file.

---

# 7. Public export classification

Record every public module export.

Each export is classified as exactly:

```text
component
hook
helper
```

And carries:

```text
authorableJsx: true | false
```

Rules:

```text
component → authorableJsx = true
hook      → authorableJsx = false
helper    → authorableJsx = false
```

Examples:

```text
Button          → component
buttonVariants  → helper

Sidebar         → component
SidebarTrigger  → component
useSidebar      → hook
```

A future validator must therefore never confuse a hook/helper with JSX.

---

# 8. Shared inherited-interface registry

Do not duplicate the full inherited React/Radix API into every component.

Create shared interface contracts such as:

```text
html.button
html.input
html.textarea
html.div
html.table
...

radix.dialog.root
radix.dialog.trigger
radix.dialog.content
radix.checkbox.root
radix.tabs.root
radix.select.root
...
```

Component definitions reference these interfaces.

Example:

```text
Button
inherits:
  html.button
```

Dialog:

```text
Dialog
inherits:
  radix.dialog.root
```

The registry must be generated as static evidence artifacts and independently reconciled to the pinned packages:

```text
@types/react 18.3.3
radix-ui 1.6.7
typescript 5.5.4
```

Do not add dependencies to accomplish this.

Use the existing TypeScript compiler API.

---

# 9. Inherited prop representation

Each inherited interface records:

```text
prop name
required / optional
exact TypeScript type text
structured type when reliably classifiable
evidence
```

Structured type may be one of:

```text
boolean
string
number
literal
literal-union
string-array
boolean-or-indeterminate
react-node
callback
typescript
unresolved
```

Complex inherited types may remain:

```text
kind: typescript
typeText: "..."
```

Do not invent a simplified semantic type if the checker cannot establish one safely.

The exact prop name still remains factual and usable for future legality checks.

---

# 10. Local props

Local component props are recorded separately from inherited props.

Examples:

```text
Button
local:
  variant
  size
  asChild

DialogContent
local:
  showCloseButton

SidebarProvider
local:
  defaultOpen
  open
  onOpenChange

SidebarMenuButton
local:
  asChild
  isActive
  variant
  size
  tooltip
```

For local props contract:

```text
name
required
type
allowed literals where factual
default where factual
evidenceRefs
```

---

# 11. CVA variants

CVA-powered variants are factual public APIs.

For example Button must record exact source-derived values:

```text
variant:
  default
  outline
  secondary
  ghost
  destructive
  link

size:
  default
  xs
  sm
  lg
  icon
  icon-xs
  icon-sm
  icon-lg
```

and defaults:

```text
variant = default
size = default
```

Do not derive variant names from shadcn documentation.

Use canonical CVA source.

---

# 12. Slots and `asChild`

Slot composition is first-class contract data.

A component that supports slot delegation records:

```text
prop name
default
host replacement behavior
child cardinality
prop forwarding
ref forwarding status
required child capabilities
evidence
```

Conceptual example:

```text
Button

slot:
  prop: asChild
  default: false
  replacesHost: true
  childCardinality:
    min: 1
    max: 1
  forwardsProps: true
  childRequires:
    interactive-host
```

For inherited Radix `asChild`, the family contract must make the inherited slot behavior visible rather than relying on the agent to know Radix.

If ref-forwarding semantics cannot be proved reliably, mark that sub-fact unresolved.

---

# 13. Capability-based composition

Do not encode documentation example trees as rigid legal trees.

Use capabilities.

Components may:

```text
provide capabilities
require capabilities
```

Example:

```text
Dialog
provides:
  dialog.context

DialogTrigger
requires:
  dialog.context

DialogContent
requires:
  dialog.context
provides:
  dialog.content

DialogTitle
requires:
  dialog.content
provides:
  dialog.title

DialogDescription
requires:
  dialog.content
provides:
  dialog.description
```

This allows:

```jsx
<DialogContent>
  <div>
    <DialogTitle />
  </div>
</DialogContent>
```

when structurally legal.

Do not falsely require `DialogTitle` to be a direct child of `DialogHeader`.

Hard direct-parent/direct-child rules are allowed only when the source or primitive truly imposes them.

---

# 14. State channels

Related props must be modeled as one state channel rather than unrelated prop names.

Example Checkbox:

```text
state: checked

controlled:
  checked
  onCheckedChange

uncontrolled:
  defaultChecked

values:
  true
  false
  indeterminate
```

Tabs:

```text
state: selected-value

controlled:
  value
  onValueChange

uncontrolled:
  defaultValue
```

Dialog/Sheet:

```text
state: open

controlled:
  open
  onOpenChange

uncontrolled:
  defaultOpen
```

This data is factual API structure, not usage advice.

---

# 15. Conditional API cases

Some APIs change shape based on another prop.

Accordion is the canonical example.

Conceptually:

```text
when type = single:
  value: string
  defaultValue: string
  onValueChange(value: string)

when type = multiple:
  value: string[]
  defaultValue: string[]
  onValueChange(value: string[])
```

Represent conditional cases explicitly.

Do not flatten them into a misleading union that allows illegal combinations.

---

# 16. Events

Record factual callbacks and event value shapes.

Examples:

```text
onOpenChange
onValueChange
onCheckedChange
onClick
```

Events already contained in inherited interfaces need not be duplicated as local props.

State callbacks may point to their state channel.

No Phase 4 behavioral advice belongs here.

---

# 17. Token dependencies

Component token dependencies resolve only against the approved:

```text
shadcn-radix-token-contract-001
```

Do not turn every Tailwind utility into a design token.

For example:

```text
bg-primary
  → color.primary

text-primary-foreground
  → color.primary-foreground

rounded-md
  → radius.md

text-sm
  → font-size.sm

font-medium
  → font-weight.medium
```

But:

```text
inline-flex
justify-center
whitespace-nowrap
shrink-0
```

do not become invented design tokens.

Spacing utilities may reference:

```text
spacing.unit
```

with factual use of the approved:

```text
spacing.multiplier
```

derivation rule.

Do not manufacture `spacing.4`, `spacing.17`, etc.

---

# 18. Conditional token dependencies

Where source makes the relationship factual, token dependencies should preserve option/state conditions.

Example:

```text
Button.variant.default
  → color.primary
  → color.primary-foreground

Button.variant.destructive
  → color.destructive

Button.variant.outline
  → color.border
  → color.background
```

This supports accurate future Studio controls and token inspection.

Do not infer product/design intent from these dependencies.

---

# 19. Rendering identity

Record structural rendering facts such as:

```text
default host
delegated/slotted host behavior
data-slot
data-variant
data-size
relevant data-state markers
portals
automatic wrappers
automatic children
```

Example Button:

```text
default host:
  button

data-slot:
  button

data-variant:
  variant

data-size:
  size
```

Example DialogContent:

```text
portal:
  true

automatic structure:
  DialogPortal
  DialogOverlay

conditional automatic child:
  DialogClose when showCloseButton = true
```

These facts later support Canvas inspection and provenance.

---

# 20. Structural accessibility facts

Phase 3 records structural accessibility facts only.

Possible responsibility owners:

```text
native
component
inherited-primitive
author
```

Examples:

Button:

```text
semantic role:
  owner = native
  mechanism = button host

accessible name:
  owner = author
```

Dialog:

```text
focus management:
  owner = inherited-primitive

title relationship:
  owner = author
  mechanism = DialogTitle
```

Do not turn Phase 3 into accessibility usage guidance.

No copywriting guidance belongs here.

---

# 21. Evidence references

Important facts reference evidence IDs.

Evidence kinds:

```text
canonical-source
inherited-interface
runtime-test
token-contract
```

Example:

```text
showCloseButton:
  default: true
  evidenceRefs:
    - dialog.source.showCloseButton
```

Evidence entries contain enough identity to answer:

> Why do we believe this?

Do not embed large source excerpts in the contract.

---

# 22. Unresolved facts

Every family has:

```text
unresolved: []
```

An unresolved entry records:

```text
topic
scope
reason
evidence attempted
```

Unresolved never means allowed.

Future Phase 5 must treat unresolved facts conservatively.

---

# 23. Rendering/runtime evidence

Use focused runtime evidence only where source/type evidence is insufficient.

High-value evidence includes:

```text
Button asChild host delegation
Dialog portal behavior
Dialog automatic close control
Checkbox state
Tabs state switching
Accordion single/multiple behavior
Select trigger/content/item relationship
Tooltip trigger/content
Sheet portal/open behavior
Sidebar controlled state
Sidebar mobile Sheet
Sidebar keyboard shortcut
```

Reuse Phase 1 tests where they already prove the fact.

Do not duplicate tests purely for appearance.

---

# 24. Agent-facing index and query boundary

Create a compact component index for discovery.

It exposes:

```text
19 family IDs
public component export names
hook names
helper names
contract-set identity
```

It does not duplicate full props or contracts.

Create an exact-match query API:

```text
getComponentContractSet()
listComponentFamilies()
getComponentFamily(familyId)
lookupComponentExport(familyId, exportName)
getInheritedInterface(interfaceId)
isAuthorableJsxExport(familyId, exportName)
```

No fuzzy matching.

No normalization.

No alias guessing.

No shadcn-memory fallback.

Runtime data is deeply frozen.

---

# 25. Phase 3 invariants

At minimum reject:

```text
duplicate family IDs
duplicate export names inside a family
unknown export kind
hook/helper marked authorable JSX
component marked non-authorable JSX
missing evidence references
missing inherited-interface references
missing token IDs
unknown derived token rules
missing capability providers where a hard contract requires them
duplicate local props
local prop conflicting with inherited prop without explicit override
invalid state-channel prop references
invalid conditional-case prop references
invalid event prop references
invalid automatic-structure export references
invalid family source provenance
unresolved facts accidentally represented as legal facts
```

Do not encode Phase 5 generated-JSX validation here.

These are contract-integrity invariants.

---

# 26. Design-system-neutral adversarial fixture

Before Phase 3 closes, schema/invariant tests must validate a synthetic unfamiliar family such as:

```text
action-button
review-panel
choice-picker
```

The fixture must use names and APIs that conflict with shadcn conventions.

Example:

```text
ActionButton
tone = strong | quiet | critical
density = compact | regular
```

The fixture proves:

```text
schema does not hardcode shadcn
invariants do not hardcode Radix
query/index infrastructure is generic
```

It is test evidence only.

Do not add the synthetic components to the production shadcn contract set.

---

# 27. Anti-prior product validation

Do not claim Phase 3 proves the overall agent-contract approach.

Later validation requires four layers:

```text
A. real shadcn Studio build
B. prior-conflict shadcn/local cases
C. private unfamiliar design system
D. validator rejection + repair
```

That validation happens after the executable contract/Canvas integration exists.

---

# 28. Non-goals

Phase 3 does not include:

```text
when-to-use guidance
when-not-to-use guidance
writing guidance
product/design recommendations
pattern intent
Canvas integration
MCP integration
generated JSX enforcement
repair messages
component recommendation
fuzzy component search
private anti-prior DS implementation
Studio GitHub extractor
Phase 4 knowledge
Phase 5 executable validator
Phase 6 Studio build
```

---

# 29. Completion gate

Phase 3 is complete only when:

```text
19/19 seed families contracted
all public exports classified
shared inherited interfaces reconciled
all local variants/defaults reconciled
slot facts reconciled
composition capability model populated
state channels populated
conditional cases populated
token dependencies close against Phase 2
rendering/a11y facts have evidence
unresolved facts explicit
index/query exact and immutable
DS-neutral synthetic fixture passes
mutation/drift suite passes
historical Phase 1 snapshot remains green
approved Phase 2 token contract remains unchanged
full test suite passes
build passes
both audits are zero
independent full-branch review passes
contract set moves candidate → approved only after review
post-merge main CI passes
```
