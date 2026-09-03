import type { Meta, StoryObj } from "@storybook/react-vite"

import { Badge } from "@/components/ui/badge"

const variants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: {
    variant: "default",
    asChild: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: variants,
    },
    asChild: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["variant", "asChild"],
    },
  },
  render: ({ asChild, ...args }) =>
    asChild ? (
      <Badge {...args} asChild>
        <a href="https://example.com/badges">Badge</a>
      </Badge>
    ) : (
      <Badge {...args}>Badge</Badge>
    ),
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {variants.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
}
