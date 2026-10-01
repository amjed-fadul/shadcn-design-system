// @vitest-environment jsdom

import { act, useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

const useIsMobileSpy = vi.hoisted(() => vi.fn(() => false))
const originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, "cookie")

vi.mock("../src/hooks/use-mobile", () => ({ useIsMobile: useIsMobileSpy }))

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../src/components/ui/sidebar"
import { render } from "./studio-test-utils"
import { TooltipProvider } from "../src/components/ui/tooltip"

function click(element: Element) {
  act(() => (element as HTMLButtonElement).click())
}

function sidebarSignature(root: ParentNode) {
  return Array.from(root.querySelectorAll("[data-slot]"), (element) => [
    element.getAttribute("data-slot"),
    element.getAttribute("data-state"),
    element.getAttribute("data-mobile"),
    element.getAttribute("aria-hidden"),
  ])
}

describe("Sidebar deterministic core", () => {
  test("coordinates desktop panel, gap, and Canvas spacer width motion", () => {
    const container = render(
      <SidebarProvider isMobile={false}>
        <Sidebar collapsible="icon"><SidebarContent>Navigation</SidebarContent></Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )
    const slots = ["sidebar-flow-spacer", "sidebar-gap", "sidebar-container"]

    for (const slot of slots) {
      const classes = container.querySelector(`[data-slot="${slot}"]`)?.classList
      expect(classes?.contains(slot === "sidebar-container" ? "transition-[left,right,width,transform]" : "transition-[width]")).toBe(true)
      expect(classes?.contains("duration-300")).toBe(true)
      expect(classes?.contains("ease-out")).toBe(true)
    }

    click(container.querySelector('[data-slot="sidebar-trigger"]')!)
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed")
  })

  test("keeps a fixed explicit desktop branch identical across browser widths", () => {
    const originalWidth = window.innerWidth
    const renderAtWidth = (width: number) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
      const host = render(
        <div style={{ height: 900, position: "relative" }}>
          <SidebarProvider isMobile={false} defaultOpen={false}>
            <Sidebar side="right" collapsible="offcanvas" dir="rtl"><SidebarContent>Navigation</SidebarContent></Sidebar>
          </SidebarProvider>
        </div>
      )
      return sidebarSignature(host)
    }

    const narrow = renderAtWidth(500)
    document.body.innerHTML = ""
    const wide = renderAtWidth(1440)
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })

    expect(narrow).toEqual(wide)
    expect(wide).toContainEqual(["sidebar", "collapsed", null, null])
  })

  test("changes only the explicit isMobile input between inline and Sheet branches", () => {
    const portalHost = document.createElement("div")
    document.body.append(portalHost)
    const { container } = (() => {
      const root = render(
        <SidebarProvider isMobile={true} defaultOpenMobile>
          <Sidebar side="left" dir="rtl" portalContainer={portalHost}><SidebarContent>Mobile navigation</SidebarContent></Sidebar>
        </SidebarProvider>
      )
      return { container: root }
    })()

    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull()
    const sheetSidebar = portalHost.querySelector('[data-slot="sidebar"]')
    expect(sheetSidebar).not.toBeNull()
    expect(sheetSidebar?.getAttribute("data-mobile")).toBe("true")
    expect(sheetSidebar?.getAttribute("dir")).toBe("rtl")
  })

  test("keeps desktop and mobile uncontrolled channels independent when presentation changes", () => {
    const callbacks: string[] = []
    function StatefulSidebar() {
      const [isMobile, setIsMobile] = useState(false)
      return <SidebarProvider
        isMobile={isMobile}
        defaultOpen={false}
        defaultOpenMobile={false}
        onOpenChange={(open) => callbacks.push(`desktop:${open}`)}
        onOpenMobileChange={(open) => callbacks.push(`mobile:${open}`)}
      >
        <button onClick={() => setIsMobile((value) => !value)}>Change presentation</button>
        <Sidebar><SidebarContent>Navigation</SidebarContent></Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    }

    const container = render(<StatefulSidebar />)
    const trigger = container.querySelector('[data-slot="sidebar-trigger"]')!
    const presentation = container.querySelector("button:not([data-slot])")!

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed")
    click(trigger)
    click(trigger)
    click(trigger)
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded")
    click(presentation)
    expect(callbacks).toEqual(["desktop:true", "desktop:false", "desktop:true"])
    expect(document.body.querySelector('[data-mobile="true"]')).not.toBeNull()
    click(trigger)
    click(trigger)
    expect(callbacks).toEqual(["desktop:true", "desktop:false", "desktop:true", "mobile:true", "mobile:false"])
    click(presentation)
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded")
  })

  test("uses each controlled channel without mutating its internally held value", () => {
    const desktopChanges: boolean[] = []
    const mobileChanges: boolean[] = []
    const container = render(
      <SidebarProvider isMobile={false} open={true} onOpenChange={(value) => desktopChanges.push(value)} openMobile={true} onOpenMobileChange={(value) => mobileChanges.push(value)}>
        <Sidebar><SidebarContent>Navigation</SidebarContent></Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    )
    const trigger = container.querySelector('[data-slot="sidebar-trigger"]')!

    click(trigger)
    expect(desktopChanges).toEqual([false])
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded")
  })

  test("uses current controlled mobile callback and prop values across repeated transitions", () => {
    const first: boolean[] = []
    const second: boolean[] = []
    function ControlledMobile() {
      const [openMobile, setOpenMobile] = useState(false)
      const [useSecondCallback, setUseSecondCallback] = useState(false)
      const onOpenMobileChange = useSecondCallback ? (value: boolean) => second.push(value) : (value: boolean) => first.push(value)
      return <SidebarProvider isMobile openMobile={openMobile} onOpenMobileChange={onOpenMobileChange}>
        <button onClick={() => setUseSecondCallback(true)}>Replace callback</button>
        <button onClick={() => setOpenMobile(true)}>Open from prop</button>
        <Sidebar><SidebarContent>Navigation</SidebarContent></Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    }
    const container = render(<ControlledMobile />)
    const trigger = container.querySelector('[data-slot="sidebar-trigger"]')!
    const controls = container.querySelectorAll("button:not([data-slot])")

    click(trigger)
    click(controls[1])
    click(controls[0])
    click(trigger)
    click(trigger)

    expect(first).toEqual([true])
    expect(second).toEqual([false, false])
  })

  test("preserves mobile Sheet sizing while merging caller styles", () => {
    const container = render(
      <SidebarProvider isMobile defaultOpenMobile>
        <Sidebar style={{ color: "rgb(255, 0, 0)" }}><SidebarContent>Navigation</SidebarContent></Sidebar>
      </SidebarProvider>
    )
    const sidebar = document.body.querySelector('[data-slot="sidebar"][data-mobile="true"]') as HTMLElement

    expect(sidebar.style.getPropertyValue("--sidebar-width")).toBe("18rem")
    expect(sidebar.style.color).toBe("rgb(255, 0, 0)")
    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull()
  })

  test("does not toggle when a consumer prevents the trigger click", () => {
    const container = render(
      <SidebarProvider isMobile={false} defaultOpen>
        <Sidebar><SidebarContent>Navigation</SidebarContent></Sidebar>
        <SidebarTrigger onClick={(event) => event.preventDefault()} />
      </SidebarProvider>
    )

    click(container.querySelector('[data-slot="sidebar-trigger"]')!)
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded")
  })

  test("renders collapsible none as effectively expanded even with a closed desktop channel", () => {
    const container = render(
      <SidebarProvider isMobile={false} defaultOpen={false}>
        <Sidebar collapsible="none"><SidebarContent>Navigation</SidebarContent></Sidebar>
      </SidebarProvider>
    )

    const sidebar = container.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")
    expect(sidebar?.getAttribute("data-collapsible")).toBe("")
  })

  test("keeps noncollapsible menu tooltips disabled when latent desktop state is closed", () => {
    const container = render(
      <TooltipProvider><SidebarProvider isMobile={false} defaultOpen={false}>
        <Sidebar collapsible="none"><SidebarMenu><SidebarMenuItem><SidebarMenuButton tooltip="Workspace">Workspace</SidebarMenuButton></SidebarMenuItem></SidebarMenu></Sidebar>
      </SidebarProvider></TooltipProvider>
    )
    const button = container.querySelector('[data-slot="sidebar-menu-button"]')!

    expect(button.getAttribute("data-state")).toBe("expanded")
  })

  test("hides showOnHover actions until their menu item is hovered or focused", () => {
    const container = render(
      <SidebarProvider isMobile={false}>
        <Sidebar><SidebarMenu><SidebarMenuItem><SidebarMenuButton>Workspace</SidebarMenuButton><SidebarMenuAction showOnHover>Actions</SidebarMenuAction></SidebarMenuItem></SidebarMenu></Sidebar>
      </SidebarProvider>
    )
    const action = container.querySelector('[data-slot="sidebar-menu-action"]')!

    expect(action.className).toContain("opacity-0")
    expect(action.className).toContain("group-hover/menu-item:opacity-100")
    expect(action.className).toContain("group-focus-within/menu-item:opacity-100")
  })

  test("renders skeleton markup deterministically and honors supplied widths", () => {
    const first = render(<SidebarMenuSkeleton showIcon />)
    const second = render(<SidebarMenuSkeleton showIcon />)
    const supplied = render(<SidebarMenuSkeleton width="42%" />)

    expect(first.innerHTML).toBe(second.innerHTML)
    expect(supplied.querySelector('[data-slot="sidebar-menu-skeleton-text"]')?.getAttribute("style")).toContain("--skeleton-width: 42%")
  })

  test("does not invoke ambient mobile detection or register persistence and shortcut side effects", () => {
    const cookieWrites: string[] = []
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (value: string) => cookieWrites.push(value) })
    const addEventListener = vi.spyOn(window, "addEventListener")

    try {
      render(<SidebarProvider isMobile={false}><Sidebar><SidebarContent>Navigation</SidebarContent></Sidebar></SidebarProvider>)

      expect(useIsMobileSpy).not.toHaveBeenCalled()
      expect(addEventListener).not.toHaveBeenCalled()
      expect(cookieWrites).toEqual([])
    } finally {
      addEventListener.mockRestore()
    }
  })

  test("keeps the context state observable through the active explicit channel", () => {
    function Probe() {
      const { open, openMobile, isMobile } = useSidebar()
      return <output>{`${open}/${openMobile}/${isMobile}`}</output>
    }
    const container = render(<SidebarProvider isMobile defaultOpen defaultOpenMobile={false}><Probe /></SidebarProvider>)
    expect(container.querySelector("output")?.textContent).toBe("true/false/true")
  })

  test("keeps focus-restoration internals out of the public useSidebar result", () => {
    function Probe() {
      return <output>{Object.keys(useSidebar()).sort().join(",")}</output>
    }

    const container = render(<SidebarProvider><Probe /></SidebarProvider>)

    expect(container.querySelector("output")?.textContent).toBe("isMobile,open,openMobile,setOpen,setOpenMobile,state,toggleSidebar")
  })

  test("renders Rail only for the explicit desktop presentation regardless of browser width", () => {
    const originalWidth = window.innerWidth
    function RailProbe() {
      const [isMobile, setIsMobile] = useState(false)
      const [, setRevision] = useState(0)
      return <>
        <button data-testid="presentation" onClick={() => setIsMobile((value) => !value)}>Change presentation</button>
        <button data-testid="rerender" onClick={() => setRevision((value) => value + 1)}>Rerender</button>
        <SidebarProvider isMobile={isMobile} defaultOpenMobile>
          <Sidebar><SidebarRail /></Sidebar>
        </SidebarProvider>
      </>
    }

    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
      const container = render(<RailProbe />)
      const presentation = container.querySelector('[data-testid="presentation"]')!
      const rerender = container.querySelector('[data-testid="rerender"]')!

      expect(container.querySelector('[data-slot="sidebar-rail"]')).not.toBeNull()
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 })
      click(rerender)
      expect(container.querySelector('[data-slot="sidebar-rail"]')).not.toBeNull()

      click(presentation)
      expect(document.body.querySelector('[data-slot="sidebar-rail"]')).toBeNull()
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
      click(rerender)
      expect(document.body.querySelector('[data-slot="sidebar-rail"]')).toBeNull()
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })
})

afterEach(() => {
  useIsMobileSpy.mockClear()
  if (originalCookieDescriptor) Object.defineProperty(document, "cookie", originalCookieDescriptor)
  else delete (document as { cookie?: string }).cookie
})
