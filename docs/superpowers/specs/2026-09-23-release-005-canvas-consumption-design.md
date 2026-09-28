# Release 005 Canvas consumption design

## Purpose

Make the completed 38-family Release 5 contract work consumable by the current Agentic Design Canvas without changing which components agents can place. Canvas must be able to inspect every shipped factual contract and token fact through its existing registry and MCP reads.

## Release lineage and identity

Release 005 joins three producer histories: the accepted Checkbox/Label Release 004 source used by the newer Canvas branch, the Sidebar Release 004 source, and `codex/release5-hardening`. The two Release 004 lines and the hardening line each have immutable artifacts with colliding names but different bytes. The merge keeps the accepted historical release artifacts and archive bytes unchanged; the newly reconciled source creates `shadcn-radix-release-005` and package `@adc/shadcn-design-system@0.0.0-release.5`. No historical artifact is relabeled.

The new release has the exact canonical family and export inventory, approved factual contracts, source provenance, package identity, implementation manifest, deterministic payload hash, distribution manifest, tarball SHA-256, and npm integrity. Public package entrypoints remain root components, `styles.css`, and `release`. React and React DOM peer versions stay 18.3.1; Node stays 22.18.0.

## Canvas boundary

Canvas vendors the verified Release 005 tarball and pins its exact version and integrity in `canvas`, `design-system-registry`, and `semantic-renderer`. The connected registry verifies the exact release identity and builds factual records for every release export. MCP factual queries can retrieve the new records. The connected snapshot changes because package facts changed.

Canvas authoring policy, semantic model, renderer adapters, and reviewed guidance remain independently versioned. Existing supported components continue to work. Newly shipped exports without an approved Canvas policy remain queryable but nonselectable and cannot be persisted or rendered as authored nodes. No new authorability is implied by `authorableJsx` in the producer artifact.

## Verification

The producer proves canonical contract parity, typecheck, unit tests, library build, public declarations, deterministic release generation, exact archive metadata, historical artifact hashes, and isolated package consumption. Canvas proves three-package pin/integrity parity, release hash/schema validation, all 38 families present in factual queries, unsupported new families rejected for authoring, existing governed behavior unchanged, and relevant package typecheck/tests. The final record states any environment-blocked gates explicitly.
