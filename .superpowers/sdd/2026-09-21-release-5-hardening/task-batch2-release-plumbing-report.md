# Batch 2 release plumbing report

Base: `f77976e` (`codex/release5-hardening`)

## Implemented

- Promoted the knowledge manifest to the exact canonical 38-family inventory.
- Added canonical knowledge-loader parity enforcement and an opt-in unused-reference gate; the canonical loader enables that gate.
- Added equality/evidence tests covering all 38 component subjects and all 47 registered references.
- Generated and activated `shadcn-radix-release-002` with 38 unique family IDs and exact canonical export parity.
- Preserved `provenance/releases/shadcn-radix-release-001.json` byte-for-byte. Its file SHA-256 remains `1f9274c16ba625cf02096a6b8bb6da570762a16296da8624daa7475db3a89370`.
- Generated release 002 twice; the generated file digest was identical on both runs (`047d07e612e81e95fbe72e6af743050da3debc87441b3c53d15fe7c4fe1e36a4`).
- Replaced component-specific CI diagnostics with blocking release-wide install, typecheck, test, build, Storybook, production-audit, and full-audit sequences. Removed typecheck allowlists and all `continue-on-error` usage.

## Verification

All commands used Node `22.18.0` via `/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin`.

- `npm test -- tests/knowledge-contracts.test.ts` — **30 passed**.
- `npm test -- tests/component-contract-query.test.ts tests/component-contract-inventory.test.ts tests/component-contract-loader-scope.test.ts` — **18 passed**.
- `npm test -- tests/executable-contract-19-families.test.ts tests/executable-release.test.ts tests/release-5-workflows.test.ts` — **37 passed** on the focused run after the workflow assertion fix.
- `npm run typecheck` — passed.
- Deterministic release generation — passed (two generated outputs had identical SHA-256).

The final consolidated Batch 2 gate should rerun the focused release/workflow tests, typecheck, application build, Storybook tests/build, and both audits once after the cohesive commit.

## Audit/network limitation

Both `npm audit --omit=dev` and `npm audit` require the npm registry audit endpoint. In this sandbox they fail before returning an audit report:

```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
npm error audit endpoint returned an error
```

No dependency upgrades were made because the audit result is unavailable and broad upgrades are out of scope.
