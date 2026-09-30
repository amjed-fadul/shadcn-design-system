// @vitest-environment jsdom

import { Mail } from "lucide-react"
import { forwardRef } from "react"
import { userEvent, within } from "storybook/test"
import { describe, expect, test, vi } from "vitest"

import { Button } from "../src/components/ui/button"
import { InputGroupButton } from "../src/components/ui/input-group"
import { render } from "./studio-test-utils"

const buttonOf = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button")!
const hasAccessibleName = (container: HTMLElement, name: string) =>
  within(container).queryByRole("button", { name }) === buttonOf(container)

const DefaultDisabledButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button">>(
  ({ disabled = true, ...props }, ref) => <button ref={ref} disabled={disabled} {...props} />
)

describe("Button loading", () => {
  test("renders the governed Spinner before the label", () => {
    const container = render(<Button loading>Log in</Button>)
    const button = buttonOf(container)
    const spinner = button.querySelector("[data-slot='spinner']")!

    expect(spinner).not.toBeNull()
    expect(spinner.tagName.toLowerCase()).toBe("svg")
    expect(spinner.getAttribute("data-icon")).toBe("inline-start")
    expect(button.firstElementChild).toBe(spinner)
    expect(button.textContent).toBe("Log in")
  })

  test("exposes aria-busy and the native disabled attribute while loading", () => {
    const button = buttonOf(render(<Button loading>Log in</Button>))

    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.disabled).toBe(true)
  })

  test("keeps the accessible name as the action and adds no status announcement", () => {
    const container = render(<Button loading>Log in</Button>)
    const button = buttonOf(container)
    const spinner = button.querySelector("[data-slot='spinner']")!

    expect(hasAccessibleName(container, "Log in")).toBe(true)
    expect(spinner.getAttribute("aria-hidden")).toBe("true")
    expect(spinner.hasAttribute("role")).toBe(false)
    expect(spinner.hasAttribute("aria-label")).toBe(false)
    expect(container.querySelector("[role='status'], [aria-live]")).toBeNull()
  })

  test("keeps an author aria-label as the accessible name", () => {
    const container = render(<Button loading aria-label="Log in to Konsta">Log in</Button>)

    expect(hasAccessibleName(container, "Log in to Konsta")).toBe(true)
  })

  test("blocks pointer, keyboard, and form activation while loading", async () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const container = render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading onClick={onClick}>Log in</Button>
      </form>
    )
    const button = buttonOf(container)

    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    button.click()

    expect(document.activeElement).not.toBe(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("hides the leading icon so the Spinner replaces it without changing the layout", () => {
    const container = render(
      <Button loading>
        <Mail data-icon="inline-start" />
        Log in
      </Button>
    )
    const button = buttonOf(container)

    expect(button.querySelectorAll("svg")).toHaveLength(2)
    expect(button.className).toContain("[&>[data-icon=inline-start]:not([data-slot=spinner])]:hidden")
  })

  test("swaps an icon-only button's icon for the Spinner without resizing it", () => {
    const container = render(
      <Button loading size="icon" aria-label="Refresh">
        <Mail />
      </Button>
    )
    const button = buttonOf(container)

    expect(button.className).toContain("data-[size^=icon]:[&>svg:not([data-slot=spinner])]:hidden")
    expect(button.className).toContain("size-8")
    expect(hasAccessibleName(container, "Refresh")).toBe(true)
  })

  test("swaps an InputGroupButton icon for the Spinner, which forwards its icon size only through data-size", () => {
    const container = render(
      <InputGroupButton loading size="icon-xs" aria-label="Clear">
        <Mail />
      </InputGroupButton>
    )
    const button = buttonOf(container)

    expect(button.getAttribute("data-size")).toBe("icon-xs")
    expect(button.className).toContain("data-[size^=icon]:[&>svg:not([data-slot=spinner])]:hidden")
    expect(button.querySelector("[data-slot='spinner']")).not.toBeNull()
    expect(hasAccessibleName(container, "Clear")).toBe(true)
  })

  test.each(["default", "secondary", "outline", "destructive"] as const)("loads with the %s variant", (variant) => {
    const button = buttonOf(render(<Button loading variant={variant}>Save</Button>))

    expect(button.getAttribute("data-variant")).toBe(variant)
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.querySelector("[data-slot='spinner']")).not.toBeNull()
  })

  test("stays busy and disabled in RTL", () => {
    const container = render(
      <div dir="rtl">
        <Button loading>تسجيل الدخول</Button>
      </div>
    )
    const button = buttonOf(container)

    expect(hasAccessibleName(container, "تسجيل الدخول")).toBe(true)
    expect(button.disabled).toBe(true)
  })
})

describe("Button without loading", () => {
  test.each([undefined, false, true])("preserves a slotted child's default disabled state when loading is %s", (loading) => {
    const container = render(<Button asChild loading={loading}><DefaultDisabledButton>Save</DefaultDisabledButton></Button>)

    expect(buttonOf(container).disabled).toBe(true)
    expect(buttonOf(container).hasAttribute("aria-busy")).toBe(false)
    expect(buttonOf(container).querySelector("[data-slot='spinner']")).toBeNull()
  })

  test.each([undefined, false])("preserves native inner HTML when loading is %s", (loading) => {
    const container = render(<Button loading={loading} dangerouslySetInnerHTML={{ __html: "<span>Save</span>" }} />)

    expect(buttonOf(container).innerHTML).toBe("<span>Save</span>")
    expect(hasAccessibleName(container, "Save")).toBe(true)
  })

  test("renders no Spinner, no aria-busy, and stays enabled", async () => {
    const onClick = vi.fn()
    const button = buttonOf(render(<Button onClick={onClick}>Log in</Button>))

    expect(button.querySelector("[data-slot='spinner']")).toBeNull()
    expect(button.hasAttribute("aria-busy")).toBe(false)
    expect(button.disabled).toBe(false)

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("loading={false} matches the default", () => {
    const button = buttonOf(render(<Button loading={false}>Log in</Button>))

    expect(button.hasAttribute("aria-busy")).toBe(false)
    expect(button.disabled).toBe(false)
  })

  test("keeps disabled behavior and caller-supplied props", () => {
    const button = buttonOf(render(<Button disabled aria-busy="false" className="extra" type="submit">Log in</Button>))

    expect(button.disabled).toBe(true)
    expect(button.getAttribute("aria-busy")).toBe("false")
    expect(button.className).toContain("extra")
    expect(button.type).toBe("submit")
    expect(button.getAttribute("data-slot")).toBe("button")
  })

  test("keeps asChild delegation unchanged", () => {
    const container = render(
      <Button asChild>
        <a href="https://example.com">Docs</a>
      </Button>
    )
    const link = container.querySelector("a")!

    expect(link.getAttribute("data-slot")).toBe("button")
    expect(link.hasAttribute("aria-busy")).toBe(false)
    expect(link.querySelector("[data-slot='spinner']")).toBeNull()
  })

  test("ignores loading under asChild, which cannot own the child's content or disabled state", () => {
    const container = render(
      <Button asChild loading>
        <a href="https://example.com">Docs</a>
      </Button>
    )
    const link = container.querySelector("a")!

    expect(link.hasAttribute("aria-busy")).toBe(false)
    expect(link.hasAttribute("disabled")).toBe(false)
    expect(link.querySelector("[data-slot='spinner']")).toBeNull()
  })
})
