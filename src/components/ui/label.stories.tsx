import type { Meta, StoryObj } from "@storybook/react-vite"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const meta = {
  title: "Components/Label",
  component: Label,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="label-default">Name</Label>
      <input
        className="h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm"
        id="label-default"
        type="text"
      />
    </div>
  ),
}

export const WithInput: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="label-with-input">Email address</Label>
      <Input id="label-with-input" placeholder="you@example.com" type="email" />
    </div>
  ),
}
