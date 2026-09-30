# Sidebar navigation items

A sidebar item that goes to another page or view is a **navigation item** and must be a native link. A sidebar item that does something else, such as expanding a section, opening an account menu, or running a command, is an **action item** and stays a button. `SidebarMenuButton` supports both through the composition it already has; there is no navigation prop to learn.

```tsx
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@adc/shadcn-design-system"

<SidebarMenu>
  <SidebarMenuItem>
    {/* Navigation item, current page: the anchor is the menu button. */}
    <SidebarMenuButton asChild isActive>
      <a href="/follow-ups" aria-current="page">Follow-ups</a>
    </SidebarMenuButton>
  </SidebarMenuItem>
  <SidebarMenuItem>
    {/* Navigation item. */}
    <SidebarMenuButton asChild>
      <a href="/clients">Clients</a>
    </SidebarMenuButton>
  </SidebarMenuItem>
  <SidebarMenuItem>
    {/* Action item: no asChild, so it renders a native button. */}
    <SidebarMenuButton onClick={openCommandMenu}>Open command menu</SidebarMenuButton>
  </SidebarMenuItem>
</SidebarMenu>
```

## Rules

- **The anchor is the menu button.** `asChild` makes the `<a>` carry the menu button styling and `data-*` hooks. Do not nest a `Button` or another link inside it. Its `href` is the destination and its text content is the accessible name.
- **Browser behavior stays native.** Enter activation, modified click, middle click, the context menu, and open in new tab all work because the element is a real `<a href>`. Do not emulate navigation with a button `onClick`.
- **Current page.** `isActive` only sets `data-active` (the default variant styles it; the outline variant has no active style) and never adds `aria-current`. Put `aria-current="page"` on the anchor for the one page being shown, and never on an action button. `SidebarMenuSubButton` follows the same rule.
- **Routing is yours.** `SidebarMenuButton` does not own application routing and does no client-side navigation. A plain `href` navigates natively. To use a router, pass its link component as the `asChild` child; it must render an anchor and forward its props and ref. If that component sets `aria-current` itself (for example a `NavLink`), let it, and do not author both.
- **Disabled.** `disabled` applies to button items only. On an anchor, `aria-disabled` only adds inert, dimmed styling (`pointer-events-none` and reduced opacity); it does not stop keyboard activation of an anchor that has an `href`. The design system adds no disabled-link behavior and intercepts no link activation, so leave an unavailable destination out or render a non-navigating placeholder instead of an anchor with `href`.
- **Refs.** `SidebarMenuButton` types its ref as `HTMLButtonElement`, so a typed ref to an `asChild` anchor needs a cast; the ref itself is forwarded to the anchor.
- **Collapsed.** In the icon-collapsed presentation the anchor keeps its role, `href`, `aria-current`, focus, and accessible name, so keep the label text inside the anchor. The `tooltip` prop is unchanged and needs a `TooltipProvider` ancestor.

## Verified by

`tests/sidebar-navigation.test.tsx` (composition and semantics), `tests/sidebar-navigation.browser.mjs` (`npm run test:sidebar-navigation`: real Enter, modified click, middle click, collapsed and RTL), the Sidebar Storybook stories `NavigationItem`, `CurrentPage`, `ActionItem`, `NavigationCollapsed`, and `NavigationRtl`, and `tests/sidebar-navigation-contract.test.ts` (contract and knowledge).
