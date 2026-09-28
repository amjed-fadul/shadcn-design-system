# Brand Blue Token Contract 002 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-28-brand-blue-token-contract-002-design.md`
**Branch:** `feat/brand-token-contract-002`, from `codex/release005-overlay-rtl` at `ca313a7`
**Toolchain:** Node 22.18.0 (`~/.nvm/versions/node/v22.18.0/bin`), npm 10.9.3

**Goal:** apply the approved brand blue through token values only, govern it as `shadcn-radix-token-contract-002`, and ship it as Release 006.

## Task 1 — Contrast floor test (red first)

- Add `tests/helpers/oklch-contrast.ts`. It parses `oklch(L C h)` (L as a number or a percentage), converts OKLCH → OKLab → linear sRGB → gamma sRGB with gamut clamping, and computes WCAG relative luminance, contrast ratio and alpha compositing.
- Add `tests/token-contract-brand-contrast.test.ts`. It reads the token contract values and asserts the four pairings from the spec at ≥ 4.5:1 in both modes. It also checks the helper against known pairs (white/black = 21, `#1447E6` on white ≈ 6.83).
- Run it against the neutral contract. The neutral values pass today, so also add an assertion that fails on neutral: `color.primary` must have chroma > 0 in both modes, which pins that a brand colour is applied.

## Task 2 — Theme values

- Change the twelve values in `src/index.css` (`:root` and `.dark`).
- Commit on its own. This commit becomes the contract's `sourceBaselineCommit`.

## Task 3 — Token contract -002 (candidate)

- `contracts/tokens/token-contract.json`: id `-002`, status `candidate`, `sourceBaselineCommit` set to the Task 2 commit, and the new values for the six tokens.
- `contracts/tokens/token-contract.schema.json`: id const → `-002`.
- `src/contracts/tokens/types.ts` and `src/contracts/tokens/index.ts`: id literal → `-002`.
- `contracts/tokens/index.json`: regenerate from `buildTokenIndex`.
- `provenance/token-contract-source.json`: the new blob SHA and baseline commit, plus the `brandLayer` record.
- Tests that pin `-001`, the old baseline commit, the old blob or `approved` status move to the new facts: token-contract canonical-source, source-provenance, schema and invariants. Where a test asserts `approved`, assert `candidate` until Task 6.

## Task 4 — Component contract references

- `contracts/components/component-contract-set.json`: `tokenContractId` → `-002`.
- 38 `contracts/components/families/*.json`: `evidence.tokens.source` → `-002`.
- `provenance/component-contract-source.json` and `tests/component-contract-source-provenance.test.ts`: the token contract reference → `-002`.
- Regenerate any derived provenance that hashes those files (seed provenance, index) with the existing scripts, and confirm that no component facts change.

## Task 5 — Verify (pre-approval)

- `npm run typecheck`, `npm run test`, `npm run build`, `npm run test-storybook` (axe gate with the new colours), `npm run build-storybook`.
- Tests that need an approved token contract (executable projection and release) are expected to fail only with `EXECUTABLE_TOKEN_CONTRACT_NOT_APPROVED`. Record the exact list. Fix every other failure.
- Commit, push and open a PR against `codex/release005-overlay-rtl`. Then ask the owner to approve contract `-002`.

## Task 6 — Approval and Release 006 (after owner approval)

- Flip `-002` to `approved` and update the status assertions.
- `package.json` / `package-lock.json` version → `0.0.0-release.6`.
- `scripts/run-release-generation.mjs`: release id `006`, add `"005"` to `preservedReleaseHashes`, and require version `0.0.0-release.6`.
- `npm run release:generate` twice; both outputs must be identical.
- Update `tests/executable-release.test.ts` to the `-002` token contract id and the Release 006 facts.
- `npm run candidate:generate` → `~/.artifacts/shadcn-design-system/shadcn-radix-release-006/`, then `npm run candidate:verify` and `npm run release:verify`.
- Write `docs/CANVAS-RELEASE-006.md` with the token changes, identities and verification.
- Re-run the full Task 5 gate, commit and push.
