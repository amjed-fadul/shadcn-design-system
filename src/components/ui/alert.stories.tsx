import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import * as React from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Status,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const meta = {
  title: "Components/Alert",
  component: Alert,
  args: {
    variant: "default",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "success", "warning", "info"],
    },
  },
  parameters: {
    controls: {
      include: ["variant"],
    },
  },
  render: (args) => (
    <Alert {...args}>
      <Info />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        This is an inline message that stays visible until the page changes.
      </AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
  render: (args) => (
    <Alert {...args}>
      <AlertCircle />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        Review the entered information and try again.
      </AlertDescription>
    </Alert>
  ),
}

export const StatusVariants: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="grid gap-3">
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Payment received</AlertTitle>
        <AlertDescription>Invoice INV-2041 was paid in full.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertCircle />
        <AlertTitle>Card expires soon</AlertTitle>
        <AlertDescription>Update the payment method before 31 October.</AlertDescription>
      </Alert>
      <Alert variant="info">
        <Info />
        <AlertTitle>Scheduled maintenance</AlertTitle>
        <AlertDescription>Reports may be delayed on Sunday from 02:00 to 03:00 UTC.</AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const variant of ["success", "warning", "info"]) {
      const alert = canvasElement.querySelector(`[data-slot="alert"].text-${variant}`)
      await expect(alert).not.toBeNull()
      await expect(alert).toHaveAttribute("role", "alert")
    }
  },
}

export const WithAction: Story = {
  render: () => (
    <Alert>
      <CheckCircle2 />
      <AlertTitle>Changes saved</AlertTitle>
      <AlertDescription>Your settings are now up to date.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline">
          View
        </Button>
      </AlertAction>
    </Alert>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Alert>
        <Info />
        <AlertTitle>تم حفظ التغييرات</AlertTitle>
        <AlertDescription>تم تحديث إعداداتك بنجاح.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline">
            عرض
          </Button>
        </AlertAction>
      </Alert>
    </div>
  ),
}

export const StatusPolite: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => <Status>Saving…</Status>,
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status")

    await expect(status).toHaveTextContent("Saving…")
    await expect(status).toHaveAttribute("aria-live", "polite")
    await expect(status).toBeVisible()
    await expect(canvasElement.querySelectorAll("[role='status'], [role='alert'], [aria-live]")).toHaveLength(1)
  },
}

export const StatusVisuallyHidden: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex items-center gap-3">
      <Button>Save</Button>
      <Status visuallyHidden>Saved</Status>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status")
    const box = status.getBoundingClientRect()

    await expect(status).toHaveTextContent("Saved")
    await expect(status).toHaveAttribute("aria-live", "polite")
    await expect(status).not.toHaveAttribute("aria-hidden")
    await expect(box.width).toBeLessThanOrEqual(1)
    await expect(box.height).toBeLessThanOrEqual(1)
    await expect(getComputedStyle(status).display).not.toBe("none")
    await expect(getComputedStyle(status).visibility).not.toBe("hidden")
  },
}

export const StatusError: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => <Status variant="error">Login failed</Status>,
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("alert")

    await expect(status).toHaveTextContent("Login failed")
    await expect(status).toHaveAttribute("aria-live", "assertive")
    await expect(status).toBeVisible()
    await expect(canvasElement.querySelectorAll("[role='status'], [role='alert'], [aria-live]")).toHaveLength(1)
  },
}

function StatusDynamicExample() {
  const [progress, setProgress] = React.useState("")
  const [failure, setFailure] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const run = (outcome: "success" | "error") => {
    setBusy(true)
    setFailure("")
    setProgress("Saving…")
    window.setTimeout(() => {
      setBusy(false)
      if (outcome === "error") {
        setProgress("")
        setFailure("Save failed")
      } else {
        setProgress("Saved")
      }
    }, 50)
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex gap-2">
        <Button loading={busy} onClick={() => run("success")}>
          Save
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("error")}>
          Save with error
        </Button>
      </div>
      <div>
        <Status>{progress}</Status>
        <Status variant="error">{failure}</Status>
      </div>
    </div>
  )
}

export const StatusDynamicUpdate: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => <StatusDynamicExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const polite = canvasElement.querySelector("[data-slot='status'][data-variant='default']")!
    const urgent = canvasElement.querySelector("[data-slot='status'][data-variant='error']")!

    await expect(polite).toHaveAttribute("role", "status")
    await expect(urgent).toHaveAttribute("role", "alert")
    await expect(polite).toBeEmptyDOMElement()
    await expect(urgent).toBeEmptyDOMElement()

    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(polite).toHaveTextContent("Saving…")
    await waitFor(() => expect(polite).toHaveTextContent("Saved"))
    await expect(urgent).toBeEmptyDOMElement()
    await expect(canvasElement.querySelector("[data-slot='status'][data-variant='default']")).toBe(polite)

    await userEvent.click(canvas.getByRole("button", { name: "Save with error" }))
    await waitFor(() => expect(urgent).toHaveTextContent("Save failed"))
    await expect(polite).toBeEmptyDOMElement()
    await expect(urgent).toHaveAttribute("aria-live", "assertive")
    await expect(polite).toHaveAttribute("role", "status")
    await expect(canvasElement.querySelectorAll("[data-slot='status']")).toHaveLength(2)
  },
}
