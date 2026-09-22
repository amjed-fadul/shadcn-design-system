// @vitest-environment jsdom

import { act, useState } from "react"
import { describe, expect, test } from "vitest"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "../src/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu"
import { render } from "./studio-test-utils"

describe("Studio V1 Sidebar component foundation", () => {
  test("preserves Dropdown Menu inset item props and Sidebar composition exports", () => {
    const container = render(
      <>
        <DropdownMenu open>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked inset>
              Checked
            </DropdownMenuCheckboxItem>
            <DropdownMenuRadioGroup value="one">
              <DropdownMenuRadioItem value="one" inset>
                One
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupAction aria-label="Group action" />
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton variant="outline" size="sm">
                      Overview
                    </SidebarMenuButton>
                    <SidebarMenuBadge>1</SidebarMenuBadge>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </SidebarMenu>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="/settings" size="sm" isActive>
                      Settings
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarGroupContent>
            </SidebarGroup>
          </Sidebar>
        </SidebarProvider>
      </>
    )

    expect(document.body.querySelector('[data-inset="true"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sidebar-group-action"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sidebar-menu-badge"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sidebar-menu-skeleton"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sidebar-menu-sub-button"]')).not.toBeNull()
  })

  test("preserves Sidebar trigger callbacks without core shortcut or persistence side effects", () => {
    let triggerClicks = 0
    const container = render(
      <SidebarProvider>
        <Sidebar>
          <SidebarTrigger onClick={() => triggerClicks++} />
        </Sidebar>
      </SidebarProvider>
    )

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")

    act(() => (container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement).click())
    expect(triggerClicks).toBe(1)
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true })))
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
    expect(document.cookie).not.toContain("sidebar_state=false")
  })

  test("preserves controlled SidebarProvider open state and onOpenChange values", () => {
    const observed: boolean[] = []
    const ControlledSidebar = () => {
      const [open, setOpen] = useState(true)

      return (
        <SidebarProvider
          open={open}
          onOpenChange={(nextOpen) => {
            observed.push(nextOpen)
            setOpen(nextOpen)
          }}
        >
          <Sidebar>
            <SidebarTrigger />
          </Sidebar>
        </SidebarProvider>
      )
    }

    const container = render(<ControlledSidebar />)
    const sidebar = container.querySelector('[data-slot="sidebar"]')
    const trigger = container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement

    expect(sidebar?.getAttribute("data-state")).toBe("expanded")

    act(() => trigger.click())
    expect(observed).toEqual([false])
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")

    act(() => trigger.click())
    expect(observed).toEqual([false, true])
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")
  })

  test("preserves Sidebar mobile Sheet behavior from its explicit input", () => {
    const container = render(
      <SidebarProvider isMobile>
        <Sidebar>
          <SidebarContent>Mobile navigation</SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )

    act(() => (container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-slot="sidebar"][data-mobile="true"]')?.textContent).toContain("Mobile navigation")

  })
})
