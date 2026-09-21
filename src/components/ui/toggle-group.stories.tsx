import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bold, Italic, Underline } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const meta = {
  title: "Components/Toggle Group",
  component: ToggleGroup,
  args: {
    type: "single",
    defaultValue: "bold",
    variant: "default",
    size: "default",
    spacing: 2,
    orientation: "horizontal",
    disabled: false,
  },
  argTypes: {
    type: {
      control: "select",
      options: ["single", "multiple"],
    },
    variant: {
      control: "select",
      options: ["default", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    spacing: {
      control: { type: "number", min: 0, step: 1 },
    },
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
    disabled: {
      control: "boolean",
    },
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Multiple: Story = {
  render: () => (
    <ToggleGroup type="multiple" defaultValue={["bold", "underline"]}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const ConnectedOutline: Story = {
  render: () => (
    <ToggleGroup type="single" variant="outline" spacing={0} defaultValue="bold">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ToggleGroup
      type="single"
      orientation="vertical"
      variant="outline"
      defaultValue="bold"
    >
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Disabled: Story = {
  render: () => (
    <ToggleGroup type="single" disabled defaultValue="bold">
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
    </ToggleGroup>
  ),
}

function ControlledSingleStory() {
  const [value, setValue] = React.useState("bold")

  return (
    <ToggleGroup type="single" value={value} onValueChange={setValue}>
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
    </ToggleGroup>
  )
}

export const Controlled: Story = {
  render: () => <ControlledSingleStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <ToggleGroup
        type="single"
        dir="rtl"
        variant="outline"
        spacing={0}
        defaultValue="bold"
      >
        <ToggleGroupItem value="bold">عريض</ToggleGroupItem>
        <ToggleGroupItem value="italic">مائل</ToggleGroupItem>
        <ToggleGroupItem value="underline">تحته خط</ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
}
