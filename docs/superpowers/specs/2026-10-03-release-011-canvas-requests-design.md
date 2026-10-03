# Release 011: Canvas visual-gap requests

**Status:** Release 011 candidate generated. The owner approved token contract `-003` as shown on
2026-10-03, after reviewing light and dark renders; the release awaits owner acceptance.
**Date:** 2026-10-03
**Request:** amjed-fadul/shadcn-design-system#19, from the Canvas visual-gap test
(amjed-fadul/agentic-design-canvas PR #50, `docs/design-system-requests/2026-10-03-visual-gap-requests.md`).
**Base:** `origin/main` at `9dca721` (Release 010).

## Purpose

The Canvas visual-gap test had agents build a revenue dashboard and a pricing page, once through Canvas
and once as plain React on Release 010. Both hit limits of the design system itself:

- positive trends and "Paid" in grey, because there are no status colors;
- charts faked from Progress bars or hand-drawn SVG, because `--chart-1..5` are greys;
- no navigation, download or trend icons;
- no primary-filled Badge;
- no square or rounded Avatar for logo tiles;
- display headlines with line-height 1;
- no `--radius-full`.

Release 011 adds the tokens and small component options for these. A governed chart family is larger,
needs a new dependency decision, and is proposed separately for Release 012
([proposal](2026-10-03-release-012-chart-family-proposal.md)).

## Decision record

| Ruling | Reason | Cost if wrong |
| --- | --- | --- |
| New token contract id `shadcn-radix-token-contract-003`, created as `candidate` | Tokens are added and five chart values change. Reusing `-002` would give one id two token sets. The executable projection refuses a candidate contract, so the owner approves `-003` before Release 011 is generated. | Mechanical churn: the component set, component source provenance and 40 family token-evidence references (Image has none) move to `-003`. |
| Add `success`, `warning` and `info`, each with a `-foreground` pair | The request names these three roles. They follow the existing `primary`/`primary-foreground` model: the role colour is both a fill and a text colour. | Low; additive. |
| Status values come from the pinned Tailwind 4.3.3 palette: success green-800/green-400, warning amber-800/amber-400, info sky-700/sky-400 (light/dark) | Each value must pass 4.5:1 as text on background, card and muted, on its own 10% and 15% tint (Badge rest and link hover) over background and card, and with its foreground on the solid fill. emerald-700, green-700 and amber-700 fail the 15% tint; sky stays apart from the blue brand. | Low; values only. The contrast test pins every pairing. |
| Status foregrounds are white in light mode and `oklch(0.145 0 0)` in dark mode | The same rule as the approved brand: light fills are dark enough for white text, dark fills are light enough for near-black text. | None. |
| Chart palette: blue, lime, cyan, violet, pink (Tailwind 4.3.3 steps) | Chosen by enumerating every ordering of chart-eligible hues and running the six-check categorical validator (lightness band, chroma floor, protan/deutan separation, normal-vision floor, contrast against card) in both modes. Adjacent pairs include the wrap from slot 5 to slot 1, for donut charts. Green, amber, sky and red are excluded so a series never impersonates a status. `chart-1` in light mode is the brand blue. | Low; values only. The palette test re-runs the checks from contract values. |
| `radius.full` = `calc(infinity * 1px)` in the canonical theme | Canvas maps pill radius to a token. The value equals Tailwind's static `rounded-full`. | None. |
| `rounded-full` becomes a `radius.full` dependency | Once `--radius-full` exists, Tailwind 4.3.3 compiles `rounded-full` from the theme value. Compiling with a distinguishable value proved it: `--radius-full: 12345px` turns `rounded-full` into `border-radius: 12345px`. The 12 exports in 8 families that use `rounded-full` (Avatar, Badge, Drawer, Progress, Radio Group, Scroll Area, Slider, Switch) gain the dependency. The value equals the old static utility, so rendering is unchanged. An earlier draft of this ruling missed this; the independent review oracle caught it. | None for rendering; token facts only. |
| `line-height.display` = `1.1` in the canonical theme | One display leading for two-line headlines at `text-5xl` to `text-9xl`, whose own line-height is 1. The Tailwind font-size tokens stay unchanged and pinned to Tailwind. | Low; additive. |
| Container and breakpoint tokens are **not** added | The token contract excludes the `container` and `breakpoint` namespaces as a Phase 2 scope invariant. CSS custom properties cannot drive media queries, so breakpoint tokens would be documentation only. Lifting the exclusion is a scope decision for the owner. | Canvas keeps raw values for responsive layout until the owner decides. |
| Badge keeps `default` neutral and adds a `primary` variant | Release 009 made `default` neutral on purpose (quiet semantic states). Changing it would repaint every existing Badge. `primary` restores shadcn's primary fill. | Low; additive. |
| Badge adds `success`, `warning` and `info` as tinted variants | They mirror `destructive`'s shape (10% tint, 20% border, 15% link hover) but use the status colour for text, which the contrast floor allows. | Low; additive. |
| Alert adds `success`, `warning` and `info` variants that mirror `destructive` | Same structure as the existing destructive Alert: tinted border, background surface, status-coloured text and icon. | Low; additive. |
| Icon adds 19 content identities and `success`, `warning`, `info` colours | Curated from the request: `home`, `users`, `receipt`, `credit-card`, `chart-column`, `settings`, `download`, `calendar`, `trending-up`, `trending-down`, `arrow-up`, `arrow-down`, `clock`, `star`, `shield`, `lock`, `building`, `quote`, `bell`. All are physical (no RTL mirroring). `chart-column` names the Lucide glyph exactly so later `chart-line` or `chart-pie` identities stay unambiguous. | Low; the registry stays finite and private. |
| Avatar adds `shape?: "circle" \| "rounded" \| "square"`, default `circle` | Logo tiles and workspace marks need non-circular shapes. `rounded` uses `rounded-lg` (the 8px container radius); `square` has no radius. The image, fallback and border ring follow the shape through the existing `group/avatar` data-attribute pattern. | Low; additive. |
| Component contract set keeps id `-001` | Repository precedent: the set kept `-001` through Releases 002 to 010 while families changed. | Low. |
| Ship as Release 011, package `0.0.0-release.11`; freeze the Release 010 record and manifest | Same identity process as Release 010. | Low. |

## Token changes

Eight tokens are added (82 → 90) and five change value.

| Token | Light | Dark |
| --- | --- | --- |
| `color.success` (new) | `oklch(0.448 0.119 151.328)` | `oklch(0.792 0.209 151.711)` |
| `color.success-foreground` (new) | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.warning` (new) | `oklch(0.473 0.137 46.201)` | `oklch(0.828 0.189 84.429)` |
| `color.warning-foreground` (new) | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.info` (new) | `oklch(0.5 0.134 242.749)` | `oklch(0.746 0.16 232.661)` |
| `color.info-foreground` (new) | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `color.chart-1` | `oklch(0.87 0 0)` → `oklch(0.488 0.243 264.376)` | `oklch(0.87 0 0)` → `oklch(0.546 0.245 262.881)` |
| `color.chart-2` | `oklch(0.556 0 0)` → `oklch(0.648 0.2 131.684)` | `oklch(0.556 0 0)` → `oklch(0.648 0.2 131.684)` |
| `color.chart-3` | `oklch(0.439 0 0)` → `oklch(0.609 0.126 221.723)` | `oklch(0.439 0 0)` → `oklch(0.609 0.126 221.723)` |
| `color.chart-4` | `oklch(0.371 0 0)` → `oklch(0.491 0.27 292.581)` | `oklch(0.371 0 0)` → `oklch(0.541 0.281 293.009)` |
| `color.chart-5` | `oklch(0.269 0 0)` → `oklch(0.592 0.249 0.584)` | `oklch(0.269 0 0)` → `oklch(0.592 0.249 0.584)` |
| `radius.full` (new) | `calc(infinity * 1px)` | same |
| `line-height.display` (new) | `1.1` | same |

Palette origin (recorded in provenance, not as a contract relationship): success green-800/green-400,
warning amber-800/amber-400, info sky-700/sky-400, chart light blue-700, lime-600, cyan-600, violet-700,
pink-600 and chart dark blue-600, lime-600, cyan-600, violet-600, pink-600.

## Contrast and palette floors

`tests/token-contract-status-contrast.test.ts` computes, from contract values, in both modes:

- status text on background, card and muted: ≥ 4.5;
- status text on its 10% and 15% tint over background and over card: ≥ 4.5;
- `-foreground` on the solid status fill: ≥ 4.5.

`tests/token-contract-chart-palette.test.ts` checks, in both modes:

- each chart colour against card and background: ≥ 3:1 (WCAG 1.4.11 non-text contrast);
- OKLCH lightness band (0.43–0.77 light, 0.48–0.67 dark) and chroma ≥ 0.10;
- adjacent pairs, including the 5→1 wrap: protanopia and deuteranopia ΔE (OKLab ×100, Machado 2009
  severity 1.0) ≥ 8, and unsimulated ΔE ≥ 15.

## Component API changes

| Component | Prop | Before | After |
| --- | --- | --- | --- |
| Badge | `variant` | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` | adds `primary`, `success`, `warning`, `info` |
| Alert | `variant` | `default`, `destructive` | adds `success`, `warning`, `info` |
| Icon | `name` | 20 identities | adds 19 content identities (39) |
| Icon | `color` | `inherit`, `foreground`, `primary`, `muted-foreground`, `destructive` | adds `success`, `warning`, `info` |
| Avatar | `shape` | — | new: `circle` (default), `rounded`, `square` |

Defaults are unchanged, so every existing usage renders as before.

## Out of scope

- The governed chart family (Release 012 proposal).
- Container and breakpoint tokens. The owner confirmed on 2026-10-03 to keep them excluded until
  Canvas gets responsive pages; Canvas pages are fixed at 1440×900 in V1.
- A display-size typography scale beyond the single display leading.
- Canvas adoption. Canvas adopts Release 011 later, in its own repository, through its governed
  component addition checklist and presentation-policy mapping.
