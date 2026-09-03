import type { Meta, StoryObj } from "@storybook/react-vite"

import { Skeleton } from "@/components/ui/skeleton"

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-48" />,
}

export const Shapes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Skeleton className="size-12 rounded-full" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-24 w-32 rounded-xl" />
    </div>
  ),
}
