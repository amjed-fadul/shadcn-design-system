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

// Beside an action, the title column takes the free width and the action column fits its button (DS10).
export const HeaderWithAction: Story = {
  render: (args) => (
    <Card size={args.size} style={{ width: 700 }}>
      <CardHeader>
        <CardTitle>Quarterly revenue across every region and product line</CardTitle>
        <CardDescription>Updated hourly from the billing ledger.</CardDescription>
        <CardAction><Button variant="outline" size="sm">Export</Button></CardAction>
      </CardHeader>
      <CardContent><p className="text-sm">Revenue is up 12% on the previous quarter.</p></CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>('[data-slot="card-header"]')!
    const title = canvasElement.querySelector<HTMLElement>('[data-slot="card-title"]')!
    const action = canvasElement.querySelector<HTMLElement>('[data-slot="card-action"]')!
    const style = getComputedStyle(header)
    const content = header.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const gap = parseFloat(style.columnGap) || 0
    await expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(content - action.getBoundingClientRect().width - gap - 1)
    await expect(Math.abs(action.getBoundingClientRect().right - (header.getBoundingClientRect().right - parseFloat(style.paddingRight)))).toBeLessThan(1)
  },
}
