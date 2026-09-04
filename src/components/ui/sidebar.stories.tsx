import type { Meta, StoryObj } from "@storybook/react-vite"
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

export const Outline: Story = {
  render: Desktop.render,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Reports" })
    const style = getComputedStyle(button)

    console.info("Sidebar outline", JSON.stringify({ boxShadow: style.boxShadow, borderColor: style.borderColor }))
    await expect(style.boxShadow).toContain(`${style.borderColor} 0px 0px 0px 1px`)
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
    reference.style.boxShadow = "0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)"
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
