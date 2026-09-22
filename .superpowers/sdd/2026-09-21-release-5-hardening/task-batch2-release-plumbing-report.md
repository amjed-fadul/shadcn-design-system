# Batch 2 release plumbing report

Base: `f77976e` (`codex/release5-hardening`)

## Implemented

- Promoted the knowledge manifest to the exact canonical 38-family inventory.
- Added canonical knowledge-loader parity enforcement and an opt-in unused-reference gate; the canonical loader enables that gate.
- Added equality/evidence tests covering all 38 component subjects and all 47 registered references.
- Generated and activated `shadcn-radix-release-002` with 38 unique family IDs and exact canonical export parity.
- Preserved `provenance/releases/shadcn-radix-release-001.json` byte-for-byte. Its file SHA-256 remains `1f9274c16ba625cf02096a6b8bb6da570762a16296da8624daa7475db3a89370`.
- Generated release 002 twice after the corrective evidence closure; the generated file digest was identical on both runs (`087b922035091ed4f89be30e551a8a9ee911afdeae2a14184767e312794a1ff6`).
- Replaced component-specific CI diagnostics with blocking release-wide install, typecheck, test, build, Storybook, production-audit, and full-audit sequences. Removed typecheck allowlists and all `continue-on-error` usage.

## Verification

All commands used Node `22.18.0` via `/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin`.

- `npm test -- tests/knowledge-contracts.test.ts` — **30 passed**.
- `npm test -- tests/component-contract-query.test.ts tests/component-contract-inventory.test.ts tests/component-contract-loader-scope.test.ts` — **18 passed**.
- `npm test -- tests/executable-contract-19-families.test.ts tests/release-5-workflows.test.ts` — **23 passed** (20 executable-family tests, 3 workflow-policy tests, including adversarial mutations).
- `npm test -- tests/executable-release.test.ts tests/executable-release-validator.test.ts` — **35 passed**.
- `npm run typecheck` — passed.
- Deterministic release generation — passed (two generated outputs had identical SHA-256).

## Corrective review closure (897e0aa..current)

- Replaced the blanket unresolved-fact allowance with exact zero-error assertions for every authorable export, plus an explicit eight-export policy for the single documented `vaul.drawer.root` snap-point/fade conditional limitation.
- Removed stale full-intrinsic unresolved notices only after source evidence reconciliation; modeled `FieldError`'s `useMemo` child expression generically in the JSX source analyzer and added a regression test proving no unresolved finding remains.
- Added a reusable workflow-policy validator and adversarial fixtures for `continue-on-error`, allowlists, `set +e`, status swallowing, `|| true`, `if: always()`, missing/out-of-order commands, missing Chromium installation, and unknown npm scripts.
- `npm test -- tests/knowledge-contracts.test.ts` — **30 passed**.
- Final focused Batch 2 gate: `npm test -- tests/knowledge-contracts.test.ts tests/executable-contract-19-families.test.ts tests/executable-release.test.ts tests/executable-release-validator.test.ts tests/release-5-workflows.test.ts` — **88 passed across 5 files**.
- `npm run typecheck` — passed after the corrective changes.
- `sha256sum provenance/releases/shadcn-radix-release-001.json` — unchanged at `1f9274c16ba625cf02096a6b8bb6da570762a16296da8624daa7475db3a89370`.
- `git diff --check` — clean before commit.

## Audit/network limitation

Both `npm audit --omit=dev` and `npm audit` require the npm registry audit endpoint. The initial Batch 2 attempt in this sandbox failed before returning an audit report:

```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org
npm error audit endpoint returned an error
```

No dependency upgrades were made because the audit result is unavailable and broad upgrades are out of scope.
