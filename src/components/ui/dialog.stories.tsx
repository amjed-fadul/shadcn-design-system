import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const meta = {
  title: "Components/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger>Open profile</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update the details that appear on your public profile.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Profile details form content
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open profile" }))
    const body = within(document.body)
    const dialog = body.getByRole("dialog", { name: "Edit profile" })
    const overlay = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')

    await expect(overlay).not.toBeNull()
    const entryAnimation = overlay!.getAnimations().find((animation) => animation instanceof CSSAnimation && animation.animationName === "enter")
    await expect(entryAnimation).toBeDefined()
    const entryOpacityKeyframes = (entryAnimation!.effect as KeyframeEffect).getKeyframes().map((keyframe) => keyframe.opacity)

    await expect(dialog).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }))

    const exitOverlay = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
    await expect(exitOverlay).not.toBeNull()
    const exitAnimation = exitOverlay!.getAnimations().find((animation) => animation instanceof CSSAnimation && animation.animationName === "exit")
    await expect(exitAnimation).toBeDefined()
    const exitOpacityKeyframes = (exitAnimation!.effect as KeyframeEffect).getKeyframes().map((keyframe) => keyframe.opacity)

    await expect(body.queryByRole("dialog", { name: "Edit profile" })).not.toBeInTheDocument()
    await expect({ entry: entryOpacityKeyframes, exit: exitOpacityKeyframes }).toEqual({ entry: ["0", "1"], exit: ["1", "0"] })
  },
}
