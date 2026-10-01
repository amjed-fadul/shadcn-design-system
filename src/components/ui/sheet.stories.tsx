import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within, waitFor } from "storybook/test"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const meta = {
  title: "Components/Sheet",
  component: Sheet,
} satisfies Meta<typeof Sheet>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger>Open settings</SheetTrigger>
      <SheetContent showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your profile and notification preferences.
          </SheetDescription>
        </SheetHeader>
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Settings form content
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close settings</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open settings" }))
    const body = within(document.body)
    const sheet = body.getByRole("dialog", { name: "Settings" })

    await expect(sheet).toBeVisible()
    await expect(
      within(sheet).getByText("Manage your profile and notification preferences.")
    ).toBeVisible()
    await userEvent.click(within(sheet).getByRole("button", { name: "Close settings" }))
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument())
  },
}

export const Bottom: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Sheet>
      <SheetTrigger>Preview from bottom</SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Quick preview</SheetTitle>
          <SheetDescription>
            This sheet uses the supported bottom placement.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}
