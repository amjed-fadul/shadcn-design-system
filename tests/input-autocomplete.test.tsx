// @vitest-environment jsdom

import { describe, expect, test } from "vitest"

import { Input } from "../src/components/ui/input"
import { render } from "./studio-test-utils"

describe("Input autoComplete", () => {
  test.each([
    ["email", "email"],
    ["text", "username"],
    ["password", "current-password"],
    ["password", "new-password"],
    ["text", "one-time-code"],
    ["tel", "tel"],
    ["text", "postal-code"],
  ] as const)("forwards type=%s autoComplete=%s to the native input", (type, autoComplete) => {
    const container = render(<Input aria-label="Field" type={type} autoComplete={autoComplete} />)
    const input = container.querySelector("input")!

    expect(input.getAttribute("autocomplete")).toBe(autoComplete)
    expect(input.getAttribute("type")).toBe(type)
  })

  test("keeps section and multi-token autocomplete values intact", () => {
    const container = render(<Input aria-label="Field" autoComplete="section-billing shipping street-address" />)

    expect(container.querySelector("input")!.getAttribute("autocomplete")).toBe(
      "section-billing shipping street-address"
    )
  })

  test("omits the attribute when autoComplete is not authored and keeps existing behavior", () => {
    const container = render(
      <Input aria-label="Email" aria-invalid="true" disabled placeholder="you@example.com" type="email" className="extra" />
    )
    const input = container.querySelector("input")!

    expect(input.hasAttribute("autocomplete")).toBe(false)
    expect(input.getAttribute("data-slot")).toBe("input")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe("you@example.com")
    expect(input.className).toContain("extra")
  })
})
