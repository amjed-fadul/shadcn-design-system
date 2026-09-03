import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const meta = {
  title: "Components/Dropdown Menu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>Open actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={false}>
          Show archived
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete account</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open actions" }))

    const menu = within(document.body)
    const profile = menu.getByRole("menuitem", { name: "Profile" })
    await expect(profile).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Billing" })).toBeVisible()
    await expect(
      menu.getByRole("menuitemcheckbox", { name: "Show archived" })
    ).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Delete account" })).toBeVisible()

    await userEvent.click(profile)
    await expect(menu.queryByRole("menu")).not.toBeInTheDocument()
  },
}
