import type { Meta, StoryObj } from "@storybook/react-vite"

import { Progress } from "@/components/ui/progress"

const meta = {
  title: "Components/Progress",
  component: Progress,
  args: {
    value: 60,
    max: 100,
    "aria-label": "Upload progress",
  },
  argTypes: {
    value: {
      control: { type: "number" },
    },
    max: {
      control: { type: "number" },
    },
  },
  parameters: {
    controls: {
      include: ["value", "max"],
    },
  },
} satisfies Meta<typeof Progress>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="grid w-80 gap-4">
      <Progress value={0} aria-label="0% complete" />
      <Progress value={25} aria-label="25% complete" />
      <Progress value={50} aria-label="50% complete" />
      <Progress value={75} aria-label="75% complete" />
      <Progress value={100} aria-label="100% complete" />
    </div>
  ),
}

export const CustomMaximum: Story = {
  args: {
    value: 50,
    max: 200,
  },
}

export const Indeterminate: Story = {
  args: {
    value: null,
  },
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl" className="w-80">
      <Progress value={35} aria-label="تقدم العملية" />
    </div>
  ),
}
