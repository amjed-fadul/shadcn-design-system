// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import * as designSystem from "../src/package"
import { Button } from "../src/components/ui/button"

// Starting through the public export makes the missing capability fail as an
// assertion before source exists, instead of hiding that failure in resolution.
const Icon = (designSystem as unknown as { Icon: React.ComponentType<Record<string, unknown>> }).Icon
const dom = (element: React.ReactElement) => {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(element)
  return container
}
const svg = (element: React.ReactElement) => dom(element).querySelector("svg")!

describe("governed Icon runtime", () => {
  test("exports a reusable icon through the package", () => {
    expect(Icon).toBeTypeOf("function")
  })

  test("decorative icons are hidden and cannot inject caller SVG attributes", () => {
    const node = svg(<Icon name="search" className="size-96" style={{ color: "red" }} role="alert" viewBox="0 0 1 1" />)
    expect(node.getAttribute("data-slot")).toBe("icon")
    expect(node.getAttribute("aria-hidden")).toBe("true")
    expect(node.hasAttribute("role")).toBe(false)
    expect(node.hasAttribute("aria-label")).toBe(false)
    expect(node.hasAttribute("style")).toBe(false)
    expect(node.getAttribute("viewBox")).toBe("0 0 24 24")
    expect(node.classList.contains("size-96")).toBe(false)
    expect(node.classList.contains("size-4")).toBe(true)
    expect(node.getAttribute("focusable")).toBe("false")
  })

  test.each([["sm", "size-3.5"], ["default", "size-4"], ["lg", "size-5"]])("governs %s size", (size, utility) => {
    expect(svg(<Icon name="check" size={size} />).classList.contains(utility)).toBe(true)
  })

  test("meaningful icons expose their author-provided label as an image", () => {
    const node = svg(<Icon name="info" decorative={false} label="Information" />)
    expect(node.getAttribute("role")).toBe("img")
    expect(node.getAttribute("aria-label")).toBe("Information")
    expect(node.hasAttribute("aria-hidden")).toBe(false)
  })

  test.each([undefined, "", "   "])("rejects a meaningful icon without a usable label (%s)", (label) => {
    expect(() => renderToStaticMarkup(<Icon name="info" decorative={false} label={label} />)).toThrow(/label/i)
  })

  test("logical directions mirror; physical directions remain fixed", () => {
    for (const name of ["arrow-start", "arrow-end", "chevron-start", "chevron-end"]) {
      expect(svg(<Icon name={name} />).classList.contains("rtl:rotate-180")).toBe(true)
    }
    for (const name of ["arrow-left", "arrow-right", "chevron-left", "chevron-right", "chevron-up", "chevron-down"]) {
      expect(svg(<Icon name={name} />).classList.contains("rtl:rotate-180")).toBe(false)
    }
  })

  test("Button composition keeps the action name and the inline loading marker", () => {
    const button = dom(<Button aria-label="Search" size="icon"><Icon name="search" /></Button>)
    expect(button.querySelector("button")!.getAttribute("aria-label")).toBe("Search")
    expect(button.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true")
    expect(svg(<Icon name="arrow-end" placement="inline-end" />).getAttribute("data-icon")).toBe("inline-end")
  })

  test("rejects ungoverned icon identity at the runtime boundary", () => {
    expect(() => renderToStaticMarkup(<Icon name="toString" />)).toThrow(/name/i)
  })
})
