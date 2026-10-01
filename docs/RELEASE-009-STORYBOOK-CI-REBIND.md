# Release 009 Storybook rebind and CI split

The DropdownMenu Default interaction now waits for Profile to become visible with the existing `waitFor` import. This corrects the opening-animation assertion race; component production source, contracts, knowledge, package identity and public APIs are unchanged.

The existing producer ran once after the source edit. Exactly one of the 364 Release 009 implementation inputs changes: `src/components/ui/dropdown-menu.stories.tsx`. The canonical release projection and the other 363 inputs remain exact. Stories remain in the input graph; no exclusion or producer changes were made.

## Final candidate identities

Version remains `0.0.0-release.9`. These identities supersede the dependency-rebind candidate for the current source revision; earlier candidates and evidence remain retained.

| Identity | SHA-256 |
| --- | --- |
| Release payload | `b5bff95783917cf2c3351840b49427d0b55c0b520d0d87e00a163d2b1b6b6e89` |
| Distribution manifest bytes | `79fbbc7657d68c4a3a5d5cf9db0ebf684617be78bb792036f8b89827d698e87f` |
| Candidate tarball bytes | `6471c55929fd221e8beb1767f1eaedef79e4bfa4906ecea41b79c17e79bfda71` |

Integrity: `sha512-sHD5IvssWz9xod0pvXT98W9IEP2R9qpPQnuskUAPzIDWw3VXq5I1u+ATEJ137PT1PYfXLgdtT498ugcplCmzPw==`.

The payload and distribution manifest are committed under `provenance/releases` and `provenance/distributions`. The 56-file tarball, independent `candidate-anchor.json`, and logs are retained at `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-009-storybook-ci-final`. As with previous candidates, the tarball remains external to Git.

An independent clean build verified exact tarball bytes, SHA-256, SHA-512 integrity and packed-file inventory against the retained candidate and manifest digest. Verification did not refresh expectations. Compared with the preceding dependency-rebind candidate, only `dist-library/release.js` changes; CSS, declarations and all other packed files are byte-identical.

## Local verification

All commands used Node 22.18.0 / npm 10.9.3 on macOS arm64.

- Fresh `npm ci --ignore-scripts --no-fund`: passed.
- `npm run typecheck`: passed.
- The exact seven-file cheap PR test selection: **45/45 passed**. This covers active release input identity and projection, component/token schemas and token index, R8 semantic preservation, immutable release history and CI policy.
- Focused package/distribution identity selection: **29 passed**, with 21 unrelated package-build tests outside the focused selection. Those tests remain in the full manual qualification suite.
- The new exact-input binding check failed before rebind with `INPUT_DRIFT: src/components/ui/dropdown-menu.stories.tsx`, then passed after rebind.
- `npm run release:verify -- --release-sha256 b5bff95783917cf2c3351840b49427d0b55c0b520d0d87e00a163d2b1b6b6e89`: passed.
- Candidate generation and separate clean candidate rebuild verification: passed, **56 packed files**.
- Both `npm audit --omit=dev` and `npm audit`: zero vulnerabilities.
- Both workflow YAMLs parse and pass actionlint 1.7.12. The manual SHA validator accepts an exact 40-character SHA and rejects branch names, truncated/extended SHAs and shell text.
- `git diff --check`: passed.

The corrected DropdownMenu story already passed **10/10 separate Chromium runs**, and the complete Storybook runtime suite passed **224/224 across 43 files** in this same session. Generation changed only the release payload; rebind tooling, story/rendering inputs, CSS and component source did not change afterward. Per the requested verification scope, the already-green Storybook run was retained rather than repeated.

The full unit/browser qualification was not rerun locally for this one-input rebind. The manual workflow preserves the complete unit and Storybook gates, including all existing tests and the added input-binding/workflow-policy assertions. Earlier full qualification remains evidence for the unchanged component system, rather than a new qualification of this final commit.

## Preservation

A before/after SHA-256 snapshot covers 409 protected files, including production source, contracts, knowledge, release tooling, all retained historical repository artifacts and the external R7/R8 candidates. All compare byte-for-byte equal. R7/R8 expectations were not regenerated. The producer's historical-artifact guard and independent R3 archive checks passed before and after generation.

## CI changes

`.github/workflows/baseline.yml` retains workflow name **Baseline verification**, job name **verify**, PR triggers and main-push triggers. It runs on **ubuntu-latest**, uses Node 22.18.0 and npm caching, installs pinned dependencies, typechecks, runs both audits and executes the seven-file fast selection. Superseded PR runs are cancelled by a PR-number concurrency group; main runs are not cancelled. It provisions no retained archives and installs no Playwright browser. Full unit, app build, full Storybook runtime and Storybook build move out of the normal PR gate.

`.github/workflows/release-qualification.yml` is **Release qualification**, triggered only by **workflow_dispatch**. The required `pr_head_sha` must be a full lowercase 40-character SHA; checkout uses that value and verifies HEAD matches it. The macOS gate preserves retained artifact provisioning and digest verification, Node 22.18.0, the pinned heap, Chromium installation, typecheck, full unit suite, app build, full Storybook runtime, Storybook build and both audits. It then verifies the committed R9 input graph, generates a candidate and checks a separate clean rebuild against the committed distribution manifest. It fails on tracked-file drift, records the qualified SHA in the run title/summary and uploads candidate evidence under that SHA.

The workflow-policy tests now require the complete blocking command sequence in the manual qualification workflow and separately protect the cheap gate's names, runner and scope. No existing test or release rejection rule was removed or relaxed.

## Before merge

Require a successful full **Release qualification** run for the exact current PR head SHA before merging. Later source pushes require new qualification. The cheap `verify` check is not a substitute for that release decision, and a dispatch run is not automatically a required PR merge check.

GitHub requires a new dispatch workflow to be present on the default branch before its first invocation. Because this workflow is introduced by the unmerged PR, it needs a separately reviewed default-branch bootstrap before qualifying PR #16 through Actions. This task does not change main, dispatch the expensive workflow or merge the PR. See [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
