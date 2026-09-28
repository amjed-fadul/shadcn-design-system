import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Calendar,
  Calculator,
  Settings,
  Smile,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

function CommandExample() {
  return (
    <Command className="w-[360px] rounded-lg border shadow-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem value="calendar">
            <Calendar />
            <span>Calendar</span>
          </CommandItem>
          <CommandItem value="search-emoji">
            <Smile />
            <span>Search Emoji</span>
          </CommandItem>
          <CommandItem value="calculator">
            <Calculator />
            <span>Calculator</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem value="profile">
            <User />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem value="settings">
            <Settings />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

const meta = {
  title: "Components/Command",
  component: Command,
  parameters: {
    layout: "centered",
  },
  render: () => <CommandExample />,
} satisfies Meta<typeof Command>

export default meta

type Story = StoryObj<typeof meta>

// cmdk hard-codes role="separator" on Command.Separator and keeps
// role="listbox" on Command.List when a search has no results, so axe reports
// aria-required-children for the list. Only that rule is disabled, and only
// for the stories that render a separator or an empty result. Story rule
// arrays replace the preview's, so the preview's region rule is restated.
const cmdkListboxA11y = {
  a11y: {
    config: {
      rules: [
        { id: "region", enabled: true },
        { id: "aria-required-children", enabled: false },
      ],
    },
  },
}

export const Playground: Story = {
  parameters: cmdkListboxA11y,
}

export const Empty: Story = {
  parameters: cmdkListboxA11y,
  render: () => (
    <Command className="w-[360px] rounded-lg border shadow-md">
      <CommandInput placeholder="Search..." value="does-not-exist" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem value="calendar">Calendar</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}


export const Scrollable: Story = {
  render: () => (
    <Command className="w-[360px] rounded-lg border shadow-md">
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandGroup heading="Commands">
          {Array.from({ length: 24 }, (_, index) => (
            <CommandItem key={index} value={`command-${index + 1}`}>
              Command {index + 1}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}

function ControlledDialogStory() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open command dialog
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search commands..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem value="profile" onSelect={() => setOpen(false)}>
              <User />
              <span>Profile</span>
            </CommandItem>
            <CommandItem value="settings" onSelect={() => setOpen(false)}>
              <Settings />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

export const Dialog: Story = {
  render: () => <ControlledDialogStory />,
}

export const DisabledItem: Story = {
  render: () => (
    <Command className="w-[360px] rounded-lg border shadow-md">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandGroup heading="Actions">
          <CommandItem value="available">Available command</CommandItem>
          <CommandItem value="disabled" disabled>
            Disabled command
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Command className="w-[360px] rounded-lg border shadow-md" dir="rtl">
        <CommandInput placeholder="ابحث عن أمر..." />
        <CommandList>
          <CommandEmpty>لا توجد نتائج.</CommandEmpty>
          <CommandGroup heading="اقتراحات">
            <CommandItem value="profile">
              <User />
              <span>الملف الشخصي</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem value="settings">
              <Settings />
              <span>الإعدادات</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
}
