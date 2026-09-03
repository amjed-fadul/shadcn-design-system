import type { Meta, StoryObj } from "@storybook/react-vite"

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
}
