import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bold, Italic } from "lucide-react"

import { Toggle } from "@/components/ui/toggle"

const meta = {
  title: "Components/Toggle",
  component: Toggle,
  args: {
    defaultPressed: false,
    variant: "default",
    size: "default",
    disabled: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    disabled: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["variant", "size", "disabled"],
    },
  },
  render: (args) => (
    <Toggle {...args} aria-label="Toggle bold">
      <Bold />
    </Toggle>
  ),
} satisfies Meta<typeof Toggle>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Outline: Story = {
  render: () => (
    <Toggle variant="outline" aria-label="Toggle italic">
      <Italic />
    </Toggle>
  ),
}

export const WithText: Story = {
  render: () => (
    <Toggle defaultPressed>
      <Bold data-icon="inline-start" />
      Bold
    </Toggle>
  ),
}

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex items-center gap-4">
      <Toggle size="sm" aria-label="Small bold toggle">
        <Bold />
      </Toggle>
      <Toggle aria-label="Default bold toggle">
        <Bold />
      </Toggle>
      <Toggle size="lg" aria-label="Large bold toggle">
        <Bold />
      </Toggle>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Toggle disabled aria-label="Disabled bold toggle">
      <Bold />
    </Toggle>
  ),
}

function ControlledToggleStory() {
  const [pressed, setPressed] = React.useState(false)

  return (
    <div className="flex items-center gap-3">
      <Toggle
        pressed={pressed}
        onPressedChange={setPressed}
        aria-label="Controlled bold toggle"
      >
        <Bold />
      </Toggle>
      <span className="text-sm">
        {pressed ? "Bold enabled" : "Bold disabled"}
      </span>
    </div>
  )
}

export const Controlled: Story = {
  render: () => <ControlledToggleStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Toggle defaultPressed>
        <Bold data-icon="inline-start" />
        عريض
      </Toggle>
    </div>
  ),
}
