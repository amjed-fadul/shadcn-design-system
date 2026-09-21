import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const meta = {
  title: "Components/Switch",
  component: Switch,
  args: {
    defaultChecked: true,
    size: "default",
    disabled: false,
    required: false,
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default"],
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["size", "disabled", "required"],
    },
  },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch {...args} id="notifications" name="notifications" />
      <Label htmlFor="notifications">Notifications</Label>
    </div>
  ),
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Switch id="switch-off" />
        <Label htmlFor="switch-off">Off</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="switch-on" defaultChecked />
        <Label htmlFor="switch-on">On</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="switch-disabled" disabled />
        <Label htmlFor="switch-disabled">Disabled</Label>
      </div>
    </div>
  ),
}

export const Invalid: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="switch-invalid" aria-invalid />
      <Label htmlFor="switch-invalid">Required setting</Label>
    </div>
  ),
}

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <Switch id="switch-small" size="sm" defaultChecked />
        <Label htmlFor="switch-small">Small</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="switch-default" defaultChecked />
        <Label htmlFor="switch-default">Default</Label>
      </div>
    </div>
  ),
}

function ControlledSwitchStory() {
  const [checked, setChecked] = React.useState(false)

  return (
    <div className="flex items-center gap-3">
      <Switch
        id="switch-controlled"
        checked={checked}
        onCheckedChange={setChecked}
      />
      <Label htmlFor="switch-controlled">
        {checked ? "Enabled" : "Disabled"}
      </Label>
    </div>
  )
}

export const Controlled: Story = {
  render: () => <ControlledSwitchStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl" className="grid gap-4">
      <div className="flex items-center gap-3">
        <Switch id="switch-rtl-on" defaultChecked />
        <Label htmlFor="switch-rtl-on">الإشعارات مفعلة</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="switch-rtl-off" />
        <Label htmlFor="switch-rtl-off">الإشعارات متوقفة</Label>
      </div>
    </div>
  ),
}
