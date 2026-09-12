# Canvas release 004

Prepared as one external candidate for the user-approved Canvas integration.
Release 003 and its accepted distribution bytes remain unchanged. This work is
local; no package publication or Git push occurred.

## Final exact distribution

- Release: `shadcn-radix-release-004`
- Source commit: `0d480b49ec9c499628d8a3e32b3a56386ac2b13d`
- Source branch: `codex/sidebar-release004`
- Package: `@adc/shadcn-design-system@0.0.0-release.4`
- Release payload SHA-256: `e0332a1103f1faa7a92e81c1815ffcfc4e4cbcdadeea7822391221b73c2b52a2`
- Artifact: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz`
- Candidate path: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004`
- Tarball SHA-256: `c7368978a0a5c8e75a871acb4624142c13d36e5934bc670e69adfe2c07f64252`
- npm integrity: `sha512-AkGpDll0cbYA4DEhEc0c6tl5+Ql4li9wf/ffAafzSokmI3K7ZBvFzLROjN9fCCR6XWBLC7jv8TxeNmKvEkyd2Q==`
- Manifest: `provenance/distributions/shadcn-radix-release-004.distribution.json`, copied byte-for-byte from the external candidate directory's `distribution-manifest.json`
- Manifest SHA-256: `ea074153c56bf6a012a0e9924369b9aa3a82a777e14b17ffade06b0b6349e46f`
- Packed files: 35; public entrypoints: 3; root exports: 108; families: 20.
- Executable implementation inputs: 208.
- Toolchain: Node 22.18.0, npm 10.9.3, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.
- React and React DOM peers remain exactly 18.3.1.

The source commit is the committed producer/input snapshot used to reproduce
the candidate. The release-input guard receives the exact R4 generated-output
path, excludes only that self-output, and still rejects other release records
and unbound inputs. The generated release record and distribution manifest are
therefore excluded from their own implementation-input identity without
weakening input coverage.

## Superseded prior R4 handoff

The following identity was superseded by the active-R4 binding and
release-aware self-output correction. It is historical only and is not the
final handoff above:

- Source commit: `876ff9cb84caba6b19326bf0c6d08564cc76960d`
- Payload SHA-256: `395535ac8540dde4dd96ca04f9ece6d22371fcdf21d7c0f35e7beb74488eab3f`
- Tarball SHA-256: `c65c476fa042740e42a28d48ad75e916eed4ca30290b82c7ef015ec2aca8c15d`
- npm integrity: `sha512-stti0tyEFQkCxaeMwsd47oNMXdq3A6FG+t9IZ61MA+8hVjPxU0YBqYD2TcmN6ZpNcrzDeXv3o823whE6fv0deA==`
- Manifest SHA-256: `b7907b575c362ba36be5faa588a20440138e0714f2db2c9e85c13782ed6c0bd7`

## R3 preservation

- Release 003 unchanged: `true`
- Release 003 tarball SHA-256 before: `bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629`
- Release 003 tarball SHA-256 after: `bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629`
- Release 003 release.js payload SHA-256 before: `5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b`
- Release 003 release.js payload SHA-256 after: `5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b`

The accepted external R3 tarball was read-only before and after R4 generation.
Its SHA-256 remained
`bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629`, and its
extracted `dist-library/release.js` payload hash remained
`5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b`.
The committed R3 release record and distribution manifest were not modified.

## R4 candidate behavior

The candidate contains the reviewed Task 1/2 source and corrected Sidebar
contract projection. The executable release exports the `sidebar.context`
provider capability from `SidebarProvider` and requires it from `Sidebar`.
Public package exports remain `.`, `./styles.css`, and `./release`.

The active canonical validator loads R4 and derives its expected projection
from canonical component and token sources. It rejects a hash-valid tampered R4
projection. A fresh second candidate reproduced this approved candidate's
tarball SHA-256, manifest SHA-256, npm integrity, payload SHA-256, and 35-file
inventory without overwriting the approved candidate.

## Verification evidence

- TDD RED: `npm run test:identity` failed with 2 expected new R4-presence failures and 40 passing tests; `npm run test:library` failed with 1 expected new R4-candidate failure and 9 passing tests. No R4 record, manifest, or candidate existed at RED.
- `npm run release:generate` produced the R4 release record and preserved R3 bytes.
- `npm run release:generate` independently inspected the accepted external R3 tarball and extracted `package/dist-library/release.js` before and after generation; both literal identities matched and the command failed closed on mismatch.
- `npm run release:verify -- --release-sha256 e0332a1103f1faa7a92e81c1815ffcfc4e4cbcdadeea7822391221b73c2b52a2` passed.
- `npm run candidate:generate -- --output /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004` passed with the values above.
- `npm run candidate:verify -- --manifest /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/distribution-manifest.json --tarball /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz --manifest-sha256 ea074153c56bf6a012a0e9924369b9aa3a82a777e14b17ffade06b0b6349e46f` passed against a fresh rebuild.
- Candidate verification compared fresh rebuilt tarball bytes, SHA-256, and npm SRI to the approved candidate in addition to comparing the packed inventory.
- `npm run components:verify` passed 469 tests across 19 files.
- `npm run tokens:verify` passed 87 tests across 9 files.
- `npm run snapshot:verify` passed 5 tests.
- `npm run typecheck` passed.
- Independent `shasum -a 256` and `tar -xOf` inspection matched the R3/R4 handoff values above.
- Fresh external build reproduced the approved R4 tarball byte-for-byte.

## Fix round 1 evidence

Reviewer findings were addressed within the Task 3 allowlist:

- `scripts/run-release-generation.mjs` now hashes the accepted external R3 tarball and independently extracts/imports `package/dist-library/release.js` before and after R4 generation. It fails closed on a missing, changed, or mismatched R3 artifact and reports both identities.
- `scripts/package-candidate.mjs` now compares the approved and fresh-build tarball SHA-256, npm SRI, and complete bytes before accepting the candidate; inventory comparison remains in place.
- `tests/package-identity.test.ts` now covers R3 before/after archive identity, fail-closed R3 mutation, same-inventory fresh tarball byte drift, and every literal R3 preservation field in this handoff.
- `tests/library-package.test.ts` independently hashes the extracted R3 `release.js` payload and confirms the archived R3 release ID.
- `provenance/distributions/shadcn-radix-release-004.distribution.json` remains the exact standard-schema byte copy of the external manifest; no preservation fields were added to that manifest.

Focused fix coverage:

```text
PATH=/Users/amjedfadul/.nvm/versions/node/v22.18.0/bin:$PATH npm run test:identity -- -t 'preserves the accepted R3|fails closed when the accepted R3|candidate verification rejects fresh tarball'
```

Passed: 3 focused tests; 41 tests skipped by the name filter. The fail-closed
mutation and fresh-byte-drift cases both rejected their deliberately forged
inputs.

Historical superseded R4 candidate values from fix round 1 (not the final
identity in the section above):

- Superseded payload SHA-256: `9f9c4bdab33ce7ac4604c1f1a7834edd1e296458d4bda10eedf33185d677eca9`
- Superseded tarball SHA-256: `c62460faccdad81c56f769e57a959b2a0b8d609acad29da792cb246596709cfc`
- Superseded npm integrity: `sha512-NR7jj0FqHFQ1lUJ14Cb6F6nDyZ8RGP5W7fAY7yr1QAhXodn8rrfgp0dQYEaQsl4MS8HhNZE10/YJKCU2d49UVw==`
- Superseded manifest SHA-256: `95f894c8d6176ba5224e8cbc075daac8dc17bf91e5d25a1d1689fb0725f21b38`

Historical fix-round-1 archive comparison (superseded):

```text
cmp -s /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/distribution-manifest.json provenance/distributions/shadcn-radix-release-004.distribution.json
```

Passed byte-for-byte. The approved and fresh output tarballs both hash to
`c62460faccdad81c56f769e57a959b2a0b8d609acad29da792cb246596709cfc` and both
report
`sha512-NR7jj0FqHFQ1lUJ14Cb6F6nDyZ8RGP5W7fAY7yr1QAhXodn8rrfgp0dQYEaQsl4MS8HhNZE10/YJKCU2d49UVw==`.

Fix commit: `b656c37f600cc8d6ac47379b17a2b858ec5d0571`.

This is the bounded release-004 producer gate. It does not establish the
isolated consumer or Canvas integration; those remain Task 4 checks.

## Historical controller verification note (superseded)

The earlier controller run reached 757 passing tests but failed four module
setup suites with `PROJECTION_MISMATCH` from the then-active R3 canonical
binding. That result is superseded by this correction's active R4 binding and
final producer verification; it does not describe the final R4 handoff.
