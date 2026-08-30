// @vitest-environment jsdom

import { act } from "react"
import { describe, expect, test } from "vitest"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../src/components/ui/accordion"
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "../src/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../src/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip"
import { render } from "./studio-test-utils"

describe("Studio V1 overlay and compound component foundation", () => {
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

  test("preserves DialogFooter showCloseButton behavior", () => {
    const container = render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    )

    act(() => (container.querySelector('[data-slot="dialog-trigger"]') as HTMLButtonElement).click())

    const closeButton = document.body.querySelector('[data-slot="dialog-footer"] button') as HTMLButtonElement
    expect(closeButton?.textContent).toContain("Close")
    act(() => closeButton.click())
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

})
