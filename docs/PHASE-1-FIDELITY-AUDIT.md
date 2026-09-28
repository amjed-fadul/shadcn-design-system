# Phase 1 pinned-source fidelity audit

Audit date: 2026-08-31

The comparison source for every row is `shadcn-ui/ui` at commit
`1773ecfeeb4a04366978d353e69b5c7ded78dcb2`, using the corresponding file in
`apps/v4/registry/bases/radix/ui/`. The local implementation is intentionally
not byte-identical: repository aliases, `IconPlaceholder` replacements with
pinned `lucide-react` icons, Nova `cn-*` class flattening into canonical
semantic-token utilities, and reuse of local pinned components are allowed.

No package dependency was added. The Sidebar support hook is the pinned
upstream `use-mobile` behavior copied to `src/hooks/use-mobile.ts` so the
component does not depend on an unplanned external package.

| Component | Public API/behavior audit | Correction or accepted derivation |
| --- | --- | --- |
| Button | `Button`, `buttonVariants`, `asChild`, all upstream variants and sizes remain available. | Accepted: repository alias and semantic class normalization. |
| Badge | `Badge`, `badgeVariants`, `asChild`, all upstream variants remain available. | Accepted: repository alias and semantic class normalization. |
| Input | Native input props and `type` forwarding remain available. | Accepted: repository alias and semantic class normalization. |
| Separator | Radix separator props and orientation behavior remain available. | Accepted: removal of the framework-only directive, repository alias, and semantic class normalization. |
| Skeleton | Native div props remain available. | Accepted: repository alias and semantic class normalization. |
| Card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`, and `size` remain available. | Accepted: repository alias and semantic class normalization. |
| Textarea | Native textarea props remain available. | Accepted: repository alias and semantic class normalization. |
| Checkbox | Radix controlled/uncontrolled props, `CheckboxPrimitive.Indicator`, and state behavior remain available. | Accepted: pinned `Check` icon replaces `IconPlaceholder`; semantic class normalization. |
| Table | Table container plus all seven table subcomponents remain available. | Accepted: framework-only directive removal, repository alias, and semantic class normalization. |
| Label | Radix label props and label-control association remain available. | Accepted: framework-only directive removal, repository alias, and semantic class normalization. |
| Tabs | Root orientation, controlled/uncontrolled selection, keyboard behavior, list variants, triggers, and content remain available. Vertical orientation selectors were restored. | Accepted: repository alias and semantic class normalization. |
| Select | Root, group, value, trigger `size`, content `position`/`align`, labels, items, separators, viewport position, and scroll buttons remain available. Trigger value layout and content alignment metadata were restored. | Accepted: pinned Lucide icons and semantic class normalization. |
| Dropdown Menu | Root, portal, content alignment, item `inset`/`variant`, checkbox/radio `inset`, groups, submenus, labels, separators, and shortcuts remain available. Checkbox/radio `inset` and content `align` were restored. | Accepted: pinned Lucide icons and semantic class normalization. |
| Accordion | Root type/selection behavior, items, triggers, content, and keyboard behavior remain available. | Accepted: two `IconPlaceholder` states become one pinned `ChevronDown` with the equivalent Radix state rotation; semantic class normalization. |
| Dialog | Root, portal, overlay/content refs, trigger/close/title/description, `DialogContent.showCloseButton`, and `DialogFooter.showCloseButton` remain available. Footer close behavior was restored. | Accepted: pinned `X` icon, local Button reuse, ref forwarding, and semantic class normalization. |
| Sheet | Root, portal, overlay/content refs, side selection, `showCloseButton`, header/footer/title/description, and close behavior remain available. | Accepted: pinned `X` icon, local Button reuse, ref forwarding, and semantic class normalization. |
| Tooltip | Provider delay, root, trigger, portal content, arrow, and positioning props remain available. | Accepted: repository alias and semantic class normalization. |
| Scroll Area | Root, viewport, scrollbar orientation, thumb, and corner composition remain available. | Accepted: repository alias and semantic class normalization. |
| Sidebar | Provider controlled/uncontrolled state, cookie persistence, Cmd/Ctrl+B, mobile Sheet rendering, desktop variants, trigger callback ordering, and all upstream public subcomponents remain available. Missing group action, menu badge/skeleton/submenu APIs and responsive/provider behavior were restored. | Accepted: pinned local hook, local component reuse, icon replacement, and semantic class normalization. No public API reduction accepted. |
| Switch | `Switch` (Radix `Root`/`Thumb`), controlled/uncontrolled `checked`/`defaultChecked`, `onCheckedChange`, `required`, `disabled`, and the upstream `size` (`"sm"` \| `"default"`) variant all remain available. | Accepted: Nova `cn-switch`/`cn-switch-thumb` custom-variant shorthand (`data-checked`, `data-disabled`) flattened to literal Radix `data-[state=checked]`/native `disabled:` selectors bound to canonical semantic-token utilities (`bg-primary`, `bg-input`, `bg-background`, `border-ring`, `ring-ring`), consistent with the Checkbox precedent; upstream's extended `after:` hit-area and `aria-invalid` form-validation theming were dropped, matching the same simplification already accepted for Checkbox. |

## Release 003 addition: Switch

Audit date: 2026-09-08.

Switch was scaffolded by hand from the pinned upstream commit's
`apps/v4/registry/bases/radix/ui/switch.tsx` (fetched and diffed line by line
against `git hash-object`-verified content; `npx shadcn add switch` was not
used) rather than through the CLI, per the same "CLI output is not sufficient
evidence" policy as the rest of this table. The upstream source was screened
before acceptance for viewport-conditional classes (`sm:`/`md:`/`lg:`/`xl:`)
and viewport units (`svh`/`dvh`/`vh`/`vw`) — the same defect that excluded
Sidebar's responsive variant from this release and that task A2 removed from
Sheet. None were present in upstream `switch.tsx`, and none were introduced
in the canonical derivative; the `size` variant's dimensions use fixed `px`/
`rem`-scale Tailwind spacing utilities only.

## Explicit reductions

None. The audit found no Studio V1 justification for removing an upstream
public prop, subcomponent, controlled/uncontrolled path, keyboard path,
responsive path, accessibility behavior, provider behavior, or composition
semantic. The initial `DialogFooter`, Dropdown Menu `inset`, and Sidebar
reductions were restored and covered by regression tests. Switch's dropped
`after:` hit-area extension and `aria-invalid` theming are not public-API
reductions (no prop, subcomponent, or behavioral path was removed) and match
the simplification already accepted for Checkbox in this same table.
