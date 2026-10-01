// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"
import { Icon } from "../src/components/ui/icon"

const svg = (props: Record<string, unknown>) => {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(<Icon name="info" {...props} />)
  return container.querySelector("svg")!
}

describe("Icon semantic color", () => {
  test("inherits surrounding color by default, including interactive foregrounds", () => {
    for (const props of [{}, { color: "inherit" }]) {
      const node = svg(props)
      expect(node.getAttribute("stroke")).toBe("currentColor")
      expect(node.getAttribute("class")).not.toMatch(/text-(foreground|primary|muted-foreground|destructive)/)
      expect(node.hasAttribute("color")).toBe(false)
    }
  })

  test.each(["foreground", "primary", "muted-foreground", "destructive"])("uses the governed %s token without changing SVG semantics", (color) => {
    const node = svg({ color, decorative: false, label: "Information" })
    expect(node.classList.contains(`text-${color}`)).toBe(true)
    expect(node.getAttribute("stroke")).toBe("currentColor")
    expect(node.getAttribute("role")).toBe("img")
    expect(node.getAttribute("aria-label")).toBe("Information")
    expect(node.hasAttribute("style")).toBe(false)
    expect(node.hasAttribute("color")).toBe(false)
  })

  test.each(["red", "#ff0000", "var(--custom)", "toString", "", null])("rejects arbitrary color %s", (color) => {
    expect(() => svg({ color })).toThrow(/color/i)
  })
})
