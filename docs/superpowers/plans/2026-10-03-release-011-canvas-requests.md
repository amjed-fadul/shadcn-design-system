# Release 011 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-03-release-011-canvas-requests-design.md`
**Branch:** `worktree-release-011-candidate`, from `origin/main` at `9dca721` (Release 010)
**Toolchain:** Node 22.18.0 (`~/.nvm/versions/node/v22.18.0/bin`), npm 10.9.3, 4 GB Node heap

**Goal:** add status colours, a coloured chart palette, `radius.full` and `line-height.display` as token
contract `-003`, extend Badge, Alert, Icon and Avatar, and produce a Release 011 candidate for owner review.

## Task 1 — Red tests

- `tests/token-contract-status-contrast.test.ts`: status text, tint and foreground floors from contract values.
- `tests/token-contract-chart-palette.test.ts` with `tests/helpers/cvd.ts`: band, chroma, non-text contrast,
  adjacent protan/deutan/normal separation including the 5 → 1 wrap.
- `tests/release-011-components.test.tsx`: Badge, Alert, Avatar and Icon additions through the public package.
- Observe them fail on Release 010.

## Task 2 — Theme values

- `src/index.css`: six status colours in `:root` and `.dark`, five chart values, `@theme inline` aliases,
  `--radius-full` and `--leading-display`.
- Commit on its own; this commit becomes the contract's `sourceBaselineCommit`.

## Task 3 — Token contract -003 (candidate)

- `contracts/tokens/token-contract.json`: id `-003`, status `candidate`, eight new tokens, five chart values,
  new `sourceBaselineCommit`.
- Schema, types and index literals → `-003`; regenerate `contracts/tokens/index.json`.
- `provenance/token-contract-source.json`: new theme blob and a `release011Layer` record of palette origins
  and floors.
- Canonical token analyzer: map the six status colour utilities and `leading-display`.
- Tests that pin `-002`, the baseline commit, counts or category shapes move to the new facts.

## Task 4 — Component contract references

- `contracts/components/component-contract-set.json` and 40 family `evidence.tokens.source` → `-003`.
- `provenance/component-contract-source.json` token contract reference → `-003`, `candidate`, new blob.

## Task 5 — Components

- Badge `primary`, `success`, `warning`, `info`; Alert `success`, `warning`, `info`; Icon 19 identities and
  three colours; Avatar `shape`.
- Family contracts, seed provenance, knowledge statements and references, Storybook stories.
- `tests/release-011-delta.test.ts`: only the listed API facts change against the frozen Release 010 record.
- Scope `release009-preservation` to the families Release 011 leaves unchanged.

## Task 6 — Release identity 011

- `package.json`/lock `0.0.0-release.11`; release id `shadcn-radix-release-011` in scripts, validator, tests
  and CI; freeze the Release 010 record and manifest in `scripts/historical-artifacts.mjs`.

## Task 7 — Verify (pre-approval)

- Typecheck, full unit suite, Storybook tests, build. Record the tests that fail only with
  `EXECUTABLE_TOKEN_CONTRACT_NOT_APPROVED`.
- Draft PR; ask the owner to approve token contract `-003`.

## Task 8 — After owner approval

- Flip `-003` to `approved`, `release:generate` twice (identical), `candidate:generate` to
  `~/.artifacts/shadcn-design-system/shadcn-radix-release-011-candidate/`, `candidate:verify`,
  `release:verify`, commit the distribution manifest, write `docs/RELEASE-011.md` and
  `docs/CANVAS-RELEASE-011.md`, rerun the gates.
