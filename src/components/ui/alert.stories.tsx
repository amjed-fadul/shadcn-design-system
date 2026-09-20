import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
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
      options: ["default", "destructive"],
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

export const WithAction: Story = {
  render: () => (
    <Alert className="pe-28">
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
      <Alert className="pe-28">
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
