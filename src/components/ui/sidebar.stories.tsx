import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Sidebar>

export default meta

type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 text-sm font-semibold">Acme workspace</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Overview</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Settings</SidebarMenuButton>
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
        <main className="p-6">
          <p className="text-sm text-muted-foreground">
            Review workspace activity and settings from the navigation.
          </p>
        </main>
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
