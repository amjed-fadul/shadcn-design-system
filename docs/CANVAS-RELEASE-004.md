# Canvas release 004

Prepared as one external candidate for the user-approved Canvas integration.
Release 003 and its accepted distribution bytes remain unchanged. This work is
local; no package publication or Git push occurred.

## Exact distribution

- Release: `shadcn-radix-release-004`
- Source commit: `27af4edc940c4a6532d45446ee728c46ce01eb42`
- Source branch: `codex/sidebar-release004`
- Package: `@adc/shadcn-design-system@0.0.0-release.4`
- Release payload SHA-256: `9cdbf7909f7de5a2f72a329c4b0a1ebd1d28ebf235ba471fb05000637423b8d8`
- Artifact: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz`
- Candidate path: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004`
- Tarball SHA-256: `a52891a22b81de1bf8b3ea7108c51d288756a753d6d4e662f71339fadfc436a3`
- npm integrity: `sha512-ZrWV5JH5XOaPYcIIasn3EvKJ8ZvDtRaUIVfsyRmYXe8ctDhUQZ/vEc/BfCps7Sdf8ME3hnesphJDMND2OFYh8w==`
- Manifest: `provenance/distributions/shadcn-radix-release-004.distribution.json`, copied byte-for-byte from the external candidate directory's `distribution-manifest.json`
- Manifest SHA-256: `d6809b871e902f270f6b09bd8959b0a8a77ac0bf1f2fb48f91015413b1a9f050`
- Packed files: 35; public entrypoints: 3; root exports: 108; families: 20.
- Executable implementation inputs: 208.
- Toolchain: Node 22.18.0, npm 10.9.3, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.
- React and React DOM peers remain exactly 18.3.1.

The source commit is the committed producer/input snapshot used to reproduce
the candidate. The generated release record and distribution manifest are
excluded from their own implementation-input identity, so recording them after
the source snapshot does not create a circular release hash.

## R3 preservation

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

The R4 package was generated once in the external candidate directory. A fresh
build in `/tmp/shadcn-r4-fresh.j7JHAm` produced the same tarball SHA-256,
manifest SHA-256, npm integrity, payload SHA-256, and 35-file inventory without
overwriting the approved candidate.

## Verification evidence

- TDD RED: `npm run test:identity` failed with 2 expected new R4-presence failures and 40 passing tests; `npm run test:library` failed with 1 expected new R4-candidate failure and 9 passing tests. No R4 record, manifest, or candidate existed at RED.
- `npm run release:generate` produced the R4 release record and preserved R3 bytes.
- `npm run release:verify -- --release-sha256 9cdbf7909f7de5a2f72a329c4b0a1ebd1d28ebf235ba471fb05000637423b8d8` passed.
- `npm run candidate:generate -- --output /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004` passed with the values above.
- `npm run candidate:verify -- --manifest /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/distribution-manifest.json --tarball /Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz --manifest-sha256 d6809b871e902f270f6b09bd8959b0a8a77ac0bf1f2fb48f91015413b1a9f050` passed against a fresh rebuild.
- `npm run components:verify` passed 469 tests across 19 files.
- `npm run tokens:verify` passed 87 tests across 9 files.
- `npm run snapshot:verify` passed 5 tests.
- `npm run typecheck` passed.
- Independent `shasum -a 256` and `tar -xOf` inspection matched the R3/R4 handoff values above.
- Fresh external build reproduced the approved R4 tarball byte-for-byte.

This is the bounded release-004 producer gate. It does not establish the
isolated consumer or Canvas integration; those remain Task 4 checks.
