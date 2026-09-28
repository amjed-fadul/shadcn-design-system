# Task 6.3 isolated consumer implementation plan

**Goal:** Prove the exact Task 6.2 tarball works in a separate React consumer.
**Spec:** User's Task 6.3 continuation brief. All requested work is authorized; stop before commit and Task 6.4.
**Architecture:** Copy a standalone React/Vite/TypeScript fixture into a new external temporary directory. Install the digest-anchored tarball and pinned consumer tools there. Run byte/API/resolution/type/build/browser/tamper checks using only the consumer installation. A Vite module inventory and TypeScript source inventory enforce local dependency closure. On macOS deny reads to every design-system worktree during consumer checks and prove the denial first.
**Constraints:** Node 22.18.0/npm 10.9.3, React/React DOM 18.3.1, release-001 only, no package/source/release input changes, no real Canvas or M7, no commit/push/merge/PR. No Tailwind or React aliases in consumer.

- [x] Verify clean a07117fe380ec1fc8527641817e8547a2bb9d540, toolchain, release ID/hash and no release-002; generate fresh external candidate using committed generation path.
- [x] Write and observe failing byte-verifier tests for altered/missing/extra bytes, wrong artifact/digest, symlinks and path traversal; implement verifier and rerun.
- [x] Add standalone fixture (`tests/fixtures/isolated-consumer`): public component/release imports, strict positive/negative type probes, exact API and token expectations, instrumented Vite graph, browser proof and installed-byte/tamper checks.
- [x] Add `tests/isolated-consumer/run.mjs`: generate or verify an externally anchored candidate, copy fixture/candidate into a new external consumer, install pinned dependencies, deny repository access, execute checks and retain evidence. No artifact expectations refreshed during verification.
- [x] Run consumer suite and all repository checks with pinned Volta versions; investigate failures without weakening required assertions.
- [x] Give exact candidate/evidence/full diff to one read-only gpt-5.6-terra High reviewer, address findings and rerun affected checks.
- [x] Record evidence and exact changed files. Stop before commit.

**Outcome:** Harness/evidence/review are complete. Exact-candidate proof is blocked: React 18 Button-asChild Dialog trigger loses its ref and fails Escape focus return. The required regression remains failing; Terra confirmed P1 and no false-success path. Do not accept this artifact or modify its bytes under the current identity. No commit or Task 6.4 work.
