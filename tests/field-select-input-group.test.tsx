// @vitest-environment jsdom

import { act, useState } from "react"
import { describe, expect, test } from "vitest"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../src/components/ui/field"
import { Input } from "../src/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../src/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select"
import { render } from "./studio-test-utils"

function describedBy(element: Element) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
}

function accessibleDescription(element: Element) {
  return describedBy(element).map((node) => node?.textContent).join(" ")
}

function labelFor(text: string) {
  return [...document.querySelectorAll<HTMLLabelElement>("label")].find((label) => label.textContent === text)
}

function press(element: Element, key: string) {
  return act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
  })
}

function SelectField(props: {
  invalid?: boolean
  required?: boolean
  disabled?: boolean
  described?: boolean
}) {
  const ids = [
    props.described ? "plan-description" : null,
    props.invalid ? "plan-error" : null,
  ].filter(Boolean)

  return (
    <Field data-invalid={props.invalid || undefined} data-disabled={props.disabled ? "true" : undefined}>
      <FieldLabel htmlFor="plan">Plan</FieldLabel>
      <Select required={props.required} disabled={props.disabled} name="plan">
        <SelectTrigger
          id="plan"
          aria-invalid={props.invalid || undefined}
          aria-describedby={ids.length ? ids.join(" ") : undefined}
        >
          <SelectValue placeholder="Choose a plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="team">Team</SelectItem>
        </SelectContent>
      </Select>
      {props.described ? <FieldDescription id="plan-description">Change any time.</FieldDescription> : null}
      {props.invalid ? <FieldError id="plan-error">Choose a plan.</FieldError> : null}
    </Field>
  )
}

describe("Field + Select", () => {
  test("FieldLabel resolves to the Select trigger, which is the named combobox", () => {
    const container = render(<SelectField />)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!

    expect(trigger.id).toBe("plan")
    expect(labelFor("Plan")!.control).toBe(trigger)
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1)
  })

  test("description and error ids resolve from the trigger's aria-describedby", () => {
    const container = render(<SelectField described invalid />)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!

    expect(describedBy(trigger).every(Boolean)).toBe(true)
    expect(accessibleDescription(trigger)).toBe("Change any time. Choose a plan.")
    expect(document.getElementById("plan-error")!.getAttribute("role")).toBe("alert")
  })

  test("invalid state is exposed on the trigger and drives the destructive treatment", () => {
    const container = render(<SelectField invalid />)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!

    expect(trigger.getAttribute("aria-invalid")).toBe("true")
    expect(container.querySelector('[data-slot="field"]')!.getAttribute("data-invalid")).toBe("true")
    expect(trigger.className).toContain("aria-invalid:border-destructive")
    expect(trigger.className).toContain("aria-invalid:ring-destructive/20")
  })

  test("a valid trigger does not claim to be invalid", () => {
    const container = render(<SelectField />)

    expect(container.querySelector('[role="combobox"]')!.hasAttribute("aria-invalid")).toBe(false)
  })

  test("required on Select is reflected by Radix as aria-required and a required native select, without a duplicate on the trigger", () => {
    const container = render(<form><SelectField required /></form>)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!
    const native = container.querySelector<HTMLSelectElement>("select")!

    expect(trigger.getAttribute("aria-required")).toBe("true")
    expect(native.required).toBe(true)
    expect(container.querySelector("form")!.checkValidity()).toBe(false)
  })

  test("disabled on Select disables the trigger and Field data-disabled dims the label", () => {
    const container = render(<SelectField disabled />)
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!

    expect(trigger.disabled).toBe(true)
    expect(trigger.hasAttribute("data-disabled")).toBe(true)
    expect(container.querySelector('[data-slot="field"]')!.getAttribute("data-disabled")).toBe("true")
    expect(labelFor("Plan")!.className).toContain("group-data-[disabled=true]/field:opacity-50")
  })

  test("keyboard behavior is intact: the trigger opens with ArrowDown and an option can be chosen", async () => {
    const container = render(<SelectField />)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!

    await act(async () => trigger.focus())
    expect(document.activeElement).toBe(trigger)
    await press(trigger, "ArrowDown")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const options = document.body.querySelectorAll<HTMLElement>('[role="option"]')
    expect(options).toHaveLength(2)

    await act(async () => options[1].click())
    expect(trigger.textContent).toContain("Team")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  test("activating the FieldLabel opens the associated Select", async () => {
    const container = render(<SelectField />)
    const trigger = container.querySelector<HTMLElement>('[role="combobox"]')!

    await act(async () => labelFor("Plan")!.click())

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })
})

function PasswordField(props: { invalid?: boolean; onSubmit?: () => void; buttonType?: "submit" }) {
  const [visible, setVisible] = useState(false)

  return (
    <form onSubmit={(event) => { event.preventDefault(); props.onSubmit?.() }}>
      <Field data-invalid={props.invalid || undefined}>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="password"
            type={visible ? "text" : "password"}
            aria-invalid={props.invalid || undefined}
            aria-describedby={props.invalid ? "password-description password-error" : "password-description"}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              type={props.buttonType}
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((value) => !value)}
            >
              *
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id="password-description">At least 12 characters.</FieldDescription>
        {props.invalid ? <FieldError id="password-error">Add a number.</FieldError> : null}
      </Field>
    </form>
  )
}

describe("Field + InputGroup", () => {
  test("InputGroup sits directly inside Field and FieldLabel resolves to the inner control", () => {
    const container = render(<PasswordField />)
    const field = container.querySelector('[data-slot="field"]')!
    const group = container.querySelector('[data-slot="input-group"]')!
    const input = container.querySelector<HTMLInputElement>("input")!

    expect(group.parentElement).toBe(field)
    expect(input.dataset.slot).toBe("input-group-control")
    expect(labelFor("Password")!.control).toBe(input)
  })

  test("description and error ids resolve from the control, not the group", () => {
    const container = render(<PasswordField invalid />)
    const input = container.querySelector<HTMLInputElement>("input")!
    const group = container.querySelector('[data-slot="input-group"]')!

    expect(accessibleDescription(input)).toBe("At least 12 characters. Add a number.")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(group.hasAttribute("aria-describedby")).toBe(false)
    expect(group.hasAttribute("aria-invalid")).toBe(false)
    expect(group.className).toContain("[aria-invalid=true]]:border-destructive")
  })

  test("the inline action is a named native button that follows the control in tab order", () => {
    const container = render(<PasswordField />)
    const focusable = [...container.querySelectorAll<HTMLElement>("input, button")]
    const button = container.querySelector<HTMLButtonElement>("button")!

    expect(focusable.map((element) => element.tagName)).toEqual(["INPUT", "BUTTON"])
    expect(button.getAttribute("aria-label")).toBe("Show password")
    expect(button.tabIndex).toBe(0)
    expect(button.disabled).toBe(false)
  })

  test("toggling the inline action keeps the label, description, and invalid relationships", async () => {
    const container = render(<PasswordField invalid />)
    const input = container.querySelector<HTMLInputElement>("input")!
    expect(input.type).toBe("password")

    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click())

    const after = container.querySelector<HTMLInputElement>("input")!
    expect(after).toBe(input)
    expect(after.type).toBe("text")
    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("Hide password")
    expect(labelFor("Password")!.control).toBe(after)
    expect(accessibleDescription(after)).toBe("At least 12 characters. Add a number.")
    expect(after.getAttribute("aria-invalid")).toBe("true")
  })

  test("the inline action does not submit the surrounding form by default", async () => {
    let submits = 0
    const container = render(<PasswordField onSubmit={() => { submits += 1 }} />)
    const button = container.querySelector<HTMLButtonElement>("button")!

    expect(button.type).toBe("button")
    await act(async () => button.click())

    expect(submits).toBe(0)
  })

  test("the inline action submits only when type=submit is explicitly configured", async () => {
    let submits = 0
    const container = render(<PasswordField buttonType="submit" onSubmit={() => { submits += 1 }} />)

    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click())

    expect(submits).toBe(1)
  })

  test("disabled control disables the group's input", () => {
    const container = render(
      <Field data-disabled="true">
        <FieldLabel htmlFor="site">Website</FieldLabel>
        <InputGroup><InputGroupInput id="site" disabled /></InputGroup>
      </Field>
    )

    expect(container.querySelector<HTMLInputElement>("#site")!.disabled).toBe(true)
  })
})

describe("existing Field + Input behavior", () => {
  test("Input keeps its label, description, and invalid relationships unchanged", () => {
    const container = render(
      <Field data-invalid>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" aria-invalid aria-describedby="email-error" />
        <FieldError id="email-error">Invalid email.</FieldError>
      </Field>
    )
    const input = container.querySelector<HTMLInputElement>("#email")!

    expect(labelFor("Email")!.control).toBe(input)
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(accessibleDescription(input)).toBe("Invalid email.")
  })
})
