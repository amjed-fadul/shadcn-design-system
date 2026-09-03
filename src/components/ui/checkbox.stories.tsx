import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import { Checkbox } from "@/components/ui/checkbox"

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Unchecked: Story = {
  render: () => <Checkbox aria-label="Enable notifications" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole("checkbox", { name: "Enable notifications" })

    await expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    await expect(checkbox).toBeChecked()
  },
}

export const Checked: Story = {
  render: () => <Checkbox aria-label="Enable notifications" defaultChecked />,
}

export const Disabled: Story = {
  render: () => <Checkbox aria-label="Enable notifications" disabled />,
}
