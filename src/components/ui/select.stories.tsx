import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const meta = {
  title: "Components/Select",
  component: Select,
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Choose a plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="starter">Starter</SelectItem>
        <SelectItem value="team">Team</SelectItem>
        <SelectItem value="enterprise">Enterprise</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("combobox"))

    const option = within(document.body).getByRole("option", { name: "Team" })
    await expect(option).toBeVisible()
    await userEvent.click(option)
    await expect(canvas.getByRole("combobox")).toHaveTextContent("Team")
  },
}
