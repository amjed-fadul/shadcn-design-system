// @vitest-environment jsdom

import * as React from "react"
import { act } from "react"
import { describe, expect, test } from "vitest"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarProvider,
} from "../src/components/ui/sidebar"
import { TooltipProvider } from "../src/components/ui/tooltip"
import { render } from "./studio-test-utils"

// Navigation is authored through the existing asChild composition: the anchor
// is the menu button. These tests pin that contract; real-browser behaviour
// (Enter, modified click, new tab) lives in sidebar-navigation.browser.mjs.

function Shell({ children, ...props }: React.ComponentProps<typeof Sidebar> & { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={props.collapsible !== "icon"}>
      <Sidebar collapsible="none" {...props}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{children}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}

const menuButtons = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-slot="sidebar-menu-button"]'))

describe("SidebarMenuButton navigation composition", () => {
  test("asChild with an anchor renders one native link that keeps href and its content as the name", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="/follow-ups">Follow-ups</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )

    const [link, ...rest] = menuButtons(container)
    expect(rest).toEqual([])
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/follow-ups")
    expect(link.textContent?.trim()).toBe("Follow-ups")
    expect(link.getAttribute("role")).toBeNull()
    expect(link.getAttribute("type")).toBeNull()
    expect(link.parentElement?.tagName).toBe("LI")
  })

  test("the anchor is the menu button itself: no nested button or link", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="/clients">Clients</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )

    expect(container.querySelectorAll("button")).toHaveLength(0)
    expect(container.querySelectorAll("a a, a button, button a, button button")).toHaveLength(0)
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(container.querySelectorAll("a[href]")).toHaveLength(1)
  })

  test("carries the menu button styling and data hooks onto the anchor", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" variant="outline">
            <a href="/settings">Settings</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const link = menuButtons(container)[0]
    expect(link.getAttribute("data-sidebar")).toBe("menu-button")
    expect(link.getAttribute("data-size")).toBe("sm")
    expect(link.className).toContain("group/menu-button")
    expect(link.className).toContain("border-sidebar-border")
  })

  test("isActive is presentational: it sets data-active and never invents aria-current", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive>
            <a href="/follow-ups">Follow-ups</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="/clients">Clients</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const [active, inactive] = menuButtons(container)
    expect(active.getAttribute("data-active")).toBe("true")
    expect(inactive.getAttribute("data-active")).toBe("false")
    expect(active.hasAttribute("aria-current")).toBe(false)
    expect(inactive.hasAttribute("aria-current")).toBe(false)
  })

  test("the authored anchor owns aria-current and it survives composition", () => {
    const container = render(
      <Shell>
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
      </Shell>
    )
    const [current, other] = menuButtons(container)
    expect(current.getAttribute("aria-current")).toBe("page")
    expect(other.hasAttribute("aria-current")).toBe(false)
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  test("a non-navigation SidebarMenuButton stays a native button and never gets link or current-page semantics", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton isActive>Open command menu</SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const button = menuButtons(container)[0]
    expect(button.tagName).toBe("BUTTON")
    expect(button.hasAttribute("href")).toBe(false)
    expect(button.hasAttribute("aria-current")).toBe(false)
    expect(button.textContent?.trim()).toBe("Open command menu")
  })

  test("action items keep working: clicking the button runs its handler", () => {
    let runs = 0
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => runs++}>Expand section</SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    act(() => menuButtons(container)[0].click())
    expect(runs).toBe(1)
  })

  test("asChild does not regress for a non-anchor child and still forwards refs", () => {
    const anchorRef = React.createRef<HTMLAnchorElement>()
    const buttonRef = React.createRef<HTMLButtonElement>()
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild ref={anchorRef as unknown as React.Ref<HTMLButtonElement>}>
            <a href="/clients">Clients</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild ref={buttonRef}>
            <button type="button">Account</button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const [link, button] = menuButtons(container)
    expect(anchorRef.current).toBe(link)
    expect(buttonRef.current).toBe(button)
    expect(button.tagName).toBe("BUTTON")
    expect(button.getAttribute("type")).toBe("button")
  })

  test("composes with a router-style link component and leaves navigation to it", () => {
    const seen: string[] = []
    const RouterLink = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<"a"> & { to: string }>(({ to, onClick, ...props }, ref) => (
      <a
        ref={ref}
        href={to}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            seen.push(to)
          }
        }}
        {...props}
      />
    ))
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive>
            <RouterLink to="/follow-ups" aria-current="page">Follow-ups</RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const link = menuButtons(container)[0]
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/follow-ups")
    expect(link.getAttribute("data-slot")).toBe("sidebar-menu-button")
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })))
    expect(seen).toEqual(["/follow-ups"])
  })

  test("the design system does not intercept activation: a plain anchor click is left to the browser", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a href="#follow-ups">Follow-ups</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const link = menuButtons(container)[0]
    let defaultPrevented: boolean | undefined
    const observe = (event: Event) => { defaultPrevented = event.defaultPrevented }
    document.addEventListener("click", observe)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    act(() => { link.dispatchEvent(click) })
    document.removeEventListener("click", observe)
    expect(defaultPrevented).toBe(false)
  })

  test("collapsed icon presentation keeps the link, its href, name and focusability; tooltip adds no wrapper", () => {
    const container = render(
      <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive tooltip="Follow-ups">
                      <a href="/follow-ups" aria-current="page">
                        <span aria-hidden>★</span>
                        <span>Follow-ups</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
      </TooltipProvider>
    )
    const sidebar = container.querySelector('[data-slot="sidebar"]')!
    expect(sidebar.getAttribute("data-state")).toBe("collapsed")
    expect(sidebar.getAttribute("data-collapsible")).toBe("icon")
    const link = menuButtons(container)[0]
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/follow-ups")
    expect(link.getAttribute("aria-current")).toBe("page")
    expect(link.getAttribute("data-state")).not.toBeNull()
    expect(link.tabIndex).toBe(0)
    expect(link.hidden).toBe(false)
    expect(link.closest("[aria-hidden='true']")).toBeNull()
    expect(link.parentElement?.tagName).toBe("LI")
    expect(link.querySelector("[aria-hidden]")?.textContent).toBe("★")
    expect(link.textContent).toContain("Follow-ups")
  })

  test("disabled guidance: a disabled action button is natively disabled, an aria-disabled anchor is styled inert but stays a link", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuButton disabled>Export</SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a aria-disabled="true">Archive</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </Shell>
    )
    const [button, anchor] = menuButtons(container)
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(anchor.tagName).toBe("A")
    expect(anchor.getAttribute("aria-disabled")).toBe("true")
    expect(anchor.hasAttribute("href")).toBe(false)
    expect(anchor.className).toContain("aria-disabled:pointer-events-none")
  })

  test("SidebarMenuSubButton remains an anchor by default and does not own aria-current either", () => {
    const container = render(
      <Shell>
        <SidebarMenuItem>
          <SidebarMenuSubButton href="/reports/history" isActive aria-current="page">History</SidebarMenuSubButton>
        </SidebarMenuItem>
      </Shell>
    )
    const link = container.querySelector<HTMLElement>('[data-slot="sidebar-menu-sub-button"]')!
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("aria-current")).toBe("page")
    expect(link.getAttribute("data-active")).toBe("true")
  })
})
