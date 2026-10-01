// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import * as designSystem from "../src/package"

const Image = (designSystem as unknown as { Image: React.ComponentType<Record<string, unknown>> }).Image
const props = { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", alt: "Landscape", width: 640, height: 360 }
const image = (overrides: Record<string, unknown> = {}) => {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(<Image {...props} {...overrides} />)
  return container.querySelector("img")!
}

describe("governed Image runtime", () => {
  test("exports a generic image through the public package", () => {
    expect(Image).toBeTypeOf("function")
  })

  test("uses native image semantics, intrinsic dimensions and eager containment by default", () => {
    const node = image()
    expect(node.getAttribute("data-slot")).toBe("image")
    expect(node.getAttribute("src")).toBe(props.src)
    expect(node.getAttribute("alt")).toBe("Landscape")
    expect(node.getAttribute("width")).toBe("640")
    expect(node.getAttribute("height")).toBe("360")
    expect(node.getAttribute("loading")).toBe("eager")
    expect(node.classList.contains("block")).toBe(true)
    expect(node.classList.contains("max-w-full")).toBe(true)
    expect(node.classList.contains("h-auto")).toBe(true)
    expect(node.classList.contains("object-contain")).toBe(true)
    expect(node.hasAttribute("role")).toBe(false)
  })

  test("allows deliberately decorative images using an empty alt", () => {
    expect(image({ alt: "" }).getAttribute("alt")).toBe("")
  })

  test("fill and cover govern the parent-sized image box without losing intrinsic attributes", () => {
    const node = image({ layout: "fill", fit: "cover", loading: "lazy" })
    expect(node.classList.contains("w-full")).toBe(true)
    expect(node.classList.contains("h-full")).toBe(true)
    expect(node.classList.contains("h-auto")).toBe(false)
    expect(node.classList.contains("object-cover")).toBe(true)
    expect(node.getAttribute("width")).toBe("640")
    expect(node.getAttribute("height")).toBe("360")
    expect(node.getAttribute("loading")).toBe("lazy")
  })

  test("ignores caller-supplied CSS, DOM attributes and behavior", () => {
    const node = image({ className: "rounded-full size-96", style: { width: 999 }, role: "button", "aria-label": "Override", tabIndex: 0, srcSet: "arbitrary 2x", onClick: () => {}, id: "escape" })
    expect(node.classList.contains("rounded-full")).toBe(false)
    expect(node.classList.contains("size-96")).toBe(false)
    for (const attribute of ["style", "role", "aria-label", "tabindex", "srcset", "id", "onclick"]) expect(node.hasAttribute(attribute)).toBe(false)
  })

  test.each([undefined, "", "   ", 1])("rejects an unusable src (%s)", (src) => {
    expect(() => image({ src })).toThrow(/src/i)
  })

  test.each([undefined, "   ", 1])("rejects missing or whitespace-only alt (%s)", (alt) => {
    expect(() => image({ alt })).toThrow(/alt/i)
  })

  test.each([undefined, 0, -1, 1.5, Infinity, NaN, "640"])("rejects invalid intrinsic dimensions (%s)", (value) => {
    expect(() => image({ width: value })).toThrow(/dimension/i)
    expect(() => image({ height: value })).toThrow(/dimension/i)
  })

  test.each([["layout", "absolute"], ["fit", "stretch"], ["loading", "auto"]])("rejects an ungoverned %s", (name, value) => {
    expect(() => image({ [name]: value })).toThrow(new RegExp(name, "i"))
  })
})
