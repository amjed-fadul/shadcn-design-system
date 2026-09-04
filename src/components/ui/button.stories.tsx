import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowRight } from "lucide-react"
import { expect, within } from "storybook/test"

import { Button } from "@/components/ui/button"

const variants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

const sizes = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const

const meta = {
  title: "Components/Button",
  component: Button,
  args: {
    variant: "default",
    size: "default",
    disabled: false,
    asChild: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: variants,
    },
    size: {
      control: "select",
      options: sizes,
    },
    disabled: {
      control: "boolean",
      if: { arg: "asChild", truthy: false },
    },
    asChild: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["variant", "size", "disabled", "asChild"],
    },
  },
  render: ({ asChild, disabled, ...args }) =>
    asChild ? (
      <Button {...args} asChild>
        <a href="https://example.com/docs">Button</a>
      </Button>
    ) : (
      <Button {...args} disabled={disabled}>
        Button
      </Button>
    ),
} satisfies Meta<typeof Button>

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
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
}

export const DestructiveDark: Story = {
  globals: {
    theme: "dark",
  },
  parameters: {
    controls: { disable: true },
  },
  render: () => <Button variant="destructive">Destructive</Button>,
}

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="default">Default</Button>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button aria-label="Default icon button" size="icon">
        <ArrowRight />
      </Button>
      <Button aria-label="Extra small icon button" size="icon-xs">
        <ArrowRight />
      </Button>
      <Button aria-label="Small icon button" size="icon-sm">
        <ArrowRight />
      </Button>
      <Button aria-label="Large icon button" size="icon-lg">
        <ArrowRight />
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => <Button disabled>Disabled Button</Button>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Disabled Button" })
    ).toBeDisabled()
  },
}

export const AsChild: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Button asChild>
      <a href="https://example.com/docs">Documentation Link</a>
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole("link", { name: "Documentation Link" })

    await expect(link).toHaveAttribute("data-slot", "button")
    await expect(link.tagName).toBe("A")
    await expect(link).toHaveAccessibleName("Documentation Link")
  },
}
