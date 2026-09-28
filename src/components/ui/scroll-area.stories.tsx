import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor } from "storybook/test"

import { ScrollArea } from "@/components/ui/scroll-area"

const activity = [
  "Updated the workspace navigation",
  "Published the onboarding checklist",
  "Added a new review request",
  "Moved the design tokens to production",
  "Invited two teammates to the project",
  "Resolved the open accessibility issue",
  "Created a component usage report",
  "Reviewed the latest release notes",
  "Added keyboard shortcuts to the editor",
  "Archived the completed sprint",
  "Updated the project permissions",
  "Scheduled the next design review",
]

const meta = {
  title: "Components/Scroll Area",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>

export default meta

type Story = StoryObj<typeof meta>

export const ScrollableList: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <ScrollArea className="h-72 rounded-md border">
        <div className="p-4">
          <h3 className="mb-4 text-sm font-medium">Recent activity</h3>
          <div className="space-y-4">
            {activity.map((entry) => (
              <p key={entry} className="text-sm text-muted-foreground">
                {entry}
              </p>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )

    await expect(viewport).not.toBeNull()
    if (!viewport) throw new Error("ScrollArea viewport was not rendered")

    await expect(viewport).toHaveAttribute("tabindex", "0")
    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
      expect(getComputedStyle(viewport).overflowY).toBe("scroll")
    })

    const reference = document.createElement("span")
    reference.hidden = true
    reference.style.boxShadow =
      "0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)"
    canvasElement.append(reference)
    const ring = getComputedStyle(reference).boxShadow
    reference.remove()

    await expect(ring).not.toBe("none")
    await userEvent.click(canvasElement)
    await expect(viewport).not.toHaveFocus()
    await userEvent.tab()
    await expect(viewport).toHaveFocus()
    await expect(viewport.matches(":focus-visible")).toBe(true)
    await waitFor(() => {
      expect(getComputedStyle(viewport).boxShadow).toContain(ring)
    })

    viewport.scrollTo({ top: viewport.scrollHeight })
    await waitFor(() => {
      expect(viewport.scrollTop).toBeGreaterThan(0)
    })
    await expect(viewport).toHaveFocus()
  },
}
