import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const meta = {
  title: "Components/Card",
  component: Card,
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
    },
  },
  parameters: {
    controls: {
      include: ["size"],
    },
  },
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card size={args.size} className="max-w-sm">
      <CardContent className="pt-4">
        <p className="text-sm">A simple card with a single content section.</p>
      </CardContent>
    </Card>
  ),
}

export const CompleteComposition: Story = {
  render: (args) => (
    <Card size={args.size} className="max-w-md">
      <CardHeader>
        <CardTitle>Weekly usage</CardTitle>
        <CardDescription>Your team&apos;s activity for this week.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            View report
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">84%</div>
        <p className="text-sm text-muted-foreground">12% more than last week</p>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">Updated a few moments ago</p>
      </CardFooter>
    </Card>
  ),
}
