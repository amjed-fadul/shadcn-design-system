# Task 6.3 React 18 ref-composition audit

Initial audit performed before production edits against HEAD `a07117fe380ec1fc8527641817e8547a2bb9d540`: 19 approved families, 107 exports. Classification describes the pre-repair state. Terra review identified three adjacent overlay triggers; the seven-export scope below incorporates that follow-up before final candidate generation.

A = native DOM host (including local styled wrappers); B = Radix DOM primitive wrapper; C = helper/hook or component without its own referenceable DOM host; D = already forwards a DOM ref. These classes do not by themselves determine whether a repair is needed.

## Exact affected set

- **Button**: Dialog/Dropdown/Tooltip asChild → Button; original browser RED and pinned examples.
- **DialogTrigger**: TooltipTrigger asChild → DialogTrigger asChild → Button; Radix documented nested-trigger path.
- **SidebarMenuButton**: DropdownMenuTrigger asChild → SidebarMenuButton; pinned sidebar-07 nav-user/team-switcher.
- **SidebarMenuAction**: DropdownMenuTrigger asChild → SidebarMenuAction; pinned sidebar-07 nav-projects.

- **TooltipTrigger**: DialogTrigger asChild → TooltipTrigger asChild → Button; Radix discussion #560 documents a trigger nested inside another overlay trigger and the maintainer's requirement to forward props/ref.
- **DropdownMenuTrigger**: TooltipTrigger asChild → DropdownMenuTrigger asChild → Button/SidebarMenuButton; the same primary discussion establishes shared tooltip/dropdown triggers.
- **SheetTrigger**: TooltipTrigger asChild → SheetTrigger asChild → Button; SheetTrigger wraps the exact Dialog primitive from the documented tooltip/dialog chain.

This is seven wrappers across six families, not a family-wide migration. Ref support on unrelated DOM wrappers is not claimed. Native-trigger behavior, outbound Slot delegation and internal primitive refs do not prove that a wrapper can accept an incoming parent ref. For example, SidebarMenuButton’s built-in tooltip attaches to its internal host directly; its external DropdownMenuTrigger path still needs forwarding.

## Evidence sources

- Local stories/tests and production composition: `src/components/ui/button.stories.tsx`, `sheet.stories.tsx`, `dialog.tsx`, `sheet.tsx`, `sidebar.tsx`, `tests/studio-components-*.test.tsx`, and the original isolated consumer.
- Contracts/guidance: all `contracts/components/families/*.json`, component rendering/slot/inherited-interface facts, and `contracts/knowledge/components/*.json`. Existing `slots[].refForwarding` supports factual `supported` status for six affected exports; TooltipTrigger currently has no slot entry, so its behavior remains tested implementation evidence with source identity. No new schema or slot is invented.
- [Radix composition guide](https://www.radix-ui.com/primitives/docs/guides/composition): custom children must pass needed refs; documented Tooltip.Trigger → Dialog.Trigger → custom button composition establishes an incoming ref for DialogTrigger.
- [Pinned shadcn nav-user](https://github.com/shadcn-ui/ui/blob/1773ecfeeb4a04366978d353e69b5c7ded78dcb2/apps/v4/registry/bases/radix/blocks/sidebar-07/components/nav-user.tsx#L40) and [team-switcher](https://github.com/shadcn-ui/ui/blob/1773ecfeeb4a04366978d353e69b5c7ded78dcb2/apps/v4/registry/bases/radix/blocks/sidebar-07/components/team-switcher.tsx#L42): dropdown trigger wraps SidebarMenuButton.
- [Pinned shadcn nav-projects](https://github.com/shadcn-ui/ui/blob/1773ecfeeb4a04366978d353e69b5c7ded78dcb2/apps/v4/registry/bases/radix/blocks/sidebar-07/components/nav-projects.tsx#L45): dropdown trigger wraps SidebarMenuAction.
- Pinned dialog/dropdown/tooltip examples also use Button as an asChild child. Upstream sources were consulted as composition evidence, not copied as a React 19 implementation template.

[Radix discussion #560](https://github.com/radix-ui/primitives/discussions/560) records a trigger-child Tooltip composition and the maintainer's props/ref-forwarding requirement. The initial audit excluded TooltipTrigger/DropdownMenuTrigger/SheetTrigger based on their outer-parent position in selected examples. Terra correctly identified that this did not cover supported shared-overlay-trigger chains. All three were reproduced RED and repaired sequentially; their table actions below supersede that initial exclusion. The stage-one audit is retained in the external evidence snapshot.

SelectTrigger, TabsTrigger, AccordionTrigger and other content/item wrappers could theoretically be wrapped by another primitive, but neither the local/pinned examples nor the primary sources reviewed establish another concrete supported incoming-ref path. This is not a blanket promise that all focusable exports accept refs. The remaining 100 exports are unchanged, including the three already forwarding public refs. Input/Textarea and SidebarInput have ordinary form usage; no supported form-controller/anchor parent was found in this 19-family vocabulary. Badge/link, sidebar group/sub-button outbound Slot usages do not independently establish an incoming parent-ref requirement. Layout/card/table/label/separator/scroll/content wrappers remain unchanged absent such a path.

## Complete export table

| Export | Family | Class | Ref-sensitive composition? | Current forwarding | Action / evidence |
| --- | --- | --- | --- | --- | --- |
| `Accordion` | accordion | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `AccordionItem` | accordion | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `AccordionTrigger` | accordion | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `AccordionContent` | accordion | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `Badge` | badge | A | No demonstrated path | normal function | unchanged: Outbound Slot/asChild use is demonstrated; no inbound parent-ref path established. Outbound delegation alone is not a defect. |
| `badgeVariants` | badge | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `Button` | button | A | Yes | normal function | repair: Dialog/Dropdown/Tooltip asChild → Button; original browser RED and pinned examples. |
| `buttonVariants` | button | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `Card` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardAction` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardContent` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardDescription` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardFooter` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardHeader` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `CardTitle` | card | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `Checkbox` | checkbox | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `Dialog` | dialog | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `DialogClose` | dialog | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DialogContent` | dialog | D | Not established / already supported | forwardRef → Radix host | unchanged: Already forwards; retain established behavior. |
| `DialogDescription` | dialog | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DialogFooter` | dialog | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `DialogHeader` | dialog | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `DialogOverlay` | dialog | D | Not established / already supported | forwardRef → Radix host | unchanged: Already forwards; retain established behavior. |
| `DialogPortal` | dialog | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `DialogTitle` | dialog | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DialogTrigger` | dialog | B | Yes | normal function | repair: TooltipTrigger asChild → DialogTrigger asChild → Button; Radix documented nested-trigger path. |
| `DropdownMenu` | dropdown-menu | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `DropdownMenuCheckboxItem` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuContent` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuGroup` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuItem` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuLabel` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuPortal` | dropdown-menu | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `DropdownMenuRadioGroup` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuRadioItem` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuSeparator` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuShortcut` | dropdown-menu | A | No demonstrated path | normal function | unchanged: Native span host; no demonstrated inbound ref-sensitive composition. |
| `DropdownMenuSub` | dropdown-menu | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `DropdownMenuSubContent` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuSubTrigger` | dropdown-menu | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `DropdownMenuTrigger` | dropdown-menu | B | Yes | normal function | repair: shared tooltip/dropdown trigger; primary discussion #560; focused RED/GREEN. |
| `Input` | input | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `Label` | label | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `ScrollArea` | scroll-area | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `ScrollBar` | scroll-area | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `Select` | select | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `SelectContent` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectGroup` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectItem` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectLabel` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectScrollDownButton` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectScrollUpButton` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectSeparator` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectTrigger` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SelectValue` | select | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `Separator` | separator | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `Sheet` | sheet | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `SheetClose` | sheet | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SheetContent` | sheet | D | Not established / already supported | forwardRef → Radix host | unchanged: Already forwards; retain established behavior. |
| `SheetDescription` | sheet | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SheetFooter` | sheet | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SheetHeader` | sheet | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SheetTitle` | sheet | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `SheetTrigger` | sheet | B | Yes | normal function | repair: exact Dialog primitive equivalent in tooltip/sheet chain; focused RED/GREEN. |
| `SidebarProvider` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `Sidebar` | sidebar | A desktop / B mobile | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarTrigger` | sidebar | A via Button | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarRail` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarInset` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarInput` | sidebar | A via Input | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarHeader` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarFooter` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarSeparator` | sidebar | B via Separator | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarContent` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarGroup` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarGroupLabel` | sidebar | A | No demonstrated path | normal function | unchanged: Outbound Slot/asChild use is demonstrated; no inbound parent-ref path established. Outbound delegation alone is not a defect. |
| `SidebarGroupAction` | sidebar | A | No demonstrated path | normal function | unchanged: Outbound Slot/asChild use is demonstrated; no inbound parent-ref path established. Outbound delegation alone is not a defect. |
| `SidebarGroupContent` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenu` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuItem` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuButton` | sidebar | A | Yes | normal function; internal tooltip refs its host directly | repair: DropdownMenuTrigger asChild → SidebarMenuButton; pinned sidebar-07 nav-user/team-switcher. |
| `SidebarMenuAction` | sidebar | A | Yes | normal function | repair: DropdownMenuTrigger asChild → SidebarMenuAction; pinned sidebar-07 nav-projects. |
| `SidebarMenuBadge` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuSkeleton` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuSub` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuSubItem` | sidebar | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `SidebarMenuSubButton` | sidebar | A | No demonstrated path | normal function | unchanged: Outbound Slot/asChild use is demonstrated; no inbound parent-ref path established. Outbound delegation alone is not a defect. |
| `useSidebar` | sidebar | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `Skeleton` | skeleton | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `Table` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableBody` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableCaption` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableCell` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableFooter` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableHead` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableHeader` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TableRow` | table | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `Tabs` | tabs | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `TabsList` | tabs | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `TabsTrigger` | tabs | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `TabsContent` | tabs | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
| `tabsListVariants` | tabs | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `Textarea` | textarea | A | No demonstrated path | normal function | unchanged: Native/styled host (possibly via local wrapper); no demonstrated inbound ref-sensitive composition. |
| `TooltipProvider` | tooltip | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `Tooltip` | tooltip | C | No demonstrated path | N/A | unchanged: Helper/hook/provider/portal without an independently referenceable DOM host. |
| `TooltipTrigger` | tooltip | B | Yes | normal function | repair: reverse shared overlay trigger chain; Radix primary discussion #560; focused RED/GREEN. |
| `TooltipContent` | tooltip | B | No demonstrated path | normal function | unchanged: Primitive owns its internal DOM ref; audited usage does not require an outer parent to ref this wrapper. |
