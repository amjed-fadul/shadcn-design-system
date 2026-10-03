# Release 011 → Canvas handoff

Release `shadcn-radix-release-011` answers the design-system half of the Canvas visual-gap requests
(amjed-fadul/shadcn-design-system#19). It adds status colours, a coloured chart palette, `radius.full`
and `line-height.display` under token contract `shadcn-radix-token-contract-003`. It also extends
Badge, Alert, Icon and Avatar. Every existing default renders as before. Releases 001–010 remain
byte-for-byte unchanged.

**Status: candidate.** The owner approved token contract `-003` on 2026-10-03 after reviewing light
and dark renders. The release itself awaits owner acceptance; Canvas should adopt it only after that.

## Exact distribution

**Identities**

- Producer source commit: `f55582a7d80d65a43bc71d728611d091b23ef422`
- Package: `@adc/shadcn-design-system@0.0.0-release.11`
- Release: `shadcn-radix-release-011`
- Token contract: `shadcn-radix-token-contract-003` (`approved`)
- Component contract set: `shadcn-radix-component-contracts-001`

**Hashes**

- Release payload SHA-256: `fc2d8b8493a75ddaeb7eed1305ebd3360903d62512791bc839df40499263c5d6`
- Release JSON SHA-256: `af2744c4e0926436fa19d649afc103227155b8dc289accca1be78907a7b88e67`
- Candidate tarball SHA-256: `82cf24711be4c6392837cc66c8d9c2eceb7841773e19223ff7c2af30f8a42a94`
- Candidate tarball integrity:
  `sha512-2M+Uv17VzYjxl7+fqCFYE+seOmrU3J+rusuxOBam/0Ksie2bmt27blRyFSNw2lz5uPzjfajGXstYGe+/dIYxOA==`
- Distribution manifest SHA-256: `ed3827ab6861637879823a3147c6c3e92aae41b24d5938cf41578dbb697e8a5f`
  (also committed as `provenance/distributions/shadcn-radix-release-011.distribution.json`)

**Candidate**

- External candidate: `/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-011-candidate/`
- Packed files: 56; executable implementation inputs: 364.
- Contract inventory: 90 tokens, 41 component families, 210 public exports. The family and export
  counts are unchanged from Release 010.
- Peers: `react` and `react-dom` `^18.3.1 || ^19.0.0`, unchanged.
- Toolchain: Node 22.18.0, npm 10.9.3, darwin arm64, Vite 7.3.6, TypeScript 5.5.4, Rollup 4.63.1,
  esbuild 0.28.2.

## New and changed tokens

Token contract `shadcn-radix-token-contract-003`: 90 tokens (82 + 8). Five chart values change. Use the
CSS variable through Page-scoped resolution, as for existing tokens. The packaged stylesheet emits
every contracted variable, including the theme-only `--radius-full` and `--leading-display`.

| Token id | CSS variable | Tailwind theme variable | Light | Dark |
| --- | --- | --- | --- | --- |
| `color.success` | `--success` | `--color-success` | `oklch(0.448 0.119 151.328)` | `oklch(0.792 0.209 151.711)` |
| `color.success-foreground` | `--success-foreground` | `--color-success-foreground` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.warning` | `--warning` | `--color-warning` | `oklch(0.473 0.137 46.201)` | `oklch(0.828 0.189 84.429)` |
| `color.warning-foreground` | `--warning-foreground` | `--color-warning-foreground` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.info` | `--info` | `--color-info` | `oklch(0.5 0.134 242.749)` | `oklch(0.746 0.16 232.661)` |
| `color.info-foreground` | `--info-foreground` | `--color-info-foreground` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.chart-1` (changed) | `--chart-1` | `--color-chart-1` | `oklch(0.488 0.243 264.376)` | `oklch(0.546 0.245 262.881)` |
| `color.chart-2` (changed) | `--chart-2` | `--color-chart-2` | `oklch(0.648 0.2 131.684)` | `oklch(0.648 0.2 131.684)` |
| `color.chart-3` (changed) | `--chart-3` | `--color-chart-3` | `oklch(0.609 0.126 221.723)` | `oklch(0.609 0.126 221.723)` |
| `color.chart-4` (changed) | `--chart-4` | `--color-chart-4` | `oklch(0.491 0.27 292.581)` | `oklch(0.541 0.281 293.009)` |
| `color.chart-5` (changed) | `--chart-5` | `--color-chart-5` | `oklch(0.592 0.249 0.584)` | `oklch(0.592 0.249 0.584)` |
| `radius.full` | `--radius-full` | — | `calc(infinity * 1px)` | same |
| `line-height.display` | `--leading-display` | — | `1.1` | same |

### Pairings Canvas can declare

The contract tests prove these pairings in both modes, from the exact contract values:

- **Status text:** `success`, `warning` and `info` as text (tone) on `background`, `card` and `muted`
  meet 4.5:1. They also meet 4.5:1 on their own 10% and 15% tint over `background` and `card`.
- **Status fills:** `success-foreground` on `success`, and the same for `warning` and `info`, meet
  4.5:1 as solid fills.
- **Chart marks:** `chart-1` to `chart-5` meet 3:1 non-text contrast against `card` and `background`.
  Adjacent slots, including 5 next to 1, stay apart under protanopia, deuteranopia and normal vision.
  Assign series in slot order and never reuse a status colour for a series.
- **Display headlines:** `line-height.display` pairs with `font-size.5xl` to `font-size.9xl` for
  headlines that wrap to two lines. Single-line display text can keep the size's own line-height.
- **Pills:** `radius.full` is the pill radius. It equals Tailwind's static `rounded-full`, which DS
  components keep using; no component contract depends on the variable.

Canvas's build-time presentation-policy contrast matrix should re-check every tone and surface pair it
declares.

## Component additions

Every change below is additive. Defaults are unchanged.

| Family | Export | Prop | Release 010 | Release 011 |
| --- | --- | --- | --- | --- |
| badge | `Badge` | `variant` | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` | adds `primary`, `success`, `warning`, `info` |
| alert | `Alert` | `variant` | `default`, `destructive` | adds `success`, `warning`, `info` |
| icon | `Icon` | `name` | 20 identities | adds `home`, `users`, `receipt`, `credit-card`, `chart-column`, `settings`, `download`, `calendar`, `trending-up`, `trending-down`, `arrow-up`, `arrow-down`, `clock`, `star`, `shield`, `lock`, `building`, `quote`, `bell` (39) |
| icon | `Icon` | `color` | `inherit`, `foreground`, `primary`, `muted-foreground`, `destructive` | adds `success`, `warning`, `info` |
| avatar | `Avatar` | `shape` | — | new optional enum `circle` (default), `rounded`, `square`; renders `data-shape` |

Usage:

```tsx
<Badge variant="primary">Most popular</Badge>
<Badge variant="success">Paid</Badge>
<Alert variant="warning"><Icon name="alert-circle" /><AlertTitle>Card expires soon</AlertTitle></Alert>
<Icon name="trending-up" color="success" decorative={false} label="Up 12.4%" />
<Avatar shape="rounded"><AvatarImage src="/logo.png" alt="Acme" /><AvatarFallback>AC</AvatarFallback></Avatar>
```

- **Badge:** `primary` is the primary fill. The status variants use a 10% tint, a 20% border and
  status-coloured text, with a 15% hover tint on link badges. `default` stays neutral, as decided in
  Release 009.
- **Alert:** the status variants mirror `destructive`: a 30% status border, background surface,
  status-coloured title, description and icon. Alert keeps `role="alert"`.
- **Icon:** the content identities are physical and never mirror in RTL. `building` is Lucide
  `Building2` and `home` is Lucide `House`.
- **Avatar:** `rounded` uses the 8px container radius (`rounded-lg`) and `square` has no radius.
  AvatarImage, AvatarFallback and the border ring follow the shape. AvatarBadge and AvatarGroupCount
  are unchanged. Use `circle` for people and `rounded` or `square` for organisations and logos.
- **Status meaning:** status colour never carries meaning alone. Keep the visible label ("Paid") or a
  meaningful Icon label.

## Family hashes

Pinned at the producer commit by the release record's implementation inputs (blob id) and by file bytes
(SHA-256).

| File | Blob id | SHA-256 |
| --- | --- | --- |
| `contracts/tokens/token-contract.json` (`-003`, approved) | `d8af268581cb3923146bc2e2cce84b3060afddd1` | `59685d1025a216148d5bd00a97ec1fed20b14f8b7484931cd46f7c9f234b05eb` |
| `contracts/tokens/index.json` | `7730eab20b73bbc93fb2aacfd5065ecda58f66b9` | `bba5ba917e41ce19b84f001569dea36ae661893170e21c2d9b39e26d41046517` |
| `contracts/components/component-contract-set.json` | `1e25aab8ca67520c901739653d31d6b35c442119` | `c77cf8c76f47ca556a3ca8e63ae18e5c2d61641b04bde216475536b84f357107` |
| `contracts/components/families/badge.json` | `61ec3d1d2d783acb724e3bdbb1946750a656ec6c` | `bcee435c8b17b62ce8e462c291b370b34d0632e6c4d71e89d6e9f56284162db7` |
| `contracts/components/families/alert.json` | `71be35bbfe6097031f674c298732601f7d3bb4da` | `07855c4daca0b447f122eca38e32da1a990c23ba97e0cc58fc4def2c7f599483` |
| `contracts/components/families/avatar.json` | `f4f599fa5cf1f18c89b8e8812bf91114bfeb020b` | `27484b2351042c5b92ce6fd6dd08c8334686497b117de15c371af4bd23b67d6c` |
| `contracts/components/families/icon.json` | `e95b2f7ca04e5e506437205a9995878285a66f6b` | `310b287a59e6be58da084a5bc94edd9deba264fc0babfcc426ea4dd6dc374ed0` |
| `src/index.css` (canonical theme) | `a3f9531864eb56bc1e55746a31032fd8fcbdf2ac` | `3128e8eb5e3de3b3e41f98958083efe978571e6da13ac9fdab245416a205fb62` |
| `src/components/ui/badge.tsx` | `5146fddeeba3b7da829a09ff34d61e255db57c9b` | `a75de0a1e69efe5d5dfc6d2f3e4344a045c8c48df7305bb12664e0dd9d816052` |
| `src/components/ui/alert.tsx` | `326810157ee3ed1bf9bc4574a3b0881453bf115f` | `9ccbfeb560178aa2bb00cd4edb332e345ff4f8ade81e04dc8ab703017d9296e0` |
| `src/components/ui/avatar.tsx` | `cedc3758d9bfda30ca639c4779d7e5996ccc621a` | `52d425de02821453c1b428350caabf59ad55a114dc1a0c8f5037f9fdd91cfd5b` |
| `src/components/ui/icon.tsx` | `35e3b96847b5263c31dfa01befdde36a67a88d73` | `d8424b8e7d59c1f03f970a1aba00feaadcf0acc3acf446e0a061b36a55f07111` |

Every other family contract changes only its token-evidence reference (`-002` → `-003`); its facts
are unchanged.

## Canvas adoption checklist

Canvas adopts Release 011 in its own repository, following
`docs/architecture/GOVERNED-COMPONENT-ADDITION-CHECKLIST.md`. No new family or export is added, so
the authorable-set count and roster tests (Trap 1) should not change. What does change:

1. **Vendor and pin:** vendor the exact tarball above and pin the release, token contract and
   manifest identities.
2. **Authoring policy:**
   - `design-system-registry/src/shadcn-authoring-policy.ts`: allow the new Badge, Alert and Icon
     enum values and the Avatar `shape` prop, read from the shipped contract.
   - Icon colour stays an enum, so no free-form colour is introduced.
3. **Presentation policy:** in `design-system-registry/src/shadcn-presentation-policy.ts`, map the new
   tones and surfaces to the token ids above:
   - status text tones: `success`, `warning`, `info`;
   - status surfaces with paired foregrounds;
   - `radius.full` for pill radius;
   - `line-height.display` for display text.

   Let the contrast matrix re-check every declared pair.
4. **Renderer:** the existing Badge, Alert, Icon and Avatar adapters pass the new values through.
   Add a test that renders each new value and asserts real DOM output (checklist step 7).
5. **Charts:** keep the coloured palette for chart marks only. A governed chart family wrapping
   Recharts is drafted for Release 012
   ([draft spec](superpowers/specs/2026-10-03-release-012-chart-family-proposal.md)); until it ships,
   Canvas has no chart component.

## Not included

- **Container and breakpoint tokens:** the token contract excludes the `container` and `breakpoint`
  namespaces by a Phase 2 scope invariant. Lifting it is an owner decision.
- **Chart family:** drafted for Release 012 (Recharts behind a closed API); it needs owner approval of
  the spec.
