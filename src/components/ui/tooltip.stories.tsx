import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>More information</TooltipTrigger>
        <TooltipContent>Additional details</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "More information" })

    await expect(screen.queryByRole("tooltip", { name: "Additional details" })).not.toBeInTheDocument()
    await userEvent.hover(trigger)
    const tooltip = await screen.findByRole("tooltip", { name: "Additional details" })
    await expect(tooltip).toBeVisible()

    // Portaled content sits outside Storybook's preview-root landmark. This
    // fixture-level host keeps the open tooltip inside a named page region.
    const portalHost = tooltip.closest<HTMLElement>(
      '[data-radix-popper-content-wrapper]'
    )
    await expect(portalHost).not.toBeNull()
    portalHost?.setAttribute("role", "region")
    portalHost?.setAttribute("aria-label", "Tooltip preview")
  },
}
