// @vitest-environment jsdom

import { act, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, test } from "vitest"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../src/components/ui/accordion"
import { Card, CardContent, CardTitle } from "../src/components/ui/card"
import { Checkbox } from "../src/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../src/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu"
import { Label } from "../src/components/ui/label"
import { ScrollArea } from "../src/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../src/components/ui/sheet"
import { Sidebar, SidebarContent, SidebarProvider } from "../src/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../src/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs"
import { Textarea } from "../src/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
})
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
})
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => {},
})
Object.defineProperty(globalThis, "PointerEvent", {
  configurable: true,
  value: class PointerEvent extends MouseEvent {
    pointerType: string
    pointerId: number

    constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? "mouse"
      this.pointerId = init.pointerId ?? 1
    }
  },
})

let mounted: Array<{ container: HTMLDivElement; root: Root }> = []

function render(element: ReactNode) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => root.render(element))
  mounted.push({ container, root })

  return container
}

afterEach(() => {
  for (const { container, root } of mounted.reverse()) {
    act(() => root.unmount())
    container.remove()
  }
  mounted = []
  document.body.innerHTML = ""
})

describe("Studio V1 component foundation", () => {
  test("renders simple layout and form primitives with semantic slots", () => {
    const markup = renderToStaticMarkup(
      <>
        <Card>
          <CardTitle>Settings</CardTitle>
          <CardContent>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" aria-label="Description" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Button</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarContent>Studio navigation</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </>
    )

    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="label"')
    expect(markup).toContain('data-slot="textarea"')
    expect(markup).toContain('data-slot="table"')
    expect(markup).toContain('for="description"')
    expect(markup).toContain('data-slot="sidebar"')
  })

  test("updates a controlled checkbox through its public callback", () => {
    function Harness() {
      const [checked, setChecked] = useState(false)

      return (
        <>
          <Checkbox aria-label="Include deprecated" checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          <output>{String(checked)}</output>
        </>
      )
    }

    const container = render(<Harness />)
    const checkbox = container.querySelector('[role="checkbox"]')

    expect(checkbox).not.toBeNull()
    expect(checkbox?.getAttribute("aria-checked")).toBe("false")

    act(() => checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(checkbox?.getAttribute("aria-checked")).toBe("true")
    expect(container.querySelector("output")?.textContent).toBe("true")
  })

  test("changes the active tab and exposes only the selected panel", async () => {
    const container = render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="usage">Usage panel</TabsContent>
      </Tabs>
    )

    const usage = container.querySelector('[role="tab"][data-state="inactive"]') as HTMLButtonElement
    expect(container.querySelector('[role="tabpanel"][data-state="active"]')?.textContent).toContain("Overview panel")

    await act(async () => usage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })))

    expect(container.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain("Usage")
    expect(container.querySelector('[role="tabpanel"][data-state="active"]')?.textContent).toContain("Usage panel")
  })

  test("selects an item through the controlled Select composition", async () => {
    function Harness() {
      const [value, setValue] = useState("neutral")

      return (
        <>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger aria-label="Theme">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="contrast">Contrast</SelectItem>
            </SelectContent>
          </Select>
          <output>{value}</output>
        </>
      )
    }

    const container = render(<Harness />)
    const trigger = container.querySelector('[role="combobox"]') as HTMLButtonElement

    await act(async () => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }))
      trigger.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }))
    })
    const option = document.body.querySelectorAll('[role="option"]')[1] as HTMLElement
    expect(option).not.toBeNull()

    await act(async () => option.click())

    expect(container.querySelector("output")?.textContent).toBe("contrast")
  })

  test("opens compound disclosure and menu interactions", () => {
    const container = render(
      <>
        <Accordion type="single" collapsible>
          <AccordionItem value="details">
            <AccordionTrigger>Details</AccordionTrigger>
            <AccordionContent>Release details</AccordionContent>
          </AccordionItem>
        </Accordion>
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Review</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )

    const accordionTrigger = container.querySelector('[data-slot="accordion-trigger"]') as HTMLButtonElement
    act(() => accordionTrigger.click())
    expect(container.querySelector('[data-slot="accordion-content"]')?.getAttribute("data-state")).toBe("open")

    const menuTrigger = container.querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLButtonElement
    act(() => {
      menuTrigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }))
    })
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()

    act(() => {
      menuTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
  })

  test("mounts Dialog, Sheet, and Tooltip content through portals", () => {
    const container = render(
      <TooltipProvider>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog title</DialogTitle>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetTitle>Sheet title</SheetTitle>
          </SheetContent>
        </Sheet>
        <Tooltip open>
          <TooltipTrigger>Help</TooltipTrigger>
          <TooltipContent>Helpful text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    act(() => (container.querySelector('[data-slot="dialog-trigger"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Dialog title")

    act(() => (container.querySelector('[data-slot="sheet-trigger"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-slot="sheet-content"]')?.textContent).toContain("Sheet title")

    expect(document.body.querySelector('[data-slot="tooltip-content"]')).toBeTruthy()
  })

  test("creates a scroll-area viewport for long content", () => {
    const container = render(
      <ScrollArea type="always" className="h-20">
        <div>Token content</div>
      </ScrollArea>
    )

    expect(container.querySelector('[data-slot="scroll-area"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).not.toBeNull()
  })
})
