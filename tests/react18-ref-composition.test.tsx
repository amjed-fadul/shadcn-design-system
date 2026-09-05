// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Button } from "../src/components/ui/button"
import { Tooltip, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip"
import { DropdownMenu, DropdownMenuTrigger } from "../src/components/ui/dropdown-menu"
import { Sheet, SheetTrigger } from "../src/components/ui/sheet"
import { Slot } from "radix-ui"
import { Dialog, DialogTrigger } from "../src/components/ui/dialog"
import { SidebarProvider, SidebarMenuButton, SidebarMenuAction } from "../src/components/ui/sidebar"
import { render } from "./studio-test-utils"

beforeEach(() => { vi.spyOn(console, "error") })
afterEach(() => {
  try { expect(console.error).not.toHaveBeenCalled() } finally { vi.restoreAllMocks() }
})

describe("React 18 public ref composition", () => {
  test("Button forwards a real DOM ref without React warnings", () => {
    const ref = React.createRef<HTMLButtonElement>()

      const container = render(<Button ref={ref} variant="outline" size="sm">Open</Button>)
      expect(ref.current).toBe(container.querySelector("button"))
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)

  })
  test("Button asChild forwards its ref to the replacement element and preserves events", () => {
    const ref = React.createRef<HTMLButtonElement>()
    const click = vi.fn()
    const container = render(<Button asChild ref={ref} onClick={click}><button type="button">Child</button></Button>)
    expect(ref.current).toBe(container.querySelector("button"))
    ref.current!.click()
    expect(click).toHaveBeenCalledTimes(1)
  })
})

test("DialogTrigger passes an outer Slot ref through its own asChild to the button", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<Dialog><Slot.Root ref={ref}><DialogTrigger asChild><Button>Nested trigger</Button></DialogTrigger></Slot.Root></Dialog>)
  expect(ref.current).toBe(container.querySelector("button"))
})

test("SidebarMenuButton passes a dropdown-style Slot ref to its host", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<SidebarProvider><Slot.Root ref={ref}><SidebarMenuButton>Workspace</SidebarMenuButton></Slot.Root></SidebarProvider>)
  expect(ref.current).toBe(container.querySelector('[data-slot="sidebar-menu-button"]'))
})

test("SidebarMenuAction passes a dropdown-style Slot ref to its host", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<Slot.Root ref={ref}><SidebarMenuAction showOnHover>Project actions</SidebarMenuAction></Slot.Root>)
  expect(ref.current).toBe(container.querySelector('[data-slot="sidebar-menu-action"]'))
})

for (const Component of [SidebarMenuButton, SidebarMenuAction]) {
  test(`${Component.displayName} preserves asChild refs and events`, () => {
    const ref = React.createRef<HTMLButtonElement>()
    const click = vi.fn()
    const container = render(<SidebarProvider><Component asChild ref={ref} onClick={click}><button>Child action</button></Component></SidebarProvider>)
    expect(ref.current).toBe(container.querySelector("button"))
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    ref.current!.click()
    expect(click).toHaveBeenCalledTimes(1)
  })
}

test("TooltipTrigger forwards the Dialog trigger ref through the reverse shared-button chain", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<TooltipProvider><Tooltip><Dialog><DialogTrigger asChild ref={ref}><TooltipTrigger asChild><Button>Shared trigger</Button></TooltipTrigger></DialogTrigger></Dialog></Tooltip></TooltipProvider>)
  expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  expect(ref.current).toBe(container.querySelector("button"))
})

test("DropdownMenuTrigger passes the outer Tooltip/Slot ref through its asChild button", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<TooltipProvider><Tooltip><DropdownMenu><TooltipTrigger asChild ref={ref}><DropdownMenuTrigger asChild><Button>Shared dropdown</Button></DropdownMenuTrigger></TooltipTrigger></DropdownMenu></Tooltip></TooltipProvider>)
  expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  expect(ref.current).toBe(container.querySelector("button"))
})

test("SheetTrigger passes the outer Tooltip ref through its asChild button", () => {
  const ref = React.createRef<HTMLButtonElement>()
  const container = render(<TooltipProvider><Tooltip><Sheet><TooltipTrigger asChild ref={ref}><SheetTrigger asChild><Button>Shared sheet</Button></SheetTrigger></TooltipTrigger></Sheet></Tooltip></TooltipProvider>)
  expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  expect(ref.current).toBe(container.querySelector("button"))
})
