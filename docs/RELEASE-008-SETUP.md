# Release 008 setup

Release 008 is the active producer release and package version `0.0.0-release.8`. Its executable record is `provenance/releases/shadcn-radix-release-008.json`; Releases 001–007 remain historical inputs and are protected by SHA-256 checks in `scripts/historical-artifacts.mjs`.

The release and candidate scripts check the retained release records and committed distribution manifests before and after generation or verification. The current committed distribution history contains manifests for Releases 001–004 and 007. Historical manifests and release records are not generated or refreshed by the Release 008 commands.

After the Release 008 component source, contracts, stories, and knowledge are integrated:

1. Run `npm run release:generate` to create the Release 008 executable record.
2. Run `npm run release:verify -- --release-sha256 <release-payload-sha256>` with the independently retained Release 008 payload digest.
3. Run `npm run candidate:generate -- --output <external-candidate-directory>` to build a candidate outside this repository.
4. Retain the distribution manifest digest independently, then run `npm run candidate:verify -- --manifest <manifest-path> --tarball <tarball-path> --manifest-sha256 <manifest-sha256>`.

The candidate commands enforce Node `22.18.0`, npm `10.9.3`, and the versions pinned by `package-lock.json`. Generation and candidate verification assert that all guarded historical artifacts keep their exact bytes.
