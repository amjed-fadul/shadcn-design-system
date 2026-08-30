# Contracted shadcn Design System Master Plan

**Goal:** Build a governed, pinned shadcn design-system repository that Canvas can consume, then use it to build the real Design System Studio UI as a real-product validation of Canvas.

## Global constraints

- Official shadcn is upstream/reference only.
- This repository is the canonical governed DS implementation.
- Match the current Canvas shadcn implementation: `radix-nova`, Radix base, Tailwind 4, neutral base, CSS variables, Lucide.
- Start only with tokens/components/patterns required by Studio V1.
- Keep factual contracts, usage knowledge, and executable rules separate.
- Never invent unsupported props, variants, tokens, composition, or patterns.
- Canvas consumes exact release identities, never mutable `main`/`latest`.
- Studio UI is the workload; Canvas is the validation target.

## Phase 1 — Canonical shadcn DS foundation

Create a reproducible standalone baseline, freeze theme/token source, add the Studio seed component set, and generate an immutable baseline snapshot.

**Exit:** fresh clone installs, typechecks, builds, representative components render, and `shadcn-radix-bootstrap-000` verifies without mutable upstream source.

## Phase 2 — Token contracts

Create machine-readable factual contracts for semantic colors, light/dark mappings, typography, radius, spacing, border, shadow, and primitive-to-semantic relationships that actually exist.

**Exit:** the agent can query allowed token vocabulary and cannot legally invent governed tokens/raw values where forbidden.

## Phase 3 — Component factual contracts

Contract evidence-backed props, supported values, defaults, sub-components, legal composition, state facts, events, token dependencies, rendering identity, and structural accessibility facts.

**Exit:** valid vs invalid component usage can be decided without prose or model inference.

## Phase 4 — Patterns + usage knowledge

Add Studio-driven patterns and human-authored knowledge: when/when-not, option meaning, composition intent, writing guidance, accessibility intent, related/use-instead.

**Exit:** the agent can make appropriate product-design choices, not merely syntactically valid JSX.

## Phase 5 — Executable contract + release snapshot

Enforce component/prop/token/composition/pattern rules, repairable errors, rendering bindings, dependency closure, and exact release identity. Produce approved Bootstrap Release `shadcn-radix-bootstrap-001`.

**Exit:** illegal DS usage is rejected or repairable before it can appear as successful governed Canvas output.

## Phase 6 — Connect to Canvas and build Studio V1

Use the real Studio V1 product requirements to build the Studio UI through agent → contracted DS → MCP/governance → Canvas.

Evaluate Canvas on component retrieval/choice, DS compliance, multi-screen work, follow-up edits, iteration quality, validator repair, missing Canvas capabilities, and factual-vs-usage knowledge gaps.

**Non-goal:** validating Studio's production governance backend.

**Exit:** real Studio UI exists in Canvas, plus concrete evidence of Canvas strengths, failures, and smallest next product changes.
