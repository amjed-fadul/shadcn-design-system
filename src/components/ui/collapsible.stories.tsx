import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const meta = {
  title: "Components/Collapsible",
  component: Collapsible,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Collapsible>

export default meta

type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Collapsible className="w-80 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Project settings</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle project settings">
            <ChevronsUpDown />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="rounded-md border p-3 text-sm">
        Advanced settings are available here.
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-80 space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline">Toggle details</Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-md border p-3 text-sm">
        This content starts open.
      </CollapsibleContent>
    </Collapsible>
  ),
}

function ControlledCollapsibleStory() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="grid w-80 gap-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline">
            {open ? "Hide settings" : "Show settings"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          Controlled collapsible content.
        </CollapsibleContent>
      </Collapsible>
      <span className="text-sm text-muted-foreground">
        {open ? "Open" : "Closed"}
      </span>
    </div>
  )
}

export const Controlled: Story = {
  render: () => <ControlledCollapsibleStory />,
}

export const Disabled: Story = {
  render: () => (
    <Collapsible disabled className="w-80 space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline">Unavailable settings</Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-md border p-3 text-sm">
        Disabled collapsible content.
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const ForceMounted: Story = {
  render: () => (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline">Toggle force-mounted content</Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        forceMount
        className="mt-2 rounded-md border p-3 text-sm data-[state=closed]:hidden"
      >
        The content remains mounted while closed.
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Collapsible className="w-80 space-y-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline">إظهار الإعدادات</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-md border p-3 text-sm">
          إعدادات إضافية لهذا القسم.
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
}
