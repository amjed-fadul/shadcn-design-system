# Brand Blue Token Contract 002 Design

**Status:** Approved colours; contract awaiting owner approval
**Date:** 2026-09-28
**Repository:** `amjed-fadul/shadcn-design-system`
**Base:** `codex/release005-overlay-rtl` at `ca313a7` (open PR #12, Release 005)

## Purpose

Give the shadcn design system a brand colour. The owner reviewed live previews of the real components and chose shadcn's blue. The brand applies by changing the **values** of existing semantic tokens. No token is added, renamed or removed, so the 82-token vocabulary, component source and component token dependencies stay the same.

## Decision record

| Ruling | Reason | Cost if wrong |
| --- | --- | --- |
| Remap semantic tokens instead of adding a `--brand` token | Every component already consumes `primary`, `ring` and `sidebar-primary`. A new token would reach no component without source edits and new component facts. | Low. A dedicated brand token can be added later as a new contract version. |
| Light brand is `oklch(0.488 0.243 264.376)` (#1447E6) | Owner's choice. It is the dark `--sidebar-primary` shadcn already ships, and Tailwind 4.3.3 `--color-blue-700`. White text reaches 6.83:1. | Low; values only. |
| Dark brand is `oklch(0.707 0.165 254.624)` (#51A2FF) with near-black text | #1447E6 as `text-primary` on the dark background is 2.90:1 and fails AA. No single blue passes both white button text and text on near-black. The owner chose the lighter blue for dark mode. It is Tailwind 4.3.3 `--color-blue-400`. | Low; values only. |
| Light `--primary-foreground` becomes pure white `oklch(1 0 0)` | The button hover is `bg-primary/80`. With `#FAFAFA` text it drops just under 4.5:1; with white it is 4.58:1. | None; visually identical. |
| Destructive, accent, muted, border, chart and all non-brand tokens are unchanged | Blue and red do not collide, so there is no reason to widen the change. | None. |
| New contract id `shadcn-radix-token-contract-002` | Releases 001–005 shipped `-001` with neutral values. Reusing the id would give one id two sets of values. | Mechanical churn: the component set and 38 family evidence references move to `-002`. |
| Component contract set keeps id `-001`; only its `tokenContractId` and family token-evidence references change | Repository precedent: the set kept `-001` while it grew from 19 to 38 families. No component facts change. | Low. |
| Ship as Release 006 on top of Release 005 | Release 005 (PR #12) already contains Releases 002–005. Branching from `main` would collide with their ids. | If PR #12 changes before merging, this branch rebases on it. |

## Token changes

Exactly six colour tokens change, twelve mode values in total.

| Token | Light (was → now) | Dark (was → now) |
| --- | --- | --- |
| `color.primary` | `oklch(0.205 0 0)` → `oklch(0.488 0.243 264.376)` | `oklch(0.922 0 0)` → `oklch(0.707 0.165 254.624)` |
| `color.primary-foreground` | `oklch(0.985 0 0)` → `oklch(1 0 0)` | `oklch(0.205 0 0)` → `oklch(0.145 0 0)` |
| `color.ring` | `oklch(0.708 0 0)` → `oklch(0.488 0.243 264.376)` | `oklch(0.556 0 0)` → `oklch(0.707 0.165 254.624)` |
| `color.sidebar-primary` | `oklch(0.205 0 0)` → `oklch(0.488 0.243 264.376)` | `oklch(0.488 0.243 264.376)` → `oklch(0.707 0.165 254.624)` |
| `color.sidebar-primary-foreground` | `oklch(0.985 0 0)` → `oklch(1 0 0)` | `oklch(0.985 0 0)` → `oklch(0.145 0 0)` |
| `color.sidebar-ring` | `oklch(0.708 0 0)` → `oklch(0.488 0.243 264.376)` | `oklch(0.556 0 0)` → `oklch(0.707 0.165 254.624)` |

## Contrast floor

These pairings are measured with WCAG 2.x relative luminance, after converting OKLCH to sRGB. `/80` means the colour composited at 80% over the page background.

| Pairing | Light | Dark | Floor |
| --- | --- | --- | --- |
| `primary-foreground` on `primary` | 6.83 | 7.51 | 4.5 |
| `primary-foreground` on `primary/80` over `background` (hover) | 4.58 | 5.12 | 4.5 |
| `primary` text on `background` (links) | 6.83 | 7.51 | 4.5 |
| `sidebar-primary-foreground` on `sidebar-primary` | 6.83 | 7.51 | 4.5 |

A new unit test computes these from the contract values, so a later value change cannot silently fall below the floor. The Storybook axe gate remains the rendered-UI check.

## Governance changes

- `src/index.css`: the twelve values above.
- `contracts/tokens/token-contract.json`: id `-002`, the new values and `sourceBaselineCommit` set to the commit that changes `src/index.css`. It is created with status `candidate`. `baselineSnapshotId` stays `shadcn-radix-bootstrap-000`, because the token structure still derives from that snapshot. The brand values are recorded as an owner-authored layer in provenance.
- `provenance/token-contract-source.json`: the new `src/index.css` blob, the new baseline commit and a `brandLayer` record. The record lists the six tokens, the owner decision and the Tailwind 4.3.3 palette entries the values match. It records where the values came from; it creates no primitive-palette relationship in the contract.
- Schema, types, index and tests that pin the id `-001` move to `-002`.
- `contracts/components/component-contract-set.json` and the 38 family `evidence.tokens.source` references move to `-002`.
- Release 006: package version `0.0.0-release.6`, the release generation script preserves Release 005's hash, a new `provenance/releases/shadcn-radix-release-006.json`, a verified candidate tarball and `docs/CANVAS-RELEASE-006.md`. Releases 001–005 stay byte-for-byte unchanged.

## Approval

The owner approved the colours on 2026-09-28. Contract approval is separate: the executable projection refuses a `candidate` token contract, so Release 006 can only be generated after the owner flips `-002` to `approved`. The branch is prepared up to that point, and approval, release generation and candidate verification happen in one final step.

## Out of scope

- Component source or class changes, including a dedicated hover shade.
- Chart colours, destructive and the pre-existing 4.01:1 light destructive-on-tint pairing, which is tracked separately.
- A new bootstrap snapshot.
- Canvas integration.
