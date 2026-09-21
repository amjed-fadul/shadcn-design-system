import type { Meta, StoryObj } from "@storybook/react-vite"

import { Input } from "@/components/ui/input"

const meta = {
  title: "Components/Input",
  component: Input,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Input aria-label="Email address" placeholder="you@example.com" type="email" />
  ),
}

export const Disabled: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => <Input aria-label="Email address" disabled value="you@example.com" readOnly />,
}

export const Invalid: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Input
      aria-invalid="true"
      aria-label="Email address"
      defaultValue="not-an-email"
      type="email"
    />
  ),
}
