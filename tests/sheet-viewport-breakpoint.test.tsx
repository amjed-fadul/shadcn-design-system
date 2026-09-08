// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../src/package"
import { render } from "./studio-test-utils"

beforeEach(() => { vi.spyOn(console, "error") })
afterEach(() => { try { expect(console.error).not.toHaveBeenCalled() } finally { vi.restoreAllMocks() } })

// Sheet's size must resolve from its containing block only, not the browser
// viewport. `sidebar` is excluded from governance for exactly this defect
// (h-svh/min-h-svh plus a md: breakpoint); Sheet must not carry a milder form
// of the same problem via a viewport-conditional Tailwind class.
const VIEWPORT_BREAKPOINT_CLASS = /(?:^|\s)(?:sm|md|lg|xl):\S+/
const VIEWPORT_UNIT_CLASS = /\b(?:svh|dvh|vh|vw)\b/

for (const side of ["right", "left"] as const) {
  test(`SheetContent (side="${side}") className has no viewport-conditional classes`, () => {
    render(
      <Sheet open>
        <SheetContent side={side}>
          <SheetTitle>Scoped sheet</SheetTitle>
          <SheetDescription>Page-local content</SheetDescription>
        </SheetContent>
      </Sheet>
    )
    const content = document.body.querySelector('[data-slot="sheet-content"]')
    expect(content).not.toBeNull()
    const className = content!.getAttribute("class") ?? ""
    expect(className).not.toMatch(VIEWPORT_BREAKPOINT_CLASS)
    expect(className).not.toMatch(VIEWPORT_UNIT_CLASS)
  })
}
