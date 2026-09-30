// @vitest-environment jsdom

import { act, createRef } from "react"
import { createRoot } from "react-dom/client"
import { within } from "storybook/test"
import { describe, expect, test } from "vitest"

import { Alert, AlertDescription, Status } from "../src/components/ui/alert"
import { Button } from "../src/components/ui/button"
import { FieldError } from "../src/components/ui/field"
import { Spinner } from "../src/components/ui/spinner"
import { render } from "./studio-test-utils"

const LIVE = "[role='status'], [role='alert'], [role='log'], [aria-live]"
const statusOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-slot='status']")!

describe("Status semantics", () => {
  test("default Status is a polite status live region", () => {
    const status = statusOf(render(<Status>Saving…</Status>))

    expect(status.getAttribute("role")).toBe("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.getAttribute("data-variant")).toBe("default")
    expect(status.textContent).toBe("Saving…")
  })

  test("error Status is an assertive alert live region", () => {
    const status = statusOf(render(<Status variant="error">Login failed</Status>))

    expect(status.getAttribute("role")).toBe("alert")
    expect(status.getAttribute("aria-live")).toBe("assertive")
    expect(status.getAttribute("data-variant")).toBe("error")
    expect(status.className).toContain("text-destructive")
  })

  test("routine loading and success messages are never assertive", () => {
    for (const text of ["Saving…", "Saved", "Loading results…"]) {
      const status = statusOf(render(<Status>{text}</Status>))
      expect(status.getAttribute("aria-live")).not.toBe("assertive")
      expect(status.getAttribute("role")).not.toBe("alert")
    }
  })

  test("a caller cannot override the governed role or live behavior", () => {
    const hostile = { role: "log", "aria-live": "off" } as Record<string, string>
    const status = statusOf(render(<Status {...hostile}>Saved</Status>))

    expect(status.getAttribute("role")).toBe("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
  })

  test("forwards id, className and other div props", () => {
    const status = statusOf(render(<Status id="save-status" className="mt-2" data-testid="x">Saved</Status>))

    expect(status.id).toBe("save-status")
    expect(status.className).toContain("mt-2")
    expect(status.getAttribute("data-testid")).toBe("x")
  })

  test("forwards a ref to the live-region div", () => {
    const ref = createRef<HTMLDivElement>()
    const container = render(<Status ref={ref}>Saved</Status>)

    expect(ref.current).toBe(statusOf(container))
  })

  test("renders exactly one live region and no nested live semantics", () => {
    for (const variant of ["default", "error"] as const) {
      const container = render(<Status variant={variant}>Message</Status>)
      expect(container.querySelectorAll(LIVE)).toHaveLength(1)
    }
  })

  test("stays mounted as an empty live region so text can be announced when it arrives", () => {
    const container = render(<Status />)
    const status = statusOf(container)

    expect(status).not.toBeNull()
    expect(status.getAttribute("role")).toBe("status")
    expect(status.textContent).toBe("")
  })
})

describe("Status visibility", () => {
  test("visible Status has no visually-hidden styling and stays readable", () => {
    const container = render(<Status>Saved</Status>)
    const status = statusOf(container)

    expect(status.classList.contains("sr-only")).toBe(false)
    expect(status.hasAttribute("hidden")).toBe(false)
    expect(status.getAttribute("aria-hidden")).toBeNull()
    expect(within(container).getByRole("status").textContent).toBe("Saved")
  })

  test("visuallyHidden reuses the governed sr-only utility on the live region itself", () => {
    const container = render(<Status visuallyHidden>Saved</Status>)
    const status = statusOf(container)

    expect(status.classList.contains("sr-only")).toBe(true)
    expect(container.querySelectorAll(LIVE)).toHaveLength(1)
    expect(status.matches(LIVE)).toBe(true)
  })

  test("visuallyHidden stays in the accessibility tree", () => {
    const container = render(<Status visuallyHidden>Saved</Status>)
    const status = statusOf(container)

    expect(status.hasAttribute("hidden")).toBe(false)
    expect(status.getAttribute("aria-hidden")).toBeNull()
    expect(status.style.display).toBe("")
    expect(within(container).getByRole("status").textContent).toBe("Saved")
  })

  test("visuallyHidden works for error Status and keeps assertive semantics", () => {
    const container = render(<Status variant="error" visuallyHidden>Login failed</Status>)

    expect(within(container).getByRole("alert").classList.contains("sr-only")).toBe(true)
    expect(statusOf(container).getAttribute("aria-live")).toBe("assertive")
  })

  test("visuallyHidden does not leak onto the DOM as an unknown attribute", () => {
    const status = statusOf(render(<Status visuallyHidden>Saved</Status>))

    expect(status.hasAttribute("visuallyhidden")).toBe(false)
    expect(status.hasAttribute("visuallyHidden")).toBe(false)
  })
})

describe("Status dynamic updates", () => {
  const mount = () => {
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    const show = (node: React.ReactNode) => act(() => root.render(node))
    return { container, show, unmount: () => act(() => root.unmount()) }
  }

  test("changing the children updates the same live-region element in place", () => {
    const { container, show, unmount } = mount()
    show(<Status>Saving…</Status>)
    const before = statusOf(container)
    const mutations: string[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records) mutations.push(record.type)
    })
    observer.observe(before, { childList: true, characterData: true, subtree: true })

    show(<Status>Saved</Status>)

    expect(statusOf(container)).toBe(before)
    expect(before.textContent).toBe("Saved")
    expect(before.getAttribute("role")).toBe("status")
    return Promise.resolve().then(() => {
      expect(mutations.length).toBeGreaterThan(0)
      observer.disconnect()
      unmount()
      container.remove()
    })
  })

  test("changing variant on a mounted Status flips role and aria-live on the same element (announcement of that flip is not guaranteed)", () => {
    const { container, show, unmount } = mount()
    show(<Status>Logging in…</Status>)
    expect(container.querySelectorAll(LIVE)).toHaveLength(1)

    show(<Status variant="error">Login failed</Status>)

    expect(container.querySelectorAll(LIVE)).toHaveLength(1)
    expect(statusOf(container).getAttribute("role")).toBe("alert")
    expect(statusOf(container).getAttribute("aria-live")).toBe("assertive")
    expect(statusOf(container).textContent).toBe("Login failed")
    unmount()
    container.remove()
  })

  test("rerendering identical text produces no DOM change, so a re-announcement is not guaranteed", () => {
    const { container, show, unmount } = mount()
    show(<Status>Saved</Status>)
    const status = statusOf(container)
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) => mutations.push(...records))
    observer.observe(status, { childList: true, characterData: true, subtree: true, attributes: true })

    show(<Status>Saved</Status>)

    return Promise.resolve().then(() => {
      expect(mutations).toHaveLength(0)
      observer.disconnect()
      unmount()
      container.remove()
    })
  })
})

describe("Status coexistence with existing components", () => {
  test("a mounted empty polite Status and a sibling error Status are two flat, non-nested live regions", () => {
    const container = render(
      <div>
        <Status />
        <Status variant="error" />
      </div>
    )
    const regions = [...container.querySelectorAll(LIVE)]

    expect(regions).toHaveLength(2)
    expect(regions.map((region) => region.getAttribute("role"))).toEqual(["status", "alert"])
    expect(regions.some((region) => region.querySelector(LIVE))).toBe(false)
  })

  test("Status inside a form with a loading Button yields one live region, from Status only", () => {
    const container = render(
      <form>
        <Button type="submit" loading>Log in</Button>
        <Status>Logging in…</Status>
      </form>
    )

    expect(container.querySelectorAll(LIVE)).toHaveLength(1)
    expect(statusOf(container).textContent).toBe("Logging in…")
    expect(container.querySelector("button")!.getAttribute("aria-busy")).toBe("true")
  })

  test("a decorative Spinner inside Status must drop its own status role to avoid a nested live region", () => {
    const container = render(
      <Status>
        <Spinner aria-hidden="true" role={undefined} aria-label={undefined} />
        Saving…
      </Status>
    )

    expect(container.querySelectorAll("[role='status']")).toHaveLength(1)
    expect(statusOf(container).textContent).toBe("Saving…")
  })

  test("Alert still renders its own always-assertive role and is not affected by Status", () => {
    const container = render(
      <Alert variant="destructive"><AlertDescription>Review and retry</AlertDescription></Alert>
    )
    const alert = container.querySelector("[data-slot='alert']")!

    expect(alert.getAttribute("role")).toBe("alert")
    expect(alert.hasAttribute("aria-live")).toBe(false)
    expect(container.querySelector("[data-slot='status']")).toBeNull()
  })

  test("FieldError still renders role=alert only when it has content", () => {
    expect(render(<FieldError>Required</FieldError>).querySelector("[data-slot='field-error']")!.getAttribute("role")).toBe("alert")
    expect(render(<FieldError />).querySelector("[data-slot='field-error']")).toBeNull()
  })

  test("Spinner still renders role=status and aria-label=Loading by default", () => {
    const spinner = render(<Spinner />).querySelector("[data-slot='spinner']")!

    expect(spinner.getAttribute("role")).toBe("status")
    expect(spinner.getAttribute("aria-label")).toBe("Loading")
  })

  test("Button loading still adds no live region on its own", () => {
    const container = render(<Button loading>Log in</Button>)

    expect(container.querySelectorAll(LIVE)).toHaveLength(0)
  })
})
