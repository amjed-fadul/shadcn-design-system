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

## Explicit reductions

None. The audit found no Studio V1 justification for removing an upstream
public prop, subcomponent, controlled/uncontrolled path, keyboard path,
responsive path, accessibility behavior, provider behavior, or composition
semantic. The initial `DialogFooter`, Dropdown Menu `inset`, and Sidebar
reductions were restored and covered by regression tests.
