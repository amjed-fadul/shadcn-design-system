# Canvas portal container release 002

User-approved scope: expose an optional `portalContainer` on SelectContent and DialogContent, forwarding to each wrapper's internal bundled Radix Portal. Omission preserves body placement. No Canvas changes, remote publication, or changes to accepted release001 artifacts. The user subsequently authorized the exact existing SelectTrigger native labeling facts: id, aria-label, aria-labelledby.

1. Prove missing Element/DocumentFragment containment with real DOM tests using public compound exports.
2. Add the two optional APIs; reconcile exact factual TypeScript types, canonical source hashes and provenance. DOM containers remain nonserializable environment values, not authored values.
3. Advance the active release/package to shadcn-radix-release-002 / 0.0.0-release.2. Keep release001 and its distribution record byte-for-byte. Update only current-release guards/tests.
4. Verify source, contracts, public declarations, package build, packed bundled contexts and portal containment/default behavior.
5. Generate and independently verify a new external artifact and immutable manifest; record hashes and source commit, then commit locally. No push.

Verification evidence is retained under /tmp/canvas-portal-release-002; the final handoff records exact artifact identities and limitations.

Completed verification: 751 unit tests, 3 focused Storybook Chromium tests, TypeScript, independent packed-candidate verification, and final exact-tarball Chromium portal/labeling proof. The final handoff and immutable manifest are recorded in docs/CANVAS-PORTAL-RELEASE-002.md and provenance/distributions/.
