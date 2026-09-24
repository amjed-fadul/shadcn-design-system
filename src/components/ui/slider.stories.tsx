import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Slider } from "@/components/ui/slider"

const meta = {
  title: "Components/Slider",
  component: Slider,
  args: {
    defaultValue: [33],
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    orientation: "horizontal",
  },
  argTypes: {
    min: { control: { type: "number" } },
    max: { control: { type: "number" } },
    step: { control: { type: "number" } },
    disabled: { control: "boolean" },
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
  parameters: {
    controls: {
      include: ["min", "max", "step", "disabled", "orientation"],
    },
  },
  render: (args) => <Slider {...args} thumbAriaLabels={["Volume"]} />,
} satisfies Meta<typeof Slider>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Range: Story = {
  render: () => (
    <Slider
      defaultValue={[25, 75]}
      min={0}
      max={100}
      step={5}
      thumbAriaLabels={["Minimum price", "Maximum price"]}
    />
  ),
}

export const MultipleThumbs: Story = {
  render: () => (
    <Slider
      defaultValue={[15, 50, 85]}
      min={0}
      max={100}
      step={5}
      thumbAriaLabels={["Low value", "Middle value", "High value"]}
    />
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="h-48">
      <Slider
        defaultValue={[40]}
        orientation="vertical"
        thumbAriaLabels={["Vertical value"]}
      />
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Slider defaultValue={[60]} disabled thumbAriaLabels={["Disabled value"]} />
  ),
}

function ControlledSliderStory() {
  const [value, setValue] = React.useState([40])

  return (
    <div className="grid w-80 gap-3">
      <Slider
        value={value}
        onValueChange={setValue}
        thumbAriaLabels={["Controlled value"]}
      />
      <span className="text-sm text-muted-foreground">
        Value: {value[0]}
      </span>
    </div>
  )
}

export const Controlled: Story = {
  render: () => <ControlledSliderStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl" className="w-80">
      <Slider
        defaultValue={[35]}
        dir="rtl"
        thumbAriaLabels={["القيمة"]}
      />
    </div>
  ),
}
