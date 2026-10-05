import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const meta = {
  title: "Components/Accordion",
  component: Accordion,
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    type: "single",
  },
  render: () => (
    <div className="max-w-md">
      <Accordion type="single" collapsible>
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Account content</AccordionContent>
        </AccordionItem>
        <AccordionItem value="security">
          <AccordionTrigger>Security</AccordionTrigger>
          <AccordionContent>Security content</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Account" })

    await expect(canvas.queryByText("Account content")).not.toBeInTheDocument()
    await userEvent.click(trigger)
    await expect(canvas.getByText("Account content")).toBeVisible()
  },
}

export const MultipleItems: Story = {
  args: {
    type: "multiple",
  },
  render: () => (
    <div className="max-w-md">
      <Accordion type="multiple" defaultValue={["account"]}>
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Account content</AccordionContent>
        </AccordionItem>
        <AccordionItem value="security">
          <AccordionTrigger>Security</AccordionTrigger>
          <AccordionContent>Security content</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
}

// A question that wraps starts every line at the trigger's start edge (DS1).
export const LongQuestion: Story = {
  args: {
    type: "single",
  },
  render: () => (
    <div className="w-72">
      <Accordion type="single" collapsible>
        <AccordionItem value="refunds">
          <AccordionTrigger>Can I get a refund if I cancel my annual plan partway through the year?</AccordionTrigger>
          <AccordionContent>Yes. Unused months are refunded to the original payment method.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: /refund/ })
    await expect(getComputedStyle(trigger).textAlign).toBe("start")
    const range = document.createRange()
    range.selectNodeContents(trigger.firstChild!)
    const lines = [...range.getClientRects()]
    await expect(lines.length).toBeGreaterThan(1)
    const start = trigger.getBoundingClientRect().left
    for (const line of lines) await expect(Math.abs(line.left - start)).toBeLessThan(1)
  },
}
