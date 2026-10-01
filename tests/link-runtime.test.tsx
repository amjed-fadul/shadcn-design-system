// @vitest-environment jsdom
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import * as designSystem from "../src/package"

const Link = (designSystem as unknown as { Link: React.ComponentType<Record<string, unknown>> }).Link
const render = (props: Record<string, unknown> = {}, children: React.ReactNode = "Documentation") => {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(<Link href="/docs" {...props}>{children}</Link>)
  return container.querySelector("a")!
}

describe("governed Link runtime", () => {
  test("exports a reusable native navigation primitive", () => {
    expect(Link).toBeTypeOf("function")
  })

  test.each(["/docs", "#details", "https://example.com/docs", "mailto:team@example.com", "tel:+9715550100"])("preserves native destination %s without inferring a new tab", (href) => {
    const node = render({ href })
    expect(node.getAttribute("href")).toBe(href)
    expect(node.textContent).toBe("Documentation")
    expect(node.getAttribute("data-slot")).toBe("link")
    expect(node.hasAttribute("target")).toBe(false)
    expect(node.hasAttribute("rel")).toBe(false)
    expect(node.hasAttribute("role")).toBe(false)
    expect(node.hasAttribute("tabindex")).toBe(false)
  })

  test("opens a new tab only by explicit author choice and owns opener protection", () => {
    const node = render({ newTab: true })
    expect(node.getAttribute("target")).toBe("_blank")
    expect(node.getAttribute("rel")).toBe("noopener")
    expect(render({ newTab: false }).hasAttribute("target")).toBe(false)
  })

  test("does not forward styling, interaction or native attribute escape hatches", () => {
    const node = render({ className: "text-destructive", style: { color: "red" }, role: "button", disabled: true, asChild: true, target: "_blank", rel: "opener", tabIndex: -1, "aria-label": "Injected" })
    expect(node.classList.contains("text-destructive")).toBe(false)
    for (const attribute of ["style", "role", "disabled", "target", "rel", "tabindex", "aria-label", "asChild"]) expect(node.hasAttribute(attribute)).toBe(false)
  })

  test("keeps prose inline and underlined with a governed visible focus treatment", () => {
    const node = render()
    for (const utility of ["text-primary", "underline", "underline-offset-4", "focus-visible:ring-3", "focus-visible:ring-ring", "focus-visible:ring-offset-2", "focus-visible:ring-offset-background"]) expect(node.classList.contains(utility)).toBe(true)
    for (const utility of ["inline-flex", "whitespace-nowrap", "text-sm", "font-medium", "px-2.5", "h-8"]) expect(node.classList.contains(utility)).toBe(false)
  })

  test.each([undefined, null, "", "  ", 42])("rejects a missing or nonempty-string destination (%s)", (href) => {
    expect(() => render({ href })).toThrow(/href/i)
  })

  test.each([null, false, true, "", "   ", [], [null, false, " "]].map((children) => ({ children })))("rejects plainly empty content ($children)", ({ children }) => {
    expect(() => render({}, children)).toThrow(/children/i)
  })

  test("allows numbers and opaque child content while authors own its accessible name", () => {
    expect(render({}, 0).textContent).toBe("0")
    expect(render({}, <span>Read documentation</span>).textContent).toBe("Read documentation")
    expect(render({}, ["Read ", <strong key="docs">documentation</strong>]).textContent).toBe("Read documentation")
  })

  test("rejects omitted content at the JavaScript runtime boundary", () => {
    expect(() => renderToStaticMarkup(<Link href="/docs" />)).toThrow(/children/i)
  })
})
