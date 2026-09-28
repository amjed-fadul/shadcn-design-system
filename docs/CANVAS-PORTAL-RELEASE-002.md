# Canvas portal release 002

Prepared for the user-approved Canvas integration. Release001 and its accepted
distribution bytes remain unchanged. This work is local; no package publication
or Git push occurred.

## Exact distribution

- Release: `shadcn-radix-release-002`
- Source commit: `988df2f68e90fff932909a30da6d9076e932d20f`
- Source branch: `codex/canvas-portal-release-002`
- Package: `@adc/shadcn-design-system@0.0.0-release.2`
- Release payload SHA-256: `c2ce511974ec8c7c8d8023502a5e74f7b4544aecbdc0ec77a7936af76f447829`
- Artifact: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-002/adc-shadcn-design-system-0.0.0-release.2.tgz`
- Tarball SHA-256: `f385461073a517149de69c571bcba49f5a25d39386804e4f265c3d11632344c8`
- npm integrity: `sha512-6eOXDFm9Rw28RW5g9o9MUqm53F2tmSMlaLGSzNT23z2VB98uOsVg1ocm4IcCdDdAeNqEOAMt2g6h0A8R2GSwOA==`
- Manifest: `provenance/distributions/shadcn-radix-release-002.distribution.json`, copied byte-for-byte from the artifact directory's `distribution-manifest.json`
- Manifest SHA-256: `5a06b7813edd9766f3bc2dca8e900e57fffe56776935eebbff998f1f8d16ea79`
- Packed files: 35; public entrypoints: 3; root exports: 107; families: 19.
- Toolchain: Node 22.18.0, npm 10.9.3. React and React DOM peers remain exactly 18.3.1.

Artifact inputs are frozen at the hashes above. The source commit contains every
packaged implementation input; the subsequent handoff commit adds only this
record and the external distribution manifest.

## Bounded change

`DialogContent` and `SelectContent` accept an optional `portalContainer`, typed
from their bundled Radix Portal's `container` prop (`Element | DocumentFragment`;
optional `undefined`). Each wrapper forwards it to its existing internal Portal
and removes it from content DOM props. Omission preserves the existing body
default. Dialog overlay and content share the requested host.

SelectTrigger's existing native `id`, `aria-label`, and `aria-labelledby` support
is now represented in its factual inherited contract. Exact types come from the
pinned declaration checker. No SelectTrigger runtime behavior changed.

The executable projection delta is restricted to the two container properties
(including DialogContent's two existing conditional branches) and three
SelectTrigger labeling properties. Existing baseline contract identities and
token facts remain intact; release002 binds the new exact input graph.

Containers are application environment values. The producer semantic validator
returns `UNRESOLVED_FACT` for attempted serialized container values; none are
successful governed authoring. Canvas must inject the host and prevent authors
from supplying the prop. Use public compound exports together to preserve the
package's bundled contexts.

## Verification evidence

- Complete unit suite: 751 tests across 50 files passed.
- Focused Dialog/Select Storybook Chromium suite: 3 tests across 2 files passed.
- Final TypeScript check and whitespace check passed.

- RED: four real DOM containment failures before the API change; body defaults
  already passed. Labeling RED: missing SelectTrigger `id` factual projection.
- DOM placement covers Element, a connected ShadowRoot (DocumentFragment), and
  omitted hosts. A detached fragment was also observed to contain its nodes, but
  modal accessibility warns because it is outside the document; the maintained
  regression uses a connected fragment.
- Public declarations accept Element/DocumentFragment/undefined and reject
  selector strings; SelectTrigger accepts the three labeling attributes and
  rejects a numeric ID.
- Independent candidate verification rebuilt from frozen inputs and verified
  the retained manifest, tarball, and 35-file inventory without refreshing
  expectations.
- An external npm installation imported the exact tarball through public package
  exports. Chromium passed all four Dialog/Select × contained/default cases:
  correct content/overlay host, empty neighboring host, no leaked container DOM
  prop, selection writeback, Dialog Escape focus return, and Select accessible
  name from the public Label/aria-labelledby relationship. No page/console errors.
- The external consumer resolves only React/React DOM version 18.3.1.
- Evidence directory: `/tmp/canvas-portal-release-002`.
- Final browser report: `/var/folders/wk/dcql9dfd74l1ktt20q5rvln40000gn/T/release002-portal-consumer-nKclPQ/portal-evidence.json`.

This is the bounded portal and labeling producer gate. It does not establish
Canvas's scaled-frame geometry, scoped CSS installation, RTL styling, or per-Page
error boundaries; those remain Canvas integration checks.

Superseded, unaccepted release002 candidates are retained under
`/tmp/canvas-portal-release-002/draft-before-readme` and
`/tmp/canvas-portal-release-002/draft-before-labeling`; neither is the artifact
listed above.
