import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ComponentType } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    providesDocumentLandmarks: true,
  },
} satisfies Meta<typeof Sidebar>

export default meta

type Story = StoryObj<typeof meta>
type ExplicitStoryArgs = {
  isMobile: boolean
  open: boolean
  openMobile: boolean
  side: "left" | "right"
  variant: "sidebar" | "floating" | "inset"
  collapsible: "offcanvas" | "icon" | "none"
}
type ExplicitStory = StoryObj<ExplicitStoryArgs>

const finiteHost = (Story: ComponentType) => (
  <div style={{ position: "relative", width: 960, height: 640, overflow: "hidden", transform: "translateZ(0)" }}>
    <Story />
  </div>
)

export const Desktop: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar role="navigation" aria-label="Workspace navigation">
        <SidebarHeader>
          <div className="px-2 text-sm font-semibold">Acme workspace</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add workspace" className="absolute right-3 top-4 size-5">
              <span aria-hidden>+</span>
            </SidebarGroupAction>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Overview</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Settings</SidebarMenuButton>
                <SidebarMenuAction aria-label="Settings actions" showOnHover>
                  <span aria-hidden>…</span>
                </SidebarMenuAction>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton variant="outline">Reports</SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#report-history">Report history</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-semibold">Overview</h1>
        </header>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            Review workspace activity and settings from the navigation.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]')
    const trigger = canvas.getByRole("button", { name: "Toggle Sidebar" })

    await expect(sidebar).toHaveAttribute("data-state", "expanded")
    await userEvent.click(trigger)
    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    await userEvent.click(trigger)
    await expect(sidebar).toHaveAttribute("data-state", "expanded")
  },
}

export const ExplicitInputs: ExplicitStory = {
  args: {
    isMobile: false,
    open: true,
    openMobile: false,
    side: "left",
    variant: "sidebar",
    collapsible: "offcanvas",
  },
  argTypes: {
    isMobile: { control: "boolean" },
    open: { control: "boolean" },
    openMobile: { control: "boolean" },
    side: { control: "inline-radio", options: ["left", "right"] },
    variant: { control: "inline-radio", options: ["sidebar", "floating", "inset"] },
    collapsible: { control: "inline-radio", options: ["offcanvas", "icon", "none"] },
  },
  decorators: [finiteHost],
  render: ({ isMobile, open, openMobile, side, variant, collapsible }) => (
    <SidebarProvider isMobile={isMobile} open={open} onOpenChange={() => {}} openMobile={openMobile} onOpenMobileChange={() => {}}>
      <Sidebar role="navigation" aria-label="Controlled navigation" side={side} variant={variant} collapsible={collapsible}>
        <SidebarContent>Explicit desktop presentation</SidebarContent>
      </Sidebar>
      <SidebarInset><SidebarTrigger /></SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
    try {
      const sidebar = canvasElement.querySelector('[data-slot="sidebar"]')
      await expect(sidebar).not.toHaveAttribute("data-mobile")
      await expect(sidebar).toHaveAttribute("data-state", "expanded")
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  },
}

export const Outline: Story = {
  render: Desktop.render,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Reports" })
    const style = getComputedStyle(button)

    console.info("Sidebar outline", JSON.stringify({ boxShadow: style.boxShadow, borderColor: style.borderColor }))
    await expect(style.boxShadow).toBe("none")
    await expect(style.borderWidth).toBe("1px")
  },
}

export const KeyboardFocus: Story = {
  render: Desktop.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const controls = [
      canvas.getByRole("button", { name: "Add workspace" }),
      canvas.getByRole("button", { name: "Overview" }),
      canvas.getByRole("button", { name: "Settings" }),
      canvas.getByRole("button", { name: "Settings actions" }),
      canvas.getByRole("button", { name: "Reports" }),
      canvas.getByRole("link", { name: "Report history" }),
    ]
    // Resolve the semantic color independently of the component's Tailwind recipe.
    const reference = document.createElement("span")
    reference.hidden = true
    reference.style.boxShadow = "0 0 0 4px var(--ring)"
    reference.style.borderColor = "var(--ring)"
    canvasElement.append(reference)
    const ring = getComputedStyle(reference).boxShadow
    const border = getComputedStyle(reference).borderColor
    reference.remove()
    await expect(ring).not.toBe("none")

    // Clicking noninteractive content establishes a repeatable starting point
    // without calling focus() on any control under test.
    await userEvent.click(canvas.getByText("Acme workspace"))
    const observations = []
    for (const control of controls) {
      const before = getComputedStyle(control).boxShadow
      await userEvent.tab()
      await expect(control).toHaveFocus()
      // Menu buttons transition their border color; sample the settled state.
      await waitFor(() => expect(getComputedStyle(control).borderColor).toBe(border))
      const style = getComputedStyle(control)
      observations.push({
        name: control.getAttribute("aria-label") ?? control.textContent,
        before,
        boxShadow: style.boxShadow,
        borderColor: style.borderColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        focusVisible: control.matches(":focus-visible"),
        opacity: style.opacity,
      })
    }
    console.info("Sidebar keyboard focus", JSON.stringify(observations))
    for (const observation of observations) {
      await expect(observation, observation.name ?? "Sidebar control").toMatchObject({
        boxShadow: expect.stringContaining(ring),
        borderColor: border,
        focusVisible: true,
        opacity: "1",
      })
      await expect(observation.boxShadow).not.toBe(observation.before)
    }
  },
}

// Navigation items are real anchors composed with SidebarMenuButton asChild.
// The design system owns no routing, so these stories only prove native
// semantics; play functions observe activation without leaving Storybook.
function NavigationSidebar({ collapsible = "none", open = true, dir, children }: { collapsible?: "none" | "icon"; open?: boolean; dir?: "ltr" | "rtl"; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div dir={dir} style={{ position: "relative", width: 320, height: 240, overflow: "hidden", transform: "translateZ(0)" }}>
        <SidebarProvider defaultOpen={open}>
          <Sidebar collapsible={collapsible} dir={dir} role="navigation" aria-label="Application navigation">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                <SidebarMenu>{children}</SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </div>
    </TooltipProvider>
  )
}

// Records whether the browser would still perform its default navigation, then
// cancels it so the play function never navigates the Storybook iframe away.
async function activateWithoutLeaving(activate: () => Promise<unknown>) {
  let nativeDefaultIntact: boolean | undefined
  const observe = (event: Event) => {
    nativeDefaultIntact = !event.defaultPrevented
    event.preventDefault()
  }
  document.addEventListener("click", observe)
  try {
    await activate()
  } finally {
    document.removeEventListener("click", observe)
  }
  return nativeDefaultIntact
}

export const NavigationItem: Story = {
  parameters: { docs: { description: { story: "A navigation item is a native anchor. Compose it with `SidebarMenuButton asChild` and author the `href` on the anchor; the design system does not own routing." } } },
  render: () => (
    <NavigationSidebar>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <a href="/clients">Clients</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </NavigationSidebar>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole("link", { name: "Clients" })

    await expect(link.tagName).toBe("A")
    await expect(link).toHaveAttribute("href", "/clients")
    await expect(link).toHaveAttribute("data-slot", "sidebar-menu-button")
    await expect(link).not.toHaveAttribute("aria-current")
    await expect(canvasElement.querySelectorAll("a button, button a")).toHaveLength(0)
    await expect(canvas.queryByRole("button", { name: "Clients" })).toBeNull()

    // Keyboard: Enter on a focused link is the native activation path.
    link.focus()
    const intact = await activateWithoutLeaving(() => userEvent.keyboard("{Enter}"))
    await expect(intact).toBe(true)
  },
}

export const CurrentPage: Story = {
  parameters: { docs: { description: { story: "`isActive` is visual (`data-active`). The authored anchor owns `aria-current=\"page\"`, and only the current-page link carries it." } } },
  render: () => (
    <NavigationSidebar>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive>
          <a href="/follow-ups" aria-current="page">Follow-ups</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <a href="/clients">Clients</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <a href="/settings">Settings</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </NavigationSidebar>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const current = canvas.getByRole("link", { name: "Follow-ups" })

    await expect(current).toHaveAttribute("aria-current", "page")
    await expect(current).toHaveAttribute("data-active", "true")
    await expect(canvas.getByRole("link", { name: "Clients" })).not.toHaveAttribute("aria-current")
    await expect(canvas.getByRole("link", { name: "Settings" })).toHaveAttribute("data-active", "false")
    await expect(canvasElement.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    await expect(canvas.getAllByRole("link")).toHaveLength(3)
  },
}

export const ActionItem: Story = {
  parameters: { docs: { description: { story: "A non-navigation item stays a Button and never receives link or current-page semantics. Use it for actions such as opening a menu or running a command." } } },
  render: () => (
    <NavigationSidebar>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive>
          <a href="/follow-ups" aria-current="page">Follow-ups</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton type="button" aria-haspopup="menu">Open command menu</SidebarMenuButton>
      </SidebarMenuItem>
    </NavigationSidebar>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const action = canvas.getByRole("button", { name: "Open command menu" })

    await expect(action.tagName).toBe("BUTTON")
    await expect(action).not.toHaveAttribute("href")
    await expect(action).not.toHaveAttribute("aria-current")
    await expect(canvas.queryByRole("link", { name: "Open command menu" })).toBeNull()
    await expect(canvas.getByRole("link", { name: "Follow-ups" })).toHaveAttribute("aria-current", "page")
  },
}

export const NavigationCollapsed: Story = {
  parameters: { docs: { description: { story: "In the existing icon presentation the anchors keep their link role, `href`, accessible name, and keyboard focus. The `tooltip` prop is unchanged." } } },
  render: () => (
    <NavigationSidebar collapsible="icon" open={false}>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive tooltip="Follow-ups">
          <a href="/follow-ups" aria-current="page"><span aria-hidden>★</span><span>Follow-ups</span></a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Clients">
          <a href="/clients"><span aria-hidden>●</span><span>Clients</span></a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </NavigationSidebar>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]')

    await expect(sidebar).toHaveAttribute("data-state", "collapsed")
    const link = canvas.getByRole("link", { name: /Clients/ })
    await expect(link).toHaveAttribute("href", "/clients")
    await expect(canvas.getByRole("link", { name: /Follow-ups/ })).toHaveAttribute("aria-current", "page")
    link.focus()
    await expect(link).toHaveFocus()
    // Focus opens the collapsed-item tooltip in a portal outside any landmark;
    // dismiss it so the accessibility gate audits only the sidebar.
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull())
  },
}

export const NavigationRtl: Story = {
  parameters: { docs: { description: { story: "Navigation semantics are identical in RTL: native links, `href`, and `aria-current` do not change with direction." } } },
  render: () => (
    <NavigationSidebar dir="rtl">
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive>
          <a href="/follow-ups" aria-current="page">Follow-ups</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <a href="/clients">Clients</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </NavigationSidebar>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(getComputedStyle(canvasElement.querySelector("[dir='rtl']")!).direction).toBe("rtl")
    await expect(canvas.getByRole("link", { name: "Follow-ups" })).toHaveAttribute("aria-current", "page")
    await expect(canvas.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "/clients")
    await expect(canvas.getAllByRole("link")).toHaveLength(2)
  },
}

// Variant styling (DS6). The inner panel carries the sidebar surface; a floating panel is a bordered,
// shadowed card; beside an inset sidebar the main area is a rounded, shadowed card, flush with the
// sidebar's padding while it is expanded. collapsible="none" renders its variant too.
const variantLayout = (variant: "sidebar" | "floating" | "inset", collapsible: "offcanvas" | "none") => (
  <SidebarProvider defaultOpen>
    <Sidebar role="navigation" aria-label="Workspace navigation" variant={variant} collapsible={collapsible}>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton isActive>Overview</SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        {collapsible === "none" ? null : <SidebarTrigger />}
        <h1 className="text-sm font-semibold">Overview</h1>
      </header>
    </SidebarInset>
  </SidebarProvider>
)
const transparent = "rgba(0, 0, 0, 0)"
const box = (element: Element) => getComputedStyle(element)

export const InsetVariant: Story = {
  decorators: [finiteHost],
  render: () => variantLayout("inset", "none"),
  play: async ({ canvasElement }) => {
    const inner = box(canvasElement.querySelector('[data-slot="sidebar-inner"]')!)
    const inset = box(canvasElement.querySelector('[data-slot="sidebar-inset"]')!)
    await expect(box(canvasElement.querySelector('[data-slot="sidebar"]')!).paddingTop).toBe("8px")
    await expect(inner.backgroundColor).not.toBe(transparent)
    await expect([inset.marginTop, inset.marginRight, inset.marginBottom, inset.marginLeft]).toEqual(["8px", "8px", "8px", "0px"])
    await expect(parseFloat(inset.borderTopLeftRadius)).toBeGreaterThan(0)
    await expect(inset.boxShadow).not.toBe("none")
  },
}

export const FloatingVariant: Story = {
  decorators: [finiteHost],
  render: () => variantLayout("floating", "none"),
  play: async ({ canvasElement }) => {
    const inner = box(canvasElement.querySelector('[data-slot="sidebar-inner"]')!)
    const inset = box(canvasElement.querySelector('[data-slot="sidebar-inset"]')!)
    await expect(inner.backgroundColor).not.toBe(transparent)
    await expect(inner.borderTopWidth).toBe("1px")
    await expect(parseFloat(inner.borderTopLeftRadius)).toBeGreaterThan(0)
    await expect(inner.boxShadow).not.toBe("none")
    await expect(inset.marginLeft).toBe("0px")
    await expect(inset.boxShadow).toBe("none")
  },
}

export const DefaultVariantSurface: Story = {
  decorators: [finiteHost],
  render: () => variantLayout("sidebar", "none"),
  play: async ({ canvasElement }) => {
    const inner = box(canvasElement.querySelector('[data-slot="sidebar-inner"]')!)
    const inset = box(canvasElement.querySelector('[data-slot="sidebar-inset"]')!)
    await expect(inner.backgroundColor).not.toBe(transparent)
    await expect(inner.borderTopWidth).toBe("0px")
    await expect(inset.marginTop).toBe("0px")
    await expect(inset.boxShadow).toBe("none")
  },
}

export const InsetCollapsible: Story = {
  decorators: [finiteHost],
  render: () => variantLayout("inset", "offcanvas"),
  play: async ({ canvasElement }) => {
    const inset = canvasElement.querySelector('[data-slot="sidebar-inset"]')!
    await expect(box(inset).marginLeft).toBe("0px")
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Toggle Sidebar" }))
    await waitFor(() => expect(box(inset).marginLeft).toBe("8px"))
  },
}
