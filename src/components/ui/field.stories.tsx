import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Eye, EyeOff } from "lucide-react"
import { expect, userEvent, within, waitFor } from "storybook/test"

import { Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Form,
} from "@/components/ui/field"

const meta = {
  title: "Components/Field",
  component: Field,
  args: {
    orientation: "vertical",
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
  parameters: {
    controls: {
      include: ["orientation"],
    },
  },
  render: (args) => (
    <Field {...args}>
      <FieldLabel htmlFor="field-email">Email</FieldLabel>
      <Input id="field-email" type="email" placeholder="name@example.com" />
      <FieldDescription>We’ll only use this for account updates.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Fieldset: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>Profile</FieldLegend>
      <FieldDescription>This information appears in your account.</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
          <Input id="profile-name" />
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="profile-username">Username</FieldLabel>
          <Input id="profile-username" aria-invalid />
          <FieldError>Choose another username.</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
}

export const HorizontalSwitch: Story = {
  render: () => (
    <Field orientation="horizontal">
      <Switch id="newsletter" />
      <FieldContent>
        <FieldLabel htmlFor="newsletter">Newsletter</FieldLabel>
        <FieldDescription>Receive product news by email.</FieldDescription>
      </FieldContent>
    </Field>
  ),
}

export const RadioChoices: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend variant="label">Plan</FieldLegend>
      <RadioGroup defaultValue="monthly" name="field-plan">
        <Field orientation="horizontal">
          <RadioGroupItem value="monthly" id="field-monthly" />
          <FieldLabel htmlFor="field-monthly">Monthly</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="yearly" id="field-yearly" />
          <FieldLabel htmlFor="field-yearly">Yearly</FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  ),
}

export const WithSeparatorAndSlider: Story = {
  render: () => (
    <FieldGroup>
      <Field>
        <FieldTitle>Volume</FieldTitle>
        <Slider defaultValue={[40]} thumbAriaLabels={["Volume"]} />
      </Field>
      <FieldSeparator>Advanced</FieldSeparator>
      <Field>
        <FieldTitle>Notifications</FieldTitle>
        <FieldDescription>Configure this later in settings.</FieldDescription>
      </Field>
    </FieldGroup>
  ),
}

export const MultipleErrors: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="field-password">Password</FieldLabel>
      <Input id="field-password" type="password" aria-invalid />
      <FieldError
        errors={[
          { message: "Use at least 12 characters." },
          { message: "Add at least one number." },
          { message: "Use at least 12 characters." },
        ]}
      />
    </Field>
  ),
}

function PlanSelect({
  id,
  required,
  disabled,
  ...triggerProps
}: Pick<React.ComponentProps<typeof SelectTrigger>, "id" | "aria-invalid" | "aria-describedby"> & {
  required?: boolean
  disabled?: boolean
}) {
  return (
    <Select required={required} disabled={disabled}>
      <SelectTrigger id={id} {...triggerProps}>
        <SelectValue placeholder="Choose a plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="starter">Starter</SelectItem>
        <SelectItem value="team">Team</SelectItem>
        <SelectItem value="enterprise">Enterprise</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const WithSelect: Story = {
  render: () => (
    <Field>
      <FieldLabel htmlFor="field-select-plan">Plan</FieldLabel>
      <PlanSelect id="field-select-plan" required />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("combobox", { name: "Plan" })
    await expect(trigger).toHaveAttribute("aria-required", "true")

    // The label resolves to the trigger and Radix keyboard behavior is intact.
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}")
    const option = await within(document.body).findByRole("option", { name: "Team" })
    await waitFor(() => expect(option).toBeVisible())
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(trigger).toHaveTextContent("Team")
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const WithSelectAndDescription: Story = {
  render: () => (
    <Field>
      <FieldLabel htmlFor="field-select-billing">Billing plan</FieldLabel>
      <PlanSelect id="field-select-billing" aria-describedby="field-select-billing-description" />
      <FieldDescription id="field-select-billing-description">
        You can change plans at any time.
      </FieldDescription>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", { name: "Billing plan" })
    await expect(trigger).toHaveAccessibleDescription("You can change plans at any time.")
  },
}

export const WithSelectInvalid: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="field-select-invalid">Plan</FieldLabel>
      <PlanSelect
        id="field-select-invalid"
        aria-invalid
        aria-describedby="field-select-invalid-description field-select-invalid-error"
      />
      <FieldDescription id="field-select-invalid-description">
        Required to continue.
      </FieldDescription>
      <FieldError id="field-select-invalid-error">Choose a plan.</FieldError>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", { name: "Plan" })
    await expect(trigger).toHaveAttribute("aria-invalid", "true")
    await expect(trigger).toHaveAccessibleDescription("Required to continue. Choose a plan.")
  },
}

export const WithSelectDisabled: Story = {
  render: () => (
    <Field data-disabled="true">
      <FieldLabel htmlFor="field-select-disabled">Plan</FieldLabel>
      <PlanSelect id="field-select-disabled" disabled />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox", { name: "Plan" })).toBeDisabled()
  },
}

export const WithInputGroup: Story = {
  render: () => (
    <Field>
      <FieldLabel htmlFor="field-group-website">Website</FieldLabel>
      <InputGroup>
        <InputGroupAddon align="inline-start">https://</InputGroupAddon>
        <InputGroupInput
          id="field-group-website"
          placeholder="example.com"
          aria-describedby="field-group-website-description"
        />
      </InputGroup>
      <FieldDescription id="field-group-website-description">
        Shown on your public profile.
      </FieldDescription>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Website")
    await expect(input).toHaveAccessibleDescription("Shown on your public profile.")
  },
}

function PasswordField({ invalid = false }: { invalid?: boolean }) {
  const [visible, setVisible] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(0)
  const describedBy = invalid
    ? "field-password-description field-password-error"
    : "field-password-description"

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted((count) => count + 1)
      }}
    >
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="field-password-input">Password</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="field-password-input"
            type={visible ? "text" : "password"}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            defaultValue="hunter2hunter2"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id="field-password-description">
          Use at least 12 characters.
        </FieldDescription>
        {invalid ? (
          <FieldError id="field-password-error">Add at least one number.</FieldError>
        ) : null}
      </Field>
      <span data-testid="submit-count" className="sr-only">{submitted}</span>
    </Form>
  )
}

export const PasswordWithToggle: Story = {
  render: () => <PasswordField />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText("Password")
    await expect(input).toHaveAttribute("type", "password")
    await expect(input).toHaveAccessibleDescription("Use at least 12 characters.")

    // The inline action is the next tab stop and does not submit the form.
    await userEvent.click(input)
    await userEvent.tab()
    const toggle = canvas.getByRole("button", { name: "Show password" })
    await expect(toggle).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("type", "text")
    await expect(canvas.getByRole("button", { name: "Hide password" })).toHaveFocus()
    await expect(canvas.getByTestId("submit-count")).toHaveTextContent("0")

    // Relationships survive the toggle.
    await expect(canvas.getByLabelText("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters."
    )
  },
}

export const PasswordWithToggleInvalid: Story = {
  render: () => <PasswordField invalid />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Password")
    await expect(input).toHaveAttribute("aria-invalid", "true")
    await expect(input).toHaveAccessibleDescription(
      "Use at least 12 characters. Add at least one number."
    )
  },
}

export const InputGroupDisabled: Story = {
  render: () => (
    <Field data-disabled="true">
      <FieldLabel htmlFor="field-group-disabled">Website</FieldLabel>
      <InputGroup>
        <InputGroupInput id="field-group-disabled" disabled defaultValue="example.com" />
      </InputGroup>
    </Field>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Website")).toBeDisabled()
  },
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <FieldSet>
        <FieldLegend>الملف الشخصي</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rtl-name">الاسم الكامل</FieldLabel>
            <Input id="rtl-name" />
            <FieldDescription>سيظهر هذا الاسم في حسابك.</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Switch id="rtl-updates" />
            <FieldLabel htmlFor="rtl-updates">تحديثات البريد الإلكتروني</FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
}

function BasicForm() {
  const [submitted, setSubmitted] = React.useState("")

  return (
    <Form
      aria-label="Newsletter"
      onSubmit={(event) => {
        // Caller-owned: the app decides what submitting does.
        event.preventDefault()
        setSubmitted(String(new FormData(event.currentTarget).get("email")))
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="form-basic-email">Email</FieldLabel>
          <Input id="form-basic-email" name="email" type="email" autoComplete="email" />
        </Field>
        <Button type="submit">Subscribe</Button>
      </FieldGroup>
      <Status visuallyHidden data-testid="form-result">{submitted && `Subscribed ${submitted}`}</Status>
    </Form>
  )
}

export const FormBasic: Story = {
  parameters: { controls: { disable: true } },
  render: () => <BasicForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const form = canvas.getByRole("form", { name: "Newsletter" })
    await expect(form.tagName).toBe("FORM")

    await userEvent.type(canvas.getByLabelText("Email"), "ada@example.com")
    await userEvent.click(canvas.getByRole("button", { name: "Subscribe" }))
    await expect(canvas.getByTestId("form-result")).toHaveTextContent("Subscribed ada@example.com")
  },
}

function LoginForm() {
  const [visible, setVisible] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(0)
  const [lastUser, setLastUser] = React.useState("")

  return (
    <Form
      aria-label="Log in"
      onSubmit={(event) => {
        event.preventDefault()
        setLastUser(String(new FormData(event.currentTarget).get("username")))
        setSubmitted((count) => count + 1)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="form-login-username">Username or email</FieldLabel>
          <Input id="form-login-username" name="username" autoComplete="username" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="form-login-password">Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="form-login-password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Button type="submit">Log in</Button>
      </FieldGroup>
      <Status visuallyHidden data-testid="login-result">
        {submitted > 0 && `Login submitted ${submitted}: ${lastUser}`}
      </Status>
    </Form>
  )
}

export const FormLogin: Story = {
  parameters: { controls: { disable: true } },
  render: () => <LoginForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const result = canvas.getByTestId("login-result")

    await userEvent.type(canvas.getByLabelText("Username or email"), "ada")
    await userEvent.type(canvas.getByLabelText("Password"), "correct horse")

    // The inline Show/Hide action is a type="button" and does not submit.
    await userEvent.click(canvas.getByRole("button", { name: "Show password" }))
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("type", "text")
    await expect(result).toHaveTextContent("")

    // The submit Button and Enter in a form control both submit. Enter here is
    // user-event's emulation; native Enter is proven by `npm run test:form-native`.
    await userEvent.click(canvas.getByLabelText("Password"))
    await userEvent.keyboard("{Enter}")
    await expect(result).toHaveTextContent("Login submitted 1: ada")
    await userEvent.click(canvas.getByRole("button", { name: "Log in" }))
    await expect(result).toHaveTextContent("Login submitted 2: ada")
  },
}

function RequiredForm() {
  const [submitted, setSubmitted] = React.useState(0)

  return (
    <Form
      aria-label="Invite teammate"
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted((count) => count + 1)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="form-required-email">Teammate email</FieldLabel>
          <Input id="form-required-email" name="email" type="email" required />
          <FieldDescription>The browser blocks submit until this is a valid email.</FieldDescription>
        </Field>
        <Button type="submit">Send invite</Button>
      </FieldGroup>
      <Status visuallyHidden data-testid="required-result">{submitted > 0 && `Invites sent: ${submitted}`}</Status>
    </Form>
  )
}

export const FormRequiredValidation: Story = {
  parameters: { controls: { disable: true } },
  render: () => <RequiredForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByLabelText("Teammate email") as HTMLInputElement
    const result = canvas.getByTestId("required-result")

    // Native constraint validation blocks onSubmit while the field is invalid.
    await userEvent.click(canvas.getByRole("button", { name: "Send invite" }))
    await expect(email.validity.valueMissing).toBe(true)
    await expect(result).toHaveTextContent("")

    await userEvent.type(email, "not-an-email")
    await userEvent.click(canvas.getByRole("button", { name: "Send invite" }))
    await expect(email.validity.typeMismatch).toBe(true)
    await expect(result).toHaveTextContent("")

    await userEvent.clear(email)
    await userEvent.type(email, "ada@example.com")
    await userEvent.click(canvas.getByRole("button", { name: "Send invite" }))
    await expect(result).toHaveTextContent("Invites sent: 1")
  },
}

function StatusForm() {
  const [message, setMessage] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [plan, setPlan] = React.useState("")

  return (
    <Form
      aria-label="Profile"
      onSubmit={(event) => {
        event.preventDefault()
        setPlan(String(new FormData(event.currentTarget).get("plan")))
        setSaving(true)
        setMessage("Saving…")
        // Caller-owned async work: Form neither starts nor tracks it.
        window.setTimeout(() => {
          setSaving(false)
          setMessage("Saved")
        }, 100)
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="form-status-name">Display name</FieldLabel>
          <Input id="form-status-name" name="name" autoComplete="name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="form-status-plan">Plan</FieldLabel>
          <Select name="plan" defaultValue="team">
            <SelectTrigger id="form-status-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="team">Team</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button type="submit" loading={saving}>Save</Button>
        <Status>{message}</Status>
      </FieldGroup>
      <span data-testid="submitted-plan" className="sr-only">{plan}</span>
    </Form>
  )
}

export const FormWithStatus: Story = {
  parameters: { controls: { disable: true } },
  render: () => <StatusForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText("Display name"), "Ada")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(canvas.getByRole("status")).toHaveTextContent("Saving…")
    await expect(await canvas.findByText("Saved")).toBeVisible()
    // Select participates in the form's data through its named native control.
    await expect(canvas.getByTestId("submitted-plan")).toHaveTextContent("team")
  },
}
