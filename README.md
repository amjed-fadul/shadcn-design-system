# shadcn Design System

Canonical governed shadcn design system for Agentic Design Canvas product work.

This repository is separate from Canvas. The official shadcn repository is upstream/reference only; Canvas will eventually consume immutable contracted releases from this repository.

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

The private package version is `0.0.0-release.1`. The separate `dist-library/`
output contains ES modules, compiled CSS with embedded fonts, TypeScript
declarations, and bundled dependency notices. The existing app and Storybook
builds remain available. The public API has exactly three entrypoints:

```tsx
import { Button, Card, Tabs, Dialog } from "@adc/shadcn-design-system"
import "@adc/shadcn-design-system/styles.css"
import {
  getExecutableRelease,
  getComponentContracts,
  getTokenContract,
} from "@adc/shadcn-design-system/release"
```

The root exports all 107 approved component, helper, and hook exports. The
release entrypoint returns complete, deeply frozen contract and release data;
it needs no filesystem, Git, or contract validator at runtime. It is separate
from the component entrypoint so ordinary component imports do not load that
data. Declarations resolve without the repository's `@/` alias.

Import the stylesheet once at the application entrypoint. Consumers do not
need Tailwind to compile the design system. The stylesheet includes the
existing global base/reset rules, light tokens, `.dark` overrides, approved
component utilities, animations, and fonts. Place `.dark` on the document root
so portaled content inherits the same theme.

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
success. The package remains a candidate: isolated consumer proof is Task 6.3;
final acceptance is Task 6.4.

## Release and candidate identity (Task 6.2)

Use Node `22.18.0` and npm `10.9.3` for all commands. With Volta:

```sh
volta run --node 22.18.0 --npm 10.9.3 npm run release:generate
volta run --node 22.18.0 --npm 10.9.3 npm run build:library
volta run --node 22.18.0 --npm 10.9.3 npm run candidate:generate -- --output /tmp/release-001-candidate
```

`release:generate` is an explicit reconciliation operation: it updates the same
release-001, but aborts if the executable projection changes. Use it only when
reconciling reviewed source/build changes. `candidate:generate` verifies frozen
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
  --manifest /tmp/release-001-candidate/distribution-manifest.json \
  --tarball /tmp/release-001-candidate/adc-shadcn-design-system-0.0.0-release.1.tgz \
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
only; it creates no release-002 or final Canvas acceptance record.
