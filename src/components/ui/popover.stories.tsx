import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

const meta = {
  title: "Components/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>
            Set the dimensions for the layer.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AlignStart: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Align start</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Aligned content</PopoverTitle>
          <PopoverDescription>
            The content aligns with the start edge of the trigger.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
}

function ControlledPopoverStory() {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">{open ? "Close popover" : "Open popover"}</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Controlled state</PopoverTitle>
          <PopoverDescription>
            The open state is controlled by the story.
          </PopoverDescription>
        </PopoverHeader>
        <Button className="mt-4" size="sm" onClick={() => setOpen(false)}>
          Done
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export const Controlled: Story = {
  render: () => <ControlledPopoverStory />,
}

export const CustomAnchor: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverAnchor asChild>
        <div className="rounded-md border px-4 py-2 text-sm">Anchor target</div>
      </PopoverAnchor>
      <PopoverContent side="bottom">
        <PopoverHeader>
          <PopoverTitle>Custom anchor</PopoverTitle>
          <PopoverDescription>
            PopoverContent can position against PopoverAnchor.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">فتح النافذة</Button>
        </PopoverTrigger>
        <PopoverContent dir="rtl" align="start">
          <PopoverHeader>
            <PopoverTitle>تفاصيل</PopoverTitle>
            <PopoverDescription>
              محتوى منبثق يدعم اتجاه الكتابة من اليمين إلى اليسار.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </div>
  ),
}
