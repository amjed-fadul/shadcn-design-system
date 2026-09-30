// @vitest-environment jsdom

import type * as React from "react"
import { act, createRef } from "react"
import { within } from "storybook/test"
import { describe, expect, test, vi } from "vitest"

import { Status } from "../src/components/ui/alert"
import { Button } from "../src/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Form,
} from "../src/components/ui/field"
import { Input } from "../src/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../src/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select"
import * as pkg from "../src/package/index"
import { render } from "./studio-test-utils"

const LIVE = "[role='status'], [role='alert'], [role='log'], [aria-live]"
const formOf = (container: HTMLElement) => container.querySelector<HTMLFormElement>("form")!
const click = (element: Element) => act(async () => { (element as HTMLElement).click() })
const handler = () => vi.fn((event: { preventDefault: () => void }) => event.preventDefault())

// jsdom does not implement Enter-key implicit submission or real navigation;
// those are covered with trusted key events in tests/form-native.browser.mjs and
// in the Form stories that run in Chromium.

describe("Form renders a native form", () => {
  test("renders exactly a <form> with data-slot and no invented role", () => {
    const container = render(<Form aria-label="Log in"><Input aria-label="Name" /></Form>)
    const form = formOf(container)

    expect(form.tagName).toBe("FORM")
    expect(form.getAttribute("data-slot")).toBe("form")
    expect(form.hasAttribute("role")).toBe(false)
    expect(container.querySelectorAll("form")).toHaveLength(1)
    expect(container.querySelectorAll("[role='form']")).toHaveLength(0)
  })

  test("a named Form is exposed as a single form landmark; an unnamed Form is not", () => {
    const named = render(<Form aria-label="Log in" />)
    expect(within(named).getAllByRole("form", { name: "Log in" })).toHaveLength(1)

    const unnamed = render(<Form />)
    expect(within(unnamed).queryAllByRole("form")).toHaveLength(0)
  })

  test("forwards standard form props without renaming them", () => {
    const onSubmit = handler()
    const container = render(
      <Form
        id="login"
        className="mt-2"
        action="/session"
        method="post"
        noValidate
        autoComplete="off"
        encType="multipart/form-data"
        target="_blank"
        name="login-form"
        data-testid="x"
        onSubmit={onSubmit}
      />
    )
    const form = formOf(container)

    expect(form.id).toBe("login")
    expect(form.className).toBe("mt-2")
    expect(form.getAttribute("action")).toBe("/session")
    expect(form.getAttribute("method")).toBe("post")
    expect(form.noValidate).toBe(true)
    expect(form.getAttribute("novalidate")).toBe("")
    expect(form.getAttribute("autocomplete")).toBe("off")
    expect(form.getAttribute("enctype")).toBe("multipart/form-data")
    expect(form.getAttribute("target")).toBe("_blank")
    expect(form.getAttribute("name")).toBe("login-form")
    expect(form.getAttribute("data-testid")).toBe("x")
  })

  test("forwards a ref to the native form for imperative form APIs", () => {
    const ref = createRef<HTMLFormElement>()
    const container = render(<Form ref={ref}><Input required /></Form>)

    expect(ref.current).toBe(formOf(container))
    expect(ref.current?.checkValidity()).toBe(false)
    expect(typeof ref.current?.requestSubmit).toBe("function")
    expect(typeof ref.current?.reset).toBe("function")
  })

  test("does not validate-disable or otherwise alter native behavior by default", () => {
    const form = formOf(render(<Form />))

    expect(form.noValidate).toBe(false)
    expect(form.hasAttribute("action")).toBe(false)
    expect(form.hasAttribute("method")).toBe(false)
    expect(form.hasAttribute("autocomplete")).toBe(false)
  })

  test("is exported from the package entry point", () => {
    expect(pkg.Form).toBe(Form)
  })
})

describe("Form submit behavior", () => {
  test("a Button type=submit submits the surrounding Form and onSubmit fires once", async () => {
    let target: EventTarget | null = null
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      target = event.currentTarget
    })
    const container = render(
      <Form onSubmit={onSubmit}>
        <Input aria-label="Name" name="name" defaultValue="Ada" />
        <Button type="submit">Log in</Button>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Log in" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: "submit" })
    expect(target).toBe(formOf(container))
  })

  test("the submit Button keeps its accessible name and native type", () => {
    const container = render(
      <Form>
        <Button type="submit">Log in</Button>
      </Form>
    )
    const submit = within(container).getByRole("button", { name: "Log in" })

    expect(submit.getAttribute("type")).toBe("submit")
    expect(submit.closest("form")).toBe(formOf(container))
  })

  test("submitted data reflects named controls", async () => {
    let data: Record<string, FormDataEntryValue> = {}
    const container = render(
      <Form
        onSubmit={(event) => {
          event.preventDefault()
          data = Object.fromEntries(new FormData(event.currentTarget).entries())
        }}
      >
        <Input aria-label="Username" name="username" defaultValue="ada" />
        <Button type="submit">Log in</Button>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Log in" }))

    expect(data).toEqual({ username: "ada" })
  })

  test("a Button outside the Form does not submit it", async () => {
    const onSubmit = handler()
    const container = render(
      <>
        <Form onSubmit={onSubmit} />
        <Button type="submit">Elsewhere</Button>
      </>
    )

    await click(within(container).getByRole("button", { name: "Elsewhere" }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("an untyped native Button submits, so non-submit actions need type=button", async () => {
    const onSubmit = handler()
    const container = render(
      <Form onSubmit={onSubmit}>
        <Button>Untyped</Button>
        <Button type="button">Cancel</Button>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Cancel" }))
    expect(onSubmit).not.toHaveBeenCalled()

    await click(within(container).getByRole("button", { name: "Untyped" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe("Form native validation", () => {
  test("required participates in constraint validation and blocks submit", async () => {
    const onSubmit = handler()
    const container = render(
      <Form onSubmit={onSubmit}>
        <Input aria-label="Email" name="email" type="email" required />
        <Button type="submit">Send</Button>
      </Form>
    )
    const form = formOf(container)
    const email = within(container).getByLabelText("Email") as HTMLInputElement

    expect(form.checkValidity()).toBe(false)
    expect(email.validity.valueMissing).toBe(true)

    await click(within(container).getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setValue.call(email, "not-an-email")
    })
    expect(email.validity.typeMismatch).toBe(true)
    await click(within(container).getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(email, "ada@example.com")
    })
    expect(form.checkValidity()).toBe(true)
    await click(within(container).getByRole("button", { name: "Send" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test("noValidate lets an invalid form submit while the constraint still reports invalid", async () => {
    const onSubmit = handler()
    const container = render(
      <Form noValidate onSubmit={onSubmit}>
        <Input aria-label="Email" type="email" required />
        <Button type="submit">Send</Button>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Send" }))

    expect(formOf(container).noValidate).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect((within(container).getByLabelText("Email") as HTMLInputElement).validity.valueMissing).toBe(true)
  })

  test("Form adds no validation state, error focus or live announcements of its own", async () => {
    const container = render(
      <Form>
        <Input aria-label="Email" type="email" required />
        <Button type="submit">Send</Button>
      </Form>
    )
    const email = within(container).getByLabelText("Email")

    await click(within(container).getByRole("button", { name: "Send" }))

    expect(email.getAttribute("aria-invalid")).toBeNull()
    expect(container.querySelectorAll(LIVE)).toHaveLength(0)
    expect(formOf(container).getAttribute("aria-live")).toBeNull()
  })
})

describe("Form composition", () => {
  const Login = ({ onSubmit }: { onSubmit: (event: { preventDefault: () => void }) => void }) => {
    return (
      <Form aria-label="Log in" onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="user">Username</FieldLabel>
            <Input id="user" name="username" required />
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="pass">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pass"
                name="password"
                type="password"
                required
                aria-invalid="true"
                aria-describedby="pass-help pass-error"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Show password">Show</InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id="pass-help">At least 12 characters.</FieldDescription>
            <FieldError id="pass-error">Too short.</FieldError>
          </Field>
          <Button type="submit">Log in</Button>
        </FieldGroup>
        <Status>Ready</Status>
      </Form>
    )
  }

  test("InputGroupButton defaults to type=button and never submits the Form", async () => {
    const onSubmit = handler()
    const container = render(<Login onSubmit={onSubmit} />)
    const toggle = within(container).getByRole("button", { name: "Show password" })

    expect(toggle.getAttribute("type")).toBe("button")
    await click(toggle)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test("an InputGroupButton explicitly typed submit still submits (author opt-in)", async () => {
    const onSubmit = handler()
    const container = render(
      <Form onSubmit={onSubmit}>
        <InputGroup>
          <InputGroupInput aria-label="Search" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" aria-label="Search now">Go</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Search now" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test("Field label, description and error relationships are intact inside a Form", () => {
    const container = render(<Login onSubmit={handler()} />)
    const username = within(container).getByLabelText("Username")
    const password = within(container).getByLabelText("Password", { selector: "input" })

    expect(username.tagName).toBe("INPUT")
    expect(password.getAttribute("aria-invalid")).toBe("true")
    expect(password.getAttribute("aria-describedby")).toBe("pass-help pass-error")
    expect(container.querySelector("#pass-help")!.textContent).toBe("At least 12 characters.")
    expect(container.querySelector("#pass-error")!.textContent).toBe("Too short.")
    expect(within(container).getByRole("form", { name: "Log in" })).toBe(formOf(container))
  })

  test("InputGroup password control is a named form control that belongs to the Form", () => {
    const container = render(<Login onSubmit={handler()} />)
    const password = container.querySelector<HTMLInputElement>("#pass")!

    expect(password.form).toBe(formOf(container))
    expect(password.name).toBe("password")
    expect(formOf(container).elements.namedItem("password")).toBe(password)
  })

  test("Status is a sibling live region inside the Form and is not nested or duplicated", () => {
    const container = render(<Login onSubmit={handler()} />)
    const live = container.querySelectorAll(LIVE)
    const status = container.querySelector("[data-slot='status']")!

    // FieldError renders role=alert; Status is the only other live region and they never nest.
    expect(live).toHaveLength(2)
    expect(status.getAttribute("role")).toBe("status")
    expect(status.parentElement).toBe(formOf(container))
    expect(status.querySelector(LIVE)).toBeNull()
    expect(status.closest("[role='alert']")).toBeNull()
    expect(formOf(container).matches(LIVE)).toBe(false)
  })

  test("no duplicate form roles are introduced by Field, InputGroup, Select or Status", () => {
    const container = render(<Login onSubmit={handler()} />)

    expect(container.querySelectorAll("form")).toHaveLength(1)
    expect(container.querySelectorAll("[role='form']")).toHaveLength(0)
    expect(within(container).getAllByRole("form")).toHaveLength(1)
  })

  test("Select participates in the Form data through its name", async () => {
    let data: Record<string, FormDataEntryValue> = {}
    const container = render(
      <Form
        onSubmit={(event) => {
          event.preventDefault()
          data = Object.fromEntries(new FormData(event.currentTarget).entries())
        }}
      >
        <Field>
          <FieldLabel htmlFor="plan">Plan</FieldLabel>
          <Select name="plan" defaultValue="team">
            <SelectTrigger id="plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="team">Team</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button type="submit">Save</Button>
      </Form>
    )
    const trigger = within(container).getByRole("combobox", { name: "Plan" })

    expect(trigger.closest("form")).toBe(formOf(container))
    expect(trigger.getAttribute("id")).toBe("plan")
    await click(within(container).getByRole("button", { name: "Save" }))

    expect(data).toEqual({ plan: "team" })
  })

  test("Select without a name is not part of the submitted data", async () => {
    let data: Record<string, FormDataEntryValue> = { unset: "x" }
    const container = render(
      <Form
        onSubmit={(event) => {
          event.preventDefault()
          data = Object.fromEntries(new FormData(event.currentTarget).entries())
        }}
      >
        <Select defaultValue="team">
          <SelectTrigger aria-label="Plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Team</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">Save</Button>
      </Form>
    )

    await click(within(container).getByRole("button", { name: "Save" }))

    expect(data).toEqual({})
  })
})
