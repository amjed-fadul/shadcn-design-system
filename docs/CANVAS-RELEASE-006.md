# Release 006 → Canvas handoff

Release `shadcn-radix-release-006` applies the owner-approved brand blue through the existing semantic token layer. It introduces token contract `shadcn-radix-token-contract-002` without adding, removing, or renaming tokens, and without changing component source or component facts. Releases 001–005 remain byte-for-byte unchanged.

## Exact distribution

- Producer source commit: `4ff8a1e2c34a55b79ae8888aaa382c259a5f923f`
- Package: `@adc/shadcn-design-system@0.0.0-release.6`
- Token contract: `shadcn-radix-token-contract-002` (`approved`)
- Component contract set: `shadcn-radix-component-contracts-001`
- Release payload SHA-256: `4ea2708bcc1869fd43771e7fffd9cf524151ea0918afdff4ac8e1afee2793f20`
- Release JSON SHA-256: `6fbdf4a98a7d0e5667e073857cd9beb3061b4d71b141dc38248008f37b8e7b43`
- Candidate tarball SHA-256: `0f7cc15e22b561b725e3d10efb3678b1b3f173b6a0d8c7d230d5217c0fb73e58`
- Candidate tarball integrity: `sha512-Wba8COjqpZ5VTLbe82/w2jOJy7dMwp2PLFXfgNiTbJRK+wFsGcy8q+hFL1yDVYVj6qRstKIESRbYxA5ls/RujA==`
- Distribution manifest SHA-256: `b6d9f7f16dd37bfe1cbdef65ada4b2164ab6f621c849b7bd239e8687021a3326`
- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-006/`
- Packed files: 53; executable implementation inputs: 349.
- Contract inventory: 82 tokens, 38 component families, 205 public exports.
- Toolchain: Node 22.18.0, npm 10.9.3, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1, esbuild 0.28.2.

The candidate verifier rebuilt the package from producer inputs and compared the entire tarball byte-for-byte to the retained candidate. All 53 packed files matched. The release verifier independently accepted the pinned release payload SHA. No package was published remotely.

## Brand token delta

Exactly six semantic colour tokens change, with one value per mode:

| Token | Light | Dark |
| --- | --- | --- |
| `color.primary` | `oklch(0.488 0.243 264.376)` | `oklch(0.707 0.165 254.624)` |
| `color.primary-foreground` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.ring` | `oklch(0.488 0.243 264.376)` | `oklch(0.707 0.165 254.624)` |
| `color.sidebar-primary` | `oklch(0.488 0.243 264.376)` | `oklch(0.707 0.165 254.624)` |
| `color.sidebar-primary-foreground` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.sidebar-ring` | `oklch(0.488 0.243 264.376)` | `oklch(0.707 0.165 254.624)` |

The light brand is Tailwind 4.3.3 `blue-700` (`#1447E6`); the dark brand is `blue-400` (`#51A2FF`). The brand is a value remap of existing `primary`, `ring`, and `sidebar-primary` semantics. Destructive, accent, muted, border, chart, and all other token values are unchanged.

## Contrast and rendered verification

The contract test computes WCAG 2.x contrast after converting OKLCH to sRGB. Both modes meet the 4.5:1 floor for primary foreground on primary, the `/80` primary hover composite, primary text on background, and sidebar primary foreground on sidebar primary. The exact full-strength ratios are 6.83:1 in light mode and 7.51:1 in dark mode.

The Storybook browser suite runs the rendered axe gate over all component stories. Release generation was run twice and produced byte-identical JSON. Historical release hashes for Releases 001–005 were checked before and after each generation.

Final verification completed with Node 22.18.0: TypeScript typecheck passed; the production Vite build passed; the unit suite passed 88 files and 1,215 tests; the Storybook browser/axe suite passed 39 files and 157 tests; and the static Storybook build passed. The static build emitted only its existing large-chunk advisory.

## Canvas consumption boundary

Canvas can vendor the exact candidate tarball above. Existing component APIs, component contracts, family count, export count, and authoring-policy boundaries are unchanged from Release 005. Consumers should adopt token contract `shadcn-radix-token-contract-002`; reusing `-001` for the new values would make one contract identity describe two different token sets.

This producer handoff does not include Canvas integration or any expansion of Canvas authoring policy.
