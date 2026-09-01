# Phase 3 Task 9 repair findings

The adversarial suite in `tests/component-contract-mutation.test.ts` establishes two production gaps that require a repair-stage change:

1. `ComponentInvariantAuthority` has no capability registry, and `validateComponentFamilyInvariants` does not resolve `composition.requires`, `composition.provides`, or `composition.hardConstraints`. An invented capability therefore validates successfully.
2. Slot cardinality is structurally checked only for `max < min`. Exact cardinality is a source fact, so it must be reconciled by source-specific analysis outside the generic schema/invariant core. No such production comparison currently exists; changing `1..1` to `0..many` validates successfully.

The component loader also deliberately contains canonical 19-family manifest and shadcn provenance checks. Those are valid source-scope protections, not generic contract-core behavior; a future reusable loader/query constructor must keep those scope checks at the source boundary rather than importing them into schemas or invariants.
