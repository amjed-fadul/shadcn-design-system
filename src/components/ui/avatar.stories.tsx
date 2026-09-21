import type { Meta, StoryObj } from "@storybook/react-vite"
import { Check } from "lucide-react"

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"

const imageDataUri =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='40' fill='%23d4d4d8'/%3E%3Ccircle cx='40' cy='31' r='14' fill='%2371717a'/%3E%3Cpath d='M16 72c4-16 14-24 24-24s20 8 24 24' fill='%2371717a'/%3E%3C/svg%3E"

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: {
    size: "default",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
  parameters: {
    controls: {
      include: ["size"],
    },
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={imageDataUri} alt="Example profile" />
      <AvatarFallback>AF</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/missing-avatar.png" alt="Amjed Fadul" />
      <AvatarFallback>AF</AvatarFallback>
    </Avatar>
  ),
}

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
}

export const WithBadge: Story = {
  render: () => (
    <Avatar size="lg">
      <AvatarImage src={imageDataUri} alt="Example profile" />
      <AvatarFallback>AF</AvatarFallback>
      <AvatarBadge>
        <Check />
      </AvatarBadge>
    </Avatar>
  ),
}

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>AF</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>SA</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MK</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>أف</AvatarFallback>
          <AvatarBadge />
        </Avatar>
        <Avatar>
          <AvatarFallback>سا</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+٣</AvatarGroupCount>
      </AvatarGroup>
    </div>
  ),
}
