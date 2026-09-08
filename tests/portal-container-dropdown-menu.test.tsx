// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/package"
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

    test("DropdownMenu places its content and items in the supplied host", () => {
      const portalContainer = host()
      render(<DropdownMenu open><DropdownMenuTrigger>Open</DropdownMenuTrigger><DropdownMenuContent {...{ portalContainer }}><DropdownMenuItem>One</DropdownMenuItem><DropdownMenuItem>Two</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)
      const target = portalContainer ?? document.body
      expect(target.querySelector('[role="menu"]')).not.toBeNull()
      expect(target.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
      expect(target.querySelector('[portalContainer], [portalcontainer]')).toBeNull()
      if (portalContainer) expect(document.body.querySelectorAll('[role="menu"]').length).toBe(kind === "fragment" ? 0 : 1)
    })
  })
}
