import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"

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

export const SizeComparison: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {(["default", "sm"] as const).map((size) => (
        <section key={size} aria-label={`${size} card`} className="w-80">
          <p className="mb-2 text-sm text-muted-foreground">{size}</p>
          <Card size={size}>
            <CardHeader>
              <CardTitle>Weekly usage</CardTitle>
              <CardDescription>Your team&apos;s activity.</CardDescription>
              <CardAction><button type="button">Report</button></CardAction>
            </CardHeader>
            <CardContent>84% of your monthly allowance</CardContent>
            <CardFooter>Updated a few moments ago</CardFooter>
          </Card>
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const styles = (size: "default" | "sm") => {
      const region = canvas.getByRole("region", { name: `${size} card` })
      const part = (slot: string) => getComputedStyle(region.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!)
      return {
        headerPadding: part("card-header").padding,
        headerGap: part("card-header").gap,
        contentPadding: part("card-content").padding,
        footerPadding: part("card-footer").padding,
        titleFontSize: part("card-title").fontSize,
        titleLineHeight: part("card-title").lineHeight,
        descriptionFontSize: part("card-description").fontSize,
      }
    }

    // Release 009 retains 16/12px padding and uses 4px internal gaps with 12px metadata.
    await expect({ default: styles("default"), sm: styles("sm") }).toEqual({
      default: {
        headerPadding: "16px", headerGap: "4px", contentPadding: "0px 16px 16px",
        footerPadding: "16px", titleFontSize: "16px", titleLineHeight: "24px", descriptionFontSize: "12px",
      },
      sm: {
        headerPadding: "12px", headerGap: "4px", contentPadding: "0px 12px 12px",
        footerPadding: "12px", titleFontSize: "14px", titleLineHeight: "20px", descriptionFontSize: "12px",
      },
    })
  },
}
