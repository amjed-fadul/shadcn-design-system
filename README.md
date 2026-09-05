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

The build checks existing component/release reconciliation, the canonical
stylesheet blob, and the pinned Tailwind theme/compiler hashes before emitting
output. Verification of the full resolved CSS/font input chain, including
shadcn, tw-animate-css, and Geist, remains part of Task 6.2. It does not change approved
source files or `release-001`. Task 6.1 establishes the package surface only:
source/artifact identity binding (6.2), an isolated tarball consumer proof
(6.3), and final release verification (6.4) remain outstanding. No final
installable tarball or distribution identity is produced at this stage.
