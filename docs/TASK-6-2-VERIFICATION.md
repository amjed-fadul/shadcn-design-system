# Task 6.2 verification evidence

This records candidate identity work only. It is not a Task 6.4 acceptance record. No commit, push, merge, PR, consumer installation, Task 6.3, Canvas change, M7 change, or release-002 was performed.

## Starting state

Worktree: `/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate`. Branch: `fix/release-hardening-snapshot-gate`. HEAD: `765e2d7786142cb3ed9f9ae56ebbc8c5e07614d2`. The worktree was clean before Task 6.2 changes. Package: `@adc/shadcn-design-system@0.0.0-release.1`. Release: `shadcn-radix-release-001`.

The initial shell resolved `/usr/local/bin/node` (`v20.9.0`) and `/usr/local/bin/npm` (`10.1.0`). Volta was `1.1.1`; its defaults resolved beneath `/Users/amjedfadul/.volta/tools/image/node/24.19.0/bin/`. Explicit `volta run --node 22.18.0 --npm 10.9.3` returned `v22.18.0` and `10.9.3`. All Task 6.2 Node/npm commands used that exact toolchain; repository metadata was not changed to repair shell resolution.

## Release-001 changes

| Identity | Before Task 6.2 | After Task 6.2 |
|---|---|---|
| Canonical hash-free payload SHA-256 (`sha256` field) | `6fbcb712844038e72eba522288cab0356c0226cd6308e80e77addc0209acab53` | `5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f` |
| Complete JSON file SHA-256 | `4081742b599f74f0f0811aa27fa3f7cfa9ece6b6e3d3296834d5362157f9e909` | `a58a4274f7c6784067bf38647da33df8e3d0d2aebe247f1c4b93300c4c3fce16` |
| Release document schema | implicit | `documentSchemaVersion: 1` |
| Executable projection schema | `1` | `1` |

The executable projection is unchanged compared with the artifact in commit `765e2d…`; the focused test compares the complete projection. All prior fields other than `sha256` retain their values. Non-projection additions are exactly `documentSchemaVersion`, `packageIdentity`, and `implementationInputs`.

The package identity is:

```json
{
  "name": "@adc/shadcn-design-system",
  "version": "0.0.0-release.1",
  "publicEntrypoints": {
    ".": {
      "types": "./dist-library/types/src/package/index.d.ts",
      "import": "./dist-library/index.js"
    },
    "./styles.css": "./dist-library/styles.css",
    "./release": {
      "types": "./dist-library/types/src/package/release.d.ts",
      "import": "./dist-library/release.js"
    }
  }
}
```

The deterministically sorted implementation manifest contains **205 inputs**: **176 repository files** with Git blob and SHA-256 identities, and **29 installed dependency files** with SHA-256 and `gitBlob: null`. Git blobs describe current bytes, including uncommitted reviewed changes; they do not assert those changes were committed.

Coverage includes all 19 approved component implementations, `src/lib/utils.ts`, `src/hooks/use-mobile.ts`, canonical CSS, `components.json`, package entrypoints/metadata, lockfile, library build/configuration/declaration inputs, CSS package export metadata/imports/fonts, browser-safe data generation, and reached contract/schema/provenance authorities. TypeScript resolves local static imports from build/declaration roots. Runtime-selected authority directories and their referenced local files are discovered deterministically. Actual synchronous/asynchronous/file-handle/stream reads, Vite module/watch lists, and TypeScript sources are checked against the frozen release manifest. A fresh private compiler scratch directory holds generated IPC outputs.

Installed dependency JavaScript outside the individually recorded CSS/font/compiler/declaration evidence is trusted through the pinned lockfile. The candidate toolchain also checks installed build-tool versions against that lockfile. This workflow assumes the reviewed verifier and toolchain are trusted; it is not a sandbox for hostile build programs.

## Distribution identity

Candidate tarball: [ephemeral candidate](/tmp/task62-candidate-final/adc-shadcn-design-system-0.0.0-release.1.tgz). External manifest: [distribution-manifest.json](/tmp/task62-candidate-final/distribution-manifest.json). Neither is a committed or accepted Canvas artifact.

| Candidate identity | Value |
|---|---|
| Release payload SHA-256 | `5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f` |
| Tarball SHA-256 | `29c9743ba6c263bf01afafa6702ee88ace2fe21c46d6348a1da7953ddb21dd5f` |
| npm integrity | `sha512-pBjZ6VLD7kYw/3frZKVS1Idb+f+Vc7jFjbfltTu9/2kFSDcxnNj8Iqy9AeizXT8+gX3onpZTvyw0LPBQlJ5WUg==` |
| Independently retained external manifest SHA-256 | `205c2fa459210fec044b9d9912025211f2930046821ea7ced45a5338145fb318` |
| Packed files | `35` |

The external manifest has schema version, release ID/payload hash, package name/version, Node/npm/platform/architecture/build-tool identities, tarball filename/hash/npm integrity, and sorted packed-file path/size/SHA-256 entries. Tar bytes are parsed directly with checksum, path, duplicate, regular-file and completeness checks; npm's inventory is not used as expected truth.

### Generation

```sh
volta run --node 22.18.0 --npm 10.9.3 npm run release:generate
volta run --node 22.18.0 --npm 10.9.3 npm run build:library
volta run --node 22.18.0 --npm 10.9.3 npm run candidate:generate -- --output /tmp/new-release-001-candidate
```

Release reconciliation aborts on an executable projection change. Candidate generation verifies frozen release inputs, builds fresh producer output, runs `npm pack --ignore-scripts`, then writes external candidate evidence without overwriting existing files. No candidate tarball is committed.

### Verification of the existing final candidate

```sh
volta run --node 22.18.0 --npm 10.9.3 npm run release:verify -- --release-sha256 5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f
volta run --node 22.18.0 --npm 10.9.3 npm run candidate:verify -- \
  --manifest /tmp/task62-candidate-final/distribution-manifest.json \
  --tarball /tmp/task62-candidate-final/adc-shadcn-design-system-0.0.0-release.1.tgz \
  --manifest-sha256 205c2fa459210fec044b9d9912025211f2930046821ea7ced45a5338145fb318
```

The supplied digests are expectations retained after generation, not hashes computed from potentially changed files during verification. Verification never refreshes the release, candidate, or manifest. It checks those retained anchors, rechecks source/input identities and package mapping, builds into temporary output, and independently compares the rebuilt packed inventory with the existing tarball. This is a producer rebuild; no consumer application is installed or exercised.

### Circularity proof

```text
approved source + contract/build inputs -> release-001 -> verified build
  -> candidate .tgz -> external distribution manifest
```

The release hashes its canonical payload without its own `sha256` field. Its input manifest excludes the release file, generated `dist-library/`, tarballs, distribution manifests and acceptance digests. The distribution manifest hashes packed bytes and remains outside the package; it has no self hash. Its retained digest and this evidence report are not release inputs. No tarball hash is fed back into the release or package.

## Tamper/rejection proof

Focused tests cover deterministic ordering, current source/CSS/build/package/lock/config drift, missing reached imports, real producer runtime-input omissions before and during Vite configuration, package mapping, frozen release hash/anchor checks, unchanged projection, circular paths, release-002 rejection, actual packed inventory, tarball/integrity/file hashes, JS/CSS/declaration/release tampering, external-manifest exclusion, and manifest edits/omissions/duplicates/ordering.

The red/green cycle included empty identity implementations, the real pre-import omission, CSS/provenance graph omissions, and the optional `fs.open` overload. Existing governance tests were not edited.

The final real candidate was additionally mutated in memory at `dist-library/index.js`, `dist-library/styles.css`, `dist-library/types/src/package/index.d.ts`, and `dist-library/release.js`. Each was rejected with `BUILD_INVENTORY_MISMATCH` even after all candidate hashes were recomputed. [Actual tarball tamper evidence](/tmp/task62-final-real-tamper-results.json).

CLI rejection probes confirmed missing release anchor, wrong release anchor, and wrong external manifest anchor exit nonzero without changing the release. [CLI evidence](/tmp/task62-final-cli-rejection-results.json).

## Full verification

All 16 final checks passed after the last production edit. Every Node/npm invocation used Volta Node `22.18.0` / npm `10.9.3`. [Machine-readable final results](/tmp/task62-final-full-results.json).

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `identity` | 0 | 34.41 s | [log](/tmp/task62-final-full-identity.log) |
| `typecheck` | 0 | 5.58 s | [log](/tmp/task62-final-full-typecheck.log) |
| `unit` | 0 | 215.35 s | [log](/tmp/task62-final-full-unit.log) |
| `app-build` | 0 | 1.12 s | [log](/tmp/task62-final-full-app-build.log) |
| `library-build` | 0 | 13.06 s | [log](/tmp/task62-final-full-library-build.log) |
| `library-tests` | 0 | 17.2 s | [log](/tmp/task62-final-full-library-tests.log) |
| `storybook-build` | 0 | 8.01 s | [log](/tmp/task62-final-full-storybook-build.log) |
| `storybook-tests` | 0 | 12.27 s | [log](/tmp/task62-final-full-storybook-tests.log) |
| `tokens` | 0 | 2.77 s | [log](/tmp/task62-final-full-tokens.log) |
| `components` | 0 | 46.23 s | [log](/tmp/task62-final-full-components.log) |
| `snapshot` | 0 | 3.63 s | [log](/tmp/task62-final-full-snapshot.log) |
| `release` | 0 | 9.82 s | [log](/tmp/task62-final-full-release.log) |
| `candidate` | 0 | 16.65 s | [log](/tmp/task62-final-full-candidate.log) |
| `audit-production` | 0 | 1.31 s | [log](/tmp/task62-final-full-audit-production.log) |
| `audit-all` | 0 | 1.37 s | [log](/tmp/task62-final-full-audit-all.log) |
| `diff-check` | 0 | 0.07 s | [log](/tmp/task62-final-full-diff-check.log) |

The final run passed 39 focused identity tests, 719 unit tests, 6 library-package tests, 47 Storybook tests, 459 component checks, 87 token checks, 5 snapshot checks, all builds/release/candidate checks, and both audits with zero vulnerabilities. No known Git-timeout flake occurred; those tests and their timeout behavior were left intact.

## Terra review

One read-only `gpt-5.6-terra`, High reviewer assessed all 12 requested criteria. It found two P1 gaps: a standalone release verification anchor was missing, and build read observation started after release-input loading. Both were reproduced with regression tests and fixed. It also identified the `fs.open(path, callback)` overload compatibility issue; that was reproduced and fixed. The same reviewer confirmed the corrections and concluded: **no remaining actionable blockers found**. It did not modify files. Full-run verification evidence was gathered by the primary agent.

## Exact changed-file list

- [README.md](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/README.md)
- [docs/TASK-6-2-VERIFICATION.md](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/docs/TASK-6-2-VERIFICATION.md)
- [docs/superpowers/plans/2026-09-05-task-6-2-package-identity.md](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/docs/superpowers/plans/2026-09-05-task-6-2-package-identity.md)
- [package.json](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/package.json)
- [provenance/releases/shadcn-radix-release-001.json](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/provenance/releases/shadcn-radix-release-001.json)
- [scripts/build-input-guard.mjs](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/build-input-guard.mjs)
- [scripts/build-library.mjs](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/build-library.mjs)
- [scripts/css-inputs.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/css-inputs.ts)
- [scripts/distribution-identity.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/distribution-identity.ts)
- [scripts/generate-executable-release.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/generate-executable-release.ts)
- [scripts/package-candidate.mjs](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/package-candidate.mjs)
- [scripts/release-inputs.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/release-inputs.ts)
- [scripts/run-release-generation.mjs](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/scripts/run-release-generation.mjs)
- [src/validator/canonical-release.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/src/validator/canonical-release.ts)
- [src/validator/release.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/src/validator/release.ts)
- [src/validator/types.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/src/validator/types.ts)
- [tests/distribution-identity.test.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/tests/distribution-identity.test.ts)
- [tests/package-identity.test.ts](/Users/amjedfadul/.worktrees/shadcn-design-system/release-hardening-snapshot-gate/tests/package-identity.test.ts)

## Scope confirmation

No commit. No push. No merge. No PR. No release-002. No Task 6.3. No Canvas changes. No M7 work. No dependency version changes. No original governance-test edits. Candidate `.tgz` and distribution manifest remain external, ephemeral evidence.
