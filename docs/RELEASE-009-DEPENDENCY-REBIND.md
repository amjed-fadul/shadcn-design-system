# Release 009 dependency rebind

The follow-up to PR #16 resolves the Moderate dev-only Hono advisory [GHSA-hxh3-vqpv-xpqv](https://github.com/advisories/GHSA-hxh3-vqpv-xpqv).

## Exact scope

Pinned Node 22.18.0 / npm 10.9.3 resolved Hono through the existing transitive range using `npm update hono --package-lock-only --ignore-scripts --no-fund --no-audit`, followed by `npm ci --ignore-scripts --no-fund --no-audit`.

Only the `node_modules/hono` lockfile record changes: **4.13.5 → 4.13.12**, with its registry URL and integrity updated by npm. The chain remains `shadcn@4.19.0 → @modelcontextprotocol/sdk@1.30.0 → hono`; `@hono/node-server@2.1.1` shares the same deduplicated Hono. No direct dependency, package.json, override or unrelated lockfile resolution changes.

Release 009 was regenerated using the existing `npm run release:generate` producer. Its only changed implementation input is package-lock.json. The release projection, public package identity, all other 363 implementation inputs, component source, contracts, knowledge, visual decisions and public APIs remain unchanged.

## Verification

- `npm audit --omit=dev`: zero vulnerabilities, exit 0.
- `npm audit`: zero vulnerabilities, exit 0.
- `npm run typecheck`: passed.
- Six focused release/canonical-binding/preservation test files: **43 passed**.
- Focused package-input identity checks: **11 passed**, 21 unrelated checks deliberately skipped.
- `git diff --check`: passed.
- New release payload/projection/input verification: passed.
- Exact clean candidate rebuild: passed; tarball bytes, SHA-256, SHA-512 integrity and all **56 packed files** match the independently retained producer anchors. No expectations refreshed.
- Compared with the accepted visual-system candidate, only packed `dist-library/release.js` changes. Public declarations, CSS and every other packed file remain byte-identical.

The prior 1551-unit / 224-Storybook / 52-state visual qualification and zero Critical/Important independent review remain evidence for the unchanged component system. They were not repeated for this dev-only dependency rebind; that review approved the earlier candidate identities, not the new dependency-bound payload.

## New final candidate

Version remains `0.0.0-release.9`.

| Identity | SHA-256 |
| --- | --- |
| Payload | `72a02491e9cda0ee8f41c4bc586090aa987b8a522a8c2b1f211445296e15dda8` |
| Distribution manifest | `17aae4c25106dfe45dbb6628b9e3b0d8ba0675ea0a5747696a5a8aa2af3414bb` |
| Candidate tarball | `c1d37aa805fe4eb9ca94c945ca55f21440bdc79be2965c4c87478619496b1739` |

External candidate directory: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-009-density-dependency-rebind`. It retains distribution-manifest.json, the tarball, candidate-anchor.json, clean-rebuild-verification.log, production-audit.log and full-audit.log. These external files are excluded from Git.

## Preservation

All 13 guarded historical repository artifacts, including the frozen R7 release/distribution records and retained R8 executable record, remain byte-for-byte exact. Accepted R7 and R8 external manifests/tarballs were hash-checked unchanged. The original accepted R9 visual-system candidate and its qualification documents remain retained separately, with their original identities.

Inherited Drawer React 18 ref warning remains Minor and deferred; this rebind changes no runtime component behavior. PR #16 remains unmerged.
