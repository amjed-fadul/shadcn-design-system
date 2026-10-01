import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within, waitFor } from "storybook/test"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }))

    const exitOverlay = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
    await expect(exitOverlay).not.toBeNull()
    const exitAnimation = exitOverlay!.getAnimations().find((animation) => animation instanceof CSSAnimation && animation.animationName === "exit")
    await expect(exitAnimation).toBeDefined()
    const exitOpacityKeyframes = (exitAnimation!.effect as KeyframeEffect).getKeyframes().map((keyframe) => keyframe.opacity)

    await waitFor(() => expect(body.queryByRole("dialog", { name: "Edit profile" })).not.toBeInTheDocument())
    await expect({ entry: entryOpacityKeyframes, exit: exitOpacityKeyframes }).toEqual({ entry: ["0", "1"], exit: ["1", "0"] })
  },
}

export const ComposedTrigger: Story = {
  render: () => (
    <TooltipProvider><Dialog><Tooltip>
      <TooltipTrigger asChild><DialogTrigger asChild><Button variant="outline">Open composed dialog</Button></DialogTrigger></TooltipTrigger>
      <TooltipContent>Open dialog settings</TooltipContent>
      <DialogContent><DialogTitle>Composed dialog</DialogTitle><DialogDescription>React 18 trigger composition.</DialogDescription></DialogContent>
    </Tooltip></Dialog></TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Open composed dialog" })
    await userEvent.click(trigger)
    await within(document.body).findByRole("dialog")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(within(document.body).queryByRole("tooltip")).not.toBeInTheDocument())
  },
}
