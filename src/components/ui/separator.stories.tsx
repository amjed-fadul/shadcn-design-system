import type { Meta, StoryObj } from "@storybook/react-vite"

import { Separator } from "@/components/ui/separator"

const orientations = ["horizontal", "vertical"] as const

const meta = {
  title: "Components/Separator",
  component: Separator,
  args: {
    orientation: "horizontal",
    decorative: true,
  },
  argTypes: {
    orientation: {
      control: "select",
      options: orientations,
    },
    decorative: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["orientation", "decorative"],
    },
  },
  render: ({ orientation, ...args }) => (
    <div
      className={orientation === "vertical" ? "flex h-10 items-center" : "w-full max-w-sm"}
    >
      <Separator {...args} orientation={orientation} />
    </div>
  ),
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
}
