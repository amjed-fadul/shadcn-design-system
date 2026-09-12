// @vitest-environment jsdom

import { act } from "react"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { render } from "./studio-test-utils"

const fixturePath = resolve(process.cwd(), "tests/fixtures/sidebar-normal-app-recipe.tsx")

async function loadRecipe() {
  expect(existsSync(fixturePath)).toBe(true)
  return import("./fixtures/sidebar-normal-app-recipe")
}

function shortcut(target: Element, init: { metaKey?: boolean; ctrlKey?: boolean } = { ctrlKey: true }) {
  act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true, ...init })))
}

describe("Sidebar normal-app recipe", () => {
  test("owns desktop and mobile persistence outside the core", async () => {
    const { SidebarNormalAppFixture } = await loadRecipe()
    const writes: string[] = []
    const original = Object.getOwnPropertyDescriptor(document, "cookie")
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (value: string) => writes.push(value) })
    try {
      const container = render(<SidebarNormalAppFixture isMobile={false} active />)
      shortcut(container.querySelector('[data-slot="sidebar-wrapper"]')!)
      expect(writes).toContain("sidebar_state=false; path=/; max-age=604800")

      const mobile = render(<SidebarNormalAppFixture isMobile active />)
      shortcut(mobile.querySelector('[data-slot="sidebar-wrapper"]')!)
      expect(writes).toContain("sidebar_mobile_state=true; path=/; max-age=604800")
    } finally {
      if (original) Object.defineProperty(document, "cookie", original)
      else delete (document as { cookie?: string }).cookie
    }
  })

  test("allows only the active recipe instance to handle Cmd or Ctrl+B", async () => {
    const { SidebarNormalAppFixture } = await loadRecipe()
    const container = render(<><SidebarNormalAppFixture isMobile={false} active={false} label="Inactive" /><SidebarNormalAppFixture isMobile={false} active label="Active" /></>)
    shortcut(document.body)
    const sidebars = container.querySelectorAll('[data-slot="sidebar"]')
    expect(sidebars[0]?.getAttribute("data-state")).toBe("expanded")
    expect(sidebars[1]?.getAttribute("data-state")).toBe("collapsed")
  })

  test.each([
    ["input", <input aria-label="input target" />],
    ["textarea", <textarea aria-label="textarea target" />],
    ["select", <select aria-label="select target"><option>One</option></select>],
    ["contenteditable", <div contentEditable suppressContentEditableWarning>editable target</div>],
  ])("suppresses the shortcut for %s targets", async (_name, target) => {
    const { SidebarNormalAppFixture } = await loadRecipe()
    const container = render(<SidebarNormalAppFixture isMobile={false} active>{target}</SidebarNormalAppFixture>)
    shortcut(container.querySelector('[contenteditable], input, textarea, select')!)
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded")
  })

  test("accepts the macOS command modifier", async () => {
    const { SidebarNormalAppFixture } = await loadRecipe()
    const container = render(<SidebarNormalAppFixture isMobile={false} active />)
    shortcut(document.body, { metaKey: true })
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed")
  })
})

afterEach(() => {
  document.cookie = "sidebar_state=; max-age=0"
  document.cookie = "sidebar_mobile_state=; max-age=0"
})
