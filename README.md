# shadcn Design System

Canonical governed shadcn design system for Agentic Design Canvas product work.

This repository is separate from Canvas. The official shadcn repository is upstream/reference only; Canvas will eventually consume immutable contracted releases from this repository.

## Active producer: Release 010 candidate

Release 010 (`0.0.0-release.10`) widens the React peer range to `^18.3.1 || ^19.0.0` so Canvas can run React 19. Components, tokens, knowledge and visual decisions are unchanged from Release 009. The 75 inherited interfaces that resolve React DOM props were regenerated from `@types/react` 19.3.0 (React 19 adds `popover`, `inert`, `onToggle`, `onScrollEnd` and transition events, and removes `onResize`). See [Release 010](docs/RELEASE-010.md). The Release 009 sections below describe the visual system it carries forward.

## Release 009

Release 009 (`0.0.0-release.9`) refines product UI density and hierarchy over the exact accepted Release 008 candidate. Release 008's Icon, Image, Link and Toggle Group semantics remain preserved. Historical release records remain immutable. The Release 008 sections below document that baseline; the active canonical validator and candidate commands now target Release 009.

Geist Variable, the existing 4px spacing scale and 82 token identities remain. Central radius is 8px (chips 4px, controls 6px, containers 8px, larger surfaces 12px); normal controls are 32px, navigation 28px, tables 32px. Canvas/background, subtle/muted, raised/card and overlay/popover define surface roles. Borders carry normal grouping, floating menus use subtle elevation, and modal surfaces use restrained elevation. Solid 2px keyboard focus uses a 2px background offset; scrolling viewports use an inset ring to avoid clipping. Reduced motion is respected across state and structural animation.

Storybook `System/Product UI` includes six product-agnostic integration examples and four family validation stories. Theme and reading-direction controls cover light/dark and LTR/RTL without duplicating every story. See [Release 009 plan](docs/RELEASE-009-PLAN.md) and [Release 009 verification](docs/RELEASE-009-VERIFICATION.md).

## Bootstrap baseline

- shadcn style: `radix-nova`
- base: Radix
- Tailwind CSS: 4.3.3
- shadcn CLI/source baseline: 4.19.0
- radix-ui: 1.6.7
- React: 18.3.1
- Bootstrap release identity: `shadcn-radix-bootstrap-000`

See `docs/MASTER-PLAN.md` for the staged contract and Canvas-integration plan.

## Library package boundary (Task 6.1)

Use Node `22.18.0` and npm `10.9.3`, install with `npm ci`, then run:

```sh
npm run build:library
npm run test:library
```

The private package version is `0.0.0-release.8`. The separate `dist-library/`
output contains ES modules, compiled CSS with embedded fonts, TypeScript
declarations, and bundled dependency notices. The existing app and Storybook
builds remain available. The public API has exactly three entrypoints:

```tsx
import { Button, Card, Tabs, Dialog, Icon, Image, Link } from "@adc/shadcn-design-system"
import "@adc/shadcn-design-system/styles.css"
import {
  getExecutableRelease,
  getComponentContracts,
  getTokenContract,
} from "@adc/shadcn-design-system/release"
```

The root exports all 210 approved component, helper, and hook exports. The
41 component families include the governed Icon, Image and Link primitives. The
release entrypoint returns complete, deeply frozen contract and release data;
it needs no filesystem, Git, or contract validator at runtime. It is separate
from the component entrypoint so ordinary component imports do not load that
data. Declarations resolve without the repository's `@/` alias.

The new primitives keep their authoring APIs closed:

```tsx
<Icon name="search" size="default" />
<Icon name="check-circle" decorative={false} label="Saved" />
<Image src="/product.png" alt="Product overview" width={640} height={360} />
<Link href="/docs">Read the documentation</Link>
```

Icon offers 20 identities, three sizes, governed semantic color and optional inline placement. Logical
start/end arrows and chevrons follow RTL; physical directions remain fixed.
Image requires intrinsic pixel dimensions and explicit alt text (empty for a
decorative image), with bounded layout, fit and loading options. Link preserves
native anchor destinations, with optional explicit `newTab`. See
[Icon](docs/RELEASE-008-ICON.md), [Image](docs/RELEASE-008-IMAGE.md),
[Toggle Group](docs/RELEASE-008-TOGGLE-GROUP.md) and
[Link](docs/RELEASE-008-LINK.md) for decisions and contracts.

Import the stylesheet once at the application entrypoint. Consumers do not
need Tailwind to compile the design system. The stylesheet includes the
existing global base/reset rules, light tokens, `.dark` overrides, approved
component utilities, animations, and fonts. Place `.dark` on the document root
so default body portals inherit the same theme.

DialogContent and SelectContent accept an optional `portalContainer` with the
pinned Portal type `Element | DocumentFragment`. Pass the Canvas-owned overlay
DOM host to place their internal portals there. Omission keeps the original body
default. This is an environment value, never a selector string or an agent-authored
semantic prop. Keep the container inside the intended direction/theme scope.
Use the package public compound exports together so they share bundled contexts.

React and React DOM are exact `18.3.1` peers and build externals, including
their subpaths. The first Canvas compatibility inspection was read-only:
both `canvas/` and `semantic-renderer/` in the active M7 worktree at
`b66da463f401cf75fe1275a441422022aad6d318` declared `^18.3.1` and locked and installed `18.3.1`.
All other reached runtime dependencies are bundled. `radix-ui` and
`class-variance-authority` remain exact package dependencies because public
declarations reference their types. Use the exported compound component
families together; a consumer's separately imported Radix primitives do not
share the bundled context. This boundary targets client React applications;
React Server Component support is not established.

The build checks component/release reconciliation, frozen implementation inputs,
resolved dependency CSS/fonts, and actual build dependency coverage before reporting
success. Releases 001–007 remain immutable. Release 008 adds Icon, Image and Link
and strengthens Toggle Group selection using semantic tokens. The historical
Release 002 portal-container evidence remains in docs/CANVAS-PORTAL-RELEASE-002.md.

## Release and candidate identity (Task 6.2)

Use Node `22.18.0` and npm `10.9.3` for all commands. With Volta:

```sh
volta run --node 22.18.0 --npm 10.9.3 npm run release:generate
volta run --node 22.18.0 --npm 10.9.3 npm run build:library
volta run --node 22.18.0 --npm 10.9.3 npm run candidate:generate -- --output /tmp/release-008-candidate
```

`release:generate` reconciles reviewed source and contract changes into the active
Release 008 artifact only. It checks the frozen historical artifacts before and
after generation; it never regenerates Releases 001–007. `candidate:generate` verifies frozen
release inputs, builds into a fresh temporary output directory, runs `npm pack
--ignore-scripts`, and writes the tarball plus `distribution-manifest.json` to a
new external directory. It refuses to overwrite candidate evidence.

The release document has its own `documentSchemaVersion: 1`, independent of the
unchanged `projectionSchemaVersion: 1`. It contains package name/version/public
entrypoints and sorted implementation input paths, content SHA-256 digests, and
Git blob identities (null for installed dependency CSS/font files). Git blob IDs
identify the actual input bytes, including reviewed uncommitted edits; they are
not claims that those bytes have been committed.

Local code dependencies are derived through TypeScript module resolution from
the public declaration and build entrypoints. Script and contract/provenance
authority directories are enumerated for runtime-selected data. CSS imports,
font URLs, and their package export metadata form a separately traversed graph.
Build filesystem reads, Vite module/watch lists, and TypeScript declaration
sources must fit that frozen manifest. Compiler IPC files use a fresh private
scratch directory and are treated as generated outputs. Other installed build
and runtime dependency code is identified through the pinned lockfile; the
build-tool versions are also checked against it.

Keep the generator's printed manifest digest independently of the candidate
files. Keep the reviewed release payload digest independently of the release
file. Verification requires those retained expectations:

```sh
volta run --node 22.18.0 --npm 10.9.3 npm run release:verify -- --release-sha256 "$REVIEWED_RELEASE_SHA256"
volta run --node 22.18.0 --npm 10.9.3 npm run candidate:verify -- \
  --manifest /tmp/release-008-candidate/distribution-manifest.json \
  --tarball /tmp/release-008-candidate/adc-shadcn-design-system-0.0.0-release.8.tgz \
  --manifest-sha256 "$RETAINED_MANIFEST_SHA256"
volta run --node 22.18.0 --npm 10.9.3 npm run test:identity
```

Do not obtain verification expectations by rehashing the files being verified.
The verifier never refreshes the release, manifest, or candidate tarball. It
rebuilds producer outputs in a temporary directory and independently compares
all packed paths, sizes, and file hashes to the existing candidate. No consumer
application is installed or exercised.

The external manifest has `schemaVersion`, release ID/payload SHA-256, package
name/version, Node/npm/platform/architecture/build-tool versions, tarball
filename/SHA-256/npm SHA-512 integrity, and a sorted file inventory of path, size,
and SHA-256. It contains no self digest. Its retained external digest detects
manifest edits; its release reference detects coordinated source/release edits;
its packed-file inventory and independent rebuild detect modified package data.

The release never hashes itself, generated library files, tarballs, distribution
manifests, or acceptance records. The external manifest hashes the resulting
packed bytes and stays outside the package. This establishes candidate evidence
only; it does not publish a package or create a final Canvas acceptance record.
