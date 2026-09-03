import type { Meta, StoryObj } from "@storybook/react-vite"

import { Textarea } from "@/components/ui/textarea"

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Textarea aria-label="Message" placeholder="Write a message..." />
  ),
}

export const Disabled: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Textarea aria-label="Message" disabled value="This message cannot be edited." readOnly />
  ),
}

export const Invalid: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Textarea
      aria-invalid="true"
      aria-label="Message"
      defaultValue="This field needs attention."
    />
  ),
}
