# Phase 5 Task 1 — Executable Contract + Validator Architecture

**Starting `main`:** `b215a4015021e0a501def2e13bd6835419699a94`

**Scope:** executable projection, design-system-neutral authored input, structured validation results, validation flow, and a small vertical proof. This task does not implement the full 19-family validator, Canvas integration, repair automation, or a release snapshot artifact.

## 1. Authority and boundaries

Phase 3 approved component factual contracts and Phase 2 approved token contracts are the only factual authorities. The Phase 5 validator imports neither Phase 4 knowledge artifacts nor Phase 4 query APIs. The validator never treats advisory usage guidance as an error.

The executable contract is a deterministic projection of the already-loaded contracts. It is not a second hand-maintained JSON authority. Projection code may reshape and index facts, but it may not add component names, prop names, values, capabilities, tokens, or composition rules.

The projection is design-system-neutral. Canonical shadcn loading is configured at the existing Phase 3 loader boundary; the projection and validator accept any compatible loaded contract set, including a fictional test design system.

## 2. Executable projection

`projectExecutableContract` consumes a loaded Phase 3 contract set and a Phase 2 token contract. It verifies that both authorities are approved and that the component set names the same token contract. It derives:

- exact qualified export identities and JSX-authorability;
- effective public props from local plus inherited interfaces;
- conditional branch shapes using the existing Phase 3 `resolveConditionalApiShape` fact resolver;
- event and state-channel facts;
- Slot facts, composition capabilities, and token vocabulary;
- unresolved facts associated with each family/export;
- contract-set and token-contract release identities.

All projected arrays, records, and nested values are deeply frozen. A source with unresolved factual entries remains represented, but validation of a node that depends on that unresolved source emits an explicit unresolved-fact error. A projection with unsupported or mismatched authority fails closed before authored validation.

## 3. Authored input

The validator consumes a small neutral tree rather than JSX, React elements, or Canvas nodes. Components carry an exact family/export reference, props, children, and a location. Intrinsic nodes are structural wrappers only. Text nodes preserve child shape for Slot checks. Values distinguish literals from callbacks and unresolved expressions; unresolved expressions never silently pass.

Token uses are separate located facts so token legality is independent of styling syntax and Canvas representation.

## 4. Errors and flow

`validateAuthoredUi` returns `{ ok, errors }` with deterministic depth-first error ordering. Errors have stable codes, factual messages, a target/location, an expected fact, the received value when representable, and optional factual repair information. This task emits no repair unless a future rule has exactly one unambiguous factual correction.

The walk performs exact export resolution, authorability checks, branch selection, required/unknown prop checks, literal type/value checks, conditional availability checks, state-channel conflict checks, Slot cardinality/element-child checks, capability checks through ancestor context, token vocabulary checks, and explicit unsupported/unresolved checks. It enforces only facts available in the projection.

## 5. Release snapshot proposal

Later Phase 5 work will serialize a canonical snapshot payload containing the release ID, projection schema version, component-contract-set ID, token-contract ID, source baselines, and the projected executable graph. The immutable artifact will be addressed by an exact release ID, for example `provenance/releases/shadcn-radix-release-001.json`.

The SHA-256 is computed over the canonical snapshot payload excluding the `sha256` field itself. Loading verifies the exact release ID, payload hash, source/contract identities, and deep immutability. Production validation will consume only that exact release snapshot; tests may construct projections directly.

## 6. Proof boundary

Focused tests prove legal and illegal Button usage, Accordion single/multiple branch legality, Dialog capability plus Slot facts, Sidebar capability context, and one neutral fictional family. Existing Phase 2–4 files and artifacts remain unchanged.
