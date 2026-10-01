// @vitest-environment jsdom

import { act } from "react"
import { describe, expect, test } from "vitest"

import { Toggle } from "../src/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle-group"
import { render } from "./studio-test-utils"

function items(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-slot="toggle-group-item"]')]
}

describe("ToggleGroup selected presentation", () => {
  test("merges primary selected styles after the shared recipe without changing standalone Toggle", () => {
    const container = render(<><Toggle defaultPressed>Standalone</Toggle><ToggleGroup type="single" defaultValue="bold"><ToggleGroupItem value="bold">Bold</ToggleGroupItem><ToggleGroupItem value="italic">Italic</ToggleGroupItem></ToggleGroup></>)
    const [selected, available] = items(container)
    expect(selected.dataset.state).toBe("on")
    expect(available.dataset.state).toBe("off")
    expect(selected.classList.contains("data-[state=on]:bg-primary")).toBe(true)
    expect(selected.classList.contains("data-[state=on]:text-primary-foreground")).toBe(true)
    expect(selected.classList.contains("data-[state=on]:bg-muted")).toBe(false)
    expect(selected.classList.contains("data-[state=on]:hover:bg-primary")).toBe(true)
    expect(selected.classList.contains("data-[state=on]:hover:text-primary-foreground")).toBe(true)
    const standalone = container.querySelector('[data-slot="toggle"]')!
    expect(standalone.classList.contains("data-[state=on]:bg-muted")).toBe(true)
    expect(standalone.classList.contains("data-[state=on]:bg-primary")).toBe(false)
  })

  test("uses a separated full-color focus ring while retaining connected focus stacking", () => {
    const container = render(<ToggleGroup type="single" variant="outline" spacing={0}><ToggleGroupItem value="bold">Bold</ToggleGroupItem></ToggleGroup>)
    const [item] = items(container)
    expect(item.classList.contains("focus-visible:ring-ring")).toBe(true)
    expect(item.classList.contains("focus-visible:ring-ring/50")).toBe(false)
    expect(item.classList.contains("focus-visible:ring-offset-2")).toBe(true)
    expect(item.classList.contains("focus-visible:ring-offset-background")).toBe(true)
    expect(item.classList.contains("focus-visible:ring-2")).toBe(true)
    expect(item.classList.contains("focus-visible:z-10")).toBe(true)
  })

  test("preserves single selection semantics and ignores disabled actions", () => {
    const container = render(<ToggleGroup type="single" defaultValue="bold" dir="rtl"><ToggleGroupItem value="bold">Bold</ToggleGroupItem><ToggleGroupItem value="italic">Italic</ToggleGroupItem><ToggleGroupItem value="disabled" disabled>Disabled</ToggleGroupItem></ToggleGroup>)
    const [bold, italic, disabled] = items(container)
    expect(bold.getAttribute("role")).toBe("radio")
    expect(bold.getAttribute("aria-checked")).toBe("true")
    act(() => italic.click())
    expect(bold.dataset.state).toBe("off")
    expect(italic.dataset.state).toBe("on")
    expect(italic.getAttribute("aria-checked")).toBe("true")
    act(() => disabled.click())
    expect(disabled.disabled).toBe(true)
    expect(disabled.dataset.state).toBe("off")
    expect(italic.dataset.state).toBe("on")
    expect(container.querySelector('[data-slot="toggle-group"]')?.getAttribute("dir")).toBe("rtl")
  })

  test("preserves independent multiple selection and disabled selected items", () => {
    const container = render(<ToggleGroup type="multiple" defaultValue={["bold", "underline"]}><ToggleGroupItem value="bold">Bold</ToggleGroupItem><ToggleGroupItem value="italic">Italic</ToggleGroupItem><ToggleGroupItem value="underline" disabled>Underline</ToggleGroupItem></ToggleGroup>)
    const [bold, italic, underline] = items(container)
    act(() => italic.click())
    expect(items(container).map((item) => item.dataset.state)).toEqual(["on", "on", "on"])
    expect(bold.getAttribute("aria-pressed")).toBe("true")
    expect(underline.getAttribute("aria-pressed")).toBe("true")
    act(() => bold.click())
    act(() => underline.click())
    expect(items(container).map((item) => item.dataset.state)).toEqual(["off", "on", "on"])
    expect(underline.classList.contains("disabled:opacity-50")).toBe(true)
    expect(underline.classList.contains("disabled:pointer-events-none")).toBe(true)
  })
})
