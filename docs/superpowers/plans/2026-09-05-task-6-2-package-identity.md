# Task 6.2 package identity implementation plan

**Goal:** Bind release-001 to package implementation/build truth and independently verify ephemeral distribution bytes.

**Approved spec:** User's Task 6.2 handoff and toolchain clarification. Work only in the release-hardening-snapshot-gate worktree. Use Node 22.18.0/npm 10.9.3 through Volta. No commit, push, merge, PR, release-002, consumer testing, Canvas, or M7 work.

**Architecture:** Keep executable projection schema/semantics unchanged. Add a separate document version and package/input identity. Discover local imports from the declaration/build entrypoints and enumerate data authority directories for runtime-selected files. Observe actual build reads/modules/declaration inputs and reject unlisted inputs. Generated outputs and release artifacts are excluded from the input manifest. A candidate manifest is external and verification requires its independently retained digest; verification rebuilds into temporary output and compares actual packed bytes without updating expectations.

## Steps

- [x] Record starting identities and release payload/file hashes.
- [x] Write failing focused tests for deterministic manifests, source drift, reached-input omissions, package mapping, circular exclusions, and unchanged projection.
- [x] Implement input discovery and strict release document identity validation; preserve generic projection-only test fixtures.
- [x] Write failing distribution tests covering inventory, tar bytes, per-file hashes, JS/CSS/declarations/release data and manifest tampering.
- [x] Implement candidate generation and read-only verification with a required external digest anchor; guard actual build inputs.
- [x] Reconcile only release-001 and compare its projection to the original artifact before proceeding.
- [x] Run all requested checks freshly; retain logs and disclose any known Git-timeout flake without changing governance tests.
- [x] Request one read-only gpt-5.6-terra High review; resolve actionable findings with regression tests and rerun affected checks.
- [x] Report exact changed files, identities, evidence, limitations, and scope confirmations. Stop before commit.
