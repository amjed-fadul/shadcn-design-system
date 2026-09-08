import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import { Switch } from "@/components/ui/switch"

const meta = {
  title: "Components/Switch",
  component: Switch,
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Unchecked: Story = {
  render: () => <Switch aria-label="Enable notifications" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole("switch", { name: "Enable notifications" })

    await expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    await expect(toggle).toBeChecked()
  },
}

export const Checked: Story = {
  render: () => <Switch aria-label="Enable notifications" defaultChecked />,
}

export const Small: Story = {
  render: () => <Switch aria-label="Enable notifications" size="sm" defaultChecked />,
}

export const Disabled: Story = {
  render: () => <Switch aria-label="Enable notifications" disabled />,
}
