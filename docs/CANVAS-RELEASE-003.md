# Canvas release 003

Prepared for the user-approved Canvas integration. Releases 001 and 002 and
their accepted distribution bytes remain unchanged. This work is local; no
package publication or Git push occurred.

## Exact distribution

- Release: `shadcn-radix-release-003`
- Source commit: `888bdcf3be9599d9481c0bfa4845f64bbc563785`
- Source branch: `codex/canvas-portal-release-002`
- Package: `@adc/shadcn-design-system@0.0.0-release.3`
- Release payload SHA-256: `5ffd25a9bac4fb44f8e826243323b20b93fb51a93db19b14b6d71089b545105b`
- Artifact: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-003/adc-shadcn-design-system-0.0.0-release.3.tgz`
- Tarball SHA-256: `bf8fdd1bd837eda50b62bea372a3d5346c54621c1e3ec8679cff3f3b71dcc629`
- npm integrity: `sha512-mkCkTuf+z4DqpDOYcM1IRZrnQmaGpXZDcO0eJbZXOl5QSAQHm67sRBXzYJ3UTZ72BgUh/WoAcVtJvrZZE8dIIQ==`
- Manifest: `provenance/distributions/shadcn-radix-release-003.distribution.json`, copied byte-for-byte from the artifact directory's `distribution-manifest.json`
- Manifest SHA-256: `c75905422d8cd0b75f33d4dbd688bc378a112a64fac0023332c73e1732f46d31`
- Packed files: 36; public entrypoints: 3; root exports: 108; families: 20.
- Executable implementation inputs: 209.
- Toolchain: Node 22.18.0, npm 10.9.3. React and React DOM peers remain exactly 18.3.1.

Artifact inputs are frozen at the hashes above. The source commit contains every
packaged implementation input; the subsequent handoff commit adds only this
record and the external distribution manifest.

## Bounded change

`DropdownMenuContent`, `SheetContent`, and `TooltipContent` now accept the same
optional environment-owned `portalContainer` contract established in release
002 (`Element | DocumentFragment`; optional `undefined`). Each wrapper forwards
it to its bundled Radix Portal and omits it from rendered DOM props. Omission
preserves the existing body default. Sheet overlay and content share the
requested host.

Sheet's left and right containing-block width is corrected by using `w-3/4`
with `max-w-sm`, rather than a viewport-width basis. The public Switch family is
included in the package, component contracts, executable projection, source
provenance, and generated declarations.

The release-003 guard anchors committed release-002 bytes and normalizes the new
payload back to release 002 after removing exactly:

- `portalContainer` on `DropdownMenuContent`;
- `portalContainer` on `SheetContent` and both of its conditional API shapes;
- `portalContainer` on `TooltipContent`; and
- the exact `switch\0Switch` executable export, including four props, one event,
  one checked-state channel, and nine token dependencies.

The projection export count changes from 107 to 108. Implementation inputs
change from 205 to 209, with no removals. The only added inputs are the Switch
family contract, Switch inherited-interface contract, pinned Radix Switch
declaration, and Switch implementation. The only changed input paths are the
five release bookkeeping files plus the 13 approved portal, Sheet, Switch,
contract-index, package-export, and provenance source files. Any other payload,
projection, input-set, or changed-input-path delta fails the guard.

Containers are application environment values. Producer validation returns
`UNRESOLVED_FACT` for attempted serialized container values; none are successful
governed authoring. Canvas must inject the host and prevent authors from
supplying the prop. Use public compound exports together to preserve the
package's bundled contexts.

## Verification evidence

- The stale release-002 baseline failed only with the approved
  `PROJECTION_MISMATCH`, `INPUT_SET_MISMATCH`, and Switch `INPUT_UNRESOLVED`
  drift: 706 passed, 3 failed, and 6 skipped tests across 53 files, with zero
  unhandled Vitest errors.
- TypeScript check passed.
- Component verification passed 460 tests across 19 files.
- Token verification passed 87 tests across 9 files.
- Complete unit suite passed 776 tests across 54 files, with zero failed tests,
  zero skipped tests, and zero unhandled Vitest errors.
- Storybook Chromium passed 52 tests across 21 files.
- Library build passed after transforming 1,917 modules; declaration emission,
  release-input verification, and actual build dependency coverage passed.
- Release verification passed against the independently supplied release payload
  digest.
- The release-003 delta guard passed its exact one-test comparison against the
  committed release-002 payload.
- Candidate verification rebuilt independently and verified the retained
  manifest, literal tarball, and 36-file inventory without refreshing
  expectations.
- Identity verification passed 39 tests across 2 files.
- An external npm installation imported the literal verified tarball through
  public package exports. Chromium passed all 10 contained/default cases for
  Dialog, Select, DropdownMenu, Sheet, and Tooltip. Each case proved correct
  content host, empty neighboring host, no leaked `portalContainer` DOM prop,
  and a working interaction; Dialog and Sheet also proved co-located overlays
  and Escape focus return. No page or console errors occurred.
- Browser evidence: `/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/release003-portal-consumer-UfnYyy/portal-evidence.json`.
- Final whitespace checks passed.

This is the bounded release-003 producer gate. It does not establish Canvas's
scaled-frame geometry, scoped CSS installation, RTL styling, or per-Page error
boundaries; those remain Canvas integration checks. Canvas Part B/B1 was not
started.
