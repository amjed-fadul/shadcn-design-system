// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/package"
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
