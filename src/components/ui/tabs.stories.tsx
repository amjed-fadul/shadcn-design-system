import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const meta = {
  title: "Components/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="max-w-md">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="activity">Activity content</TabsContent>
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const overviewTab = canvas.getByRole("tab", { name: "Overview" })
    const activityTab = canvas.getByRole("tab", { name: "Activity" })

    await expect(overviewTab).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText("Overview content")).toBeVisible()
    await expect(canvas.queryByText("Activity content")).not.toBeInTheDocument()
    await userEvent.click(activityTab)
    await expect(activityTab).toHaveAttribute("aria-selected", "true")
    await expect(canvas.getByText("Activity content")).toBeVisible()
  },
}

export const LineVariant: Story = {
  render: () => (
    <div className="max-w-md">
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="activity">Activity content</TabsContent>
      </Tabs>
    </div>
  ),
}
