// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/package"
import { render } from "./studio-test-utils"

beforeEach(() => { vi.spyOn(console, "error") })
afterEach(() => { try { expect(console.error).not.toHaveBeenCalled() } finally { vi.restoreAllMocks() } })

for (const kind of ["element", "fragment", "default"] as const) {
  describe(`public portal placement: ${kind}`, () => {
    const host = () => {
      if (kind === "default") return undefined
      const element = document.createElement("section")
      document.body.append(element)
      // A connected ShadowRoot is a DocumentFragment and supports modal accessibility.
      return kind === "fragment" ? element.attachShadow({ mode: "open" }) : element
    }

    test("Dialog contains both content and overlay in the supplied host", () => {
      const portalContainer = host()
      render(<Dialog open><DialogContent {...{ portalContainer }}><DialogTitle>Scoped dialog</DialogTitle><DialogDescription>Page-local content</DialogDescription></DialogContent></Dialog>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="dialog"]')).not.toBeNull()
      expect(target.querySelector('[role="dialog"]')?.textContent).toContain("Scoped dialog")
      expect(target.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull()
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
      if (portalContainer) expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(kind === "fragment" ? 0 : 1)
    })

    test("Select places its public compound options in the supplied host", () => {
      const portalContainer = host()
      render(<Select open value="one"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent {...{ portalContainer }}><SelectItem value="one">One</SelectItem><SelectItem value="two">Two</SelectItem></SelectContent></Select>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="listbox"]')).not.toBeNull()
      expect(target.querySelectorAll('[role="option"]')).toHaveLength(2)
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
    })

    test("DropdownMenu places its content and items in the supplied host", () => {
      const portalContainer = host()
      render(<DropdownMenu open><DropdownMenuTrigger>Open</DropdownMenuTrigger><DropdownMenuContent {...{ portalContainer }}><DropdownMenuItem>One</DropdownMenuItem><DropdownMenuItem>Two</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="menu"]')).not.toBeNull()
      expect(target.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
      if (portalContainer) expect(document.body.querySelectorAll('[role="menu"]').length).toBe(kind === "fragment" ? 0 : 1)
    })

    test("Sheet contains both content and overlay in the supplied host", () => {
      const portalContainer = host()
      render(<Sheet open><SheetContent {...{ portalContainer }}><SheetTitle>Scoped sheet</SheetTitle><SheetDescription>Page-local content</SheetDescription></SheetContent></Sheet>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="dialog"]')).not.toBeNull()
      expect(target.querySelector('[role="dialog"]')?.textContent).toContain("Scoped sheet")
      expect(target.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull()
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
      if (portalContainer) expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(kind === "fragment" ? 0 : 1)
    })

    test("Tooltip places its content in the supplied host", () => {
      const portalContainer = host()
      render(<TooltipProvider><Tooltip open><TooltipTrigger>Hover</TooltipTrigger><TooltipContent {...{ portalContainer }}>Scoped tooltip</TooltipContent></Tooltip></TooltipProvider>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="tooltip"]')).not.toBeNull()
      expect(target.querySelector('[role="tooltip"]')?.textContent).toContain("Scoped tooltip")
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
      if (portalContainer) expect(document.body.querySelectorAll('[role="tooltip"]').length).toBe(kind === "fragment" ? 0 : 1)
    })
  })
}
