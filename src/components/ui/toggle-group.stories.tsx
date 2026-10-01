import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bold, Italic, Underline } from "lucide-react"
import { expect, userEvent, waitFor } from "storybook/test"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const meta = {
  title: "Components/Toggle Group",
  component: ToggleGroup,
  args: {
    type: "single",
    defaultValue: "bold",
    variant: "default",
    size: "default",
    spacing: 2,
    orientation: "horizontal",
    disabled: false,
  },
  argTypes: {
    type: {
      control: "select",
      options: ["single", "multiple"],
    },
    variant: {
      control: "select",
      options: ["default", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    spacing: {
      control: { type: "number", min: 0, step: 1 },
    },
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
    disabled: {
      control: "boolean",
    },
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>

export default meta

type Story = StoryObj<typeof meta>

function SelectionItems() {
  return <>
    <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
    <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
    <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
    <ToggleGroupItem value="disabled" disabled>Disabled</ToggleGroupItem>
  </>
}

function SelectionStates({ type }: { type: "single" | "multiple" }) {
  return <div className="w-fit rounded-lg bg-background p-6 text-foreground">
    {type === "single"
      ? <ToggleGroup type="single" defaultValue="bold" aria-label="Text formatting"><SelectionItems /></ToggleGroup>
      : <ToggleGroup type="multiple" defaultValue={["bold", "underline"]} aria-label="Text formatting"><SelectionItems /></ToggleGroup>}
  </div>
}

const verifySelectionStates: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const [selected, available, , disabled] = canvasElement.querySelectorAll<HTMLButtonElement>('[data-slot="toggle-group-item"]')
  const primary = getComputedStyle(selected).getPropertyValue("--primary").trim()
  const foreground = getComputedStyle(selected).getPropertyValue("--primary-foreground").trim()
  await expect(selected).toHaveAttribute("data-state", "on")
  await expect(available).toHaveAttribute("data-state", "off")
  await waitFor(() => expect(getComputedStyle(selected).backgroundColor).toBe(primary))
  await waitFor(() => expect(getComputedStyle(selected).color).toBe(foreground))
  await userEvent.hover(selected)
  await waitFor(() => expect(getComputedStyle(selected).backgroundColor).toBe(primary))
  await waitFor(() => expect(getComputedStyle(selected).color).toBe(foreground))
  await userEvent.unhover(selected)
  await userEvent.hover(available)
  await expect(getComputedStyle(available).backgroundColor).not.toBe(primary)
  await waitFor(() => expect(getComputedStyle(selected).backgroundColor).toBe(primary))
  await userEvent.unhover(available)
  await userEvent.tab()
  await expect(selected).toHaveFocus()
  await expect(selected.matches(":focus-visible")).toBe(true)
  await expect(getComputedStyle(selected).getPropertyValue("--tw-ring-offset-width").trim()).toBe("2px")
  await expect(getComputedStyle(selected).boxShadow).not.toBe("none")
  await waitFor(() => expect(getComputedStyle(selected).backgroundColor).toBe(primary))
  await expect(disabled).toBeDisabled()
  await expect(getComputedStyle(disabled).opacity).toBe("0.5")
  await expect(disabled).toHaveAttribute("data-state", "off")
}

export const SingleLight: Story = { globals: { theme: "light" }, render: () => <SelectionStates type="single" />, play: verifySelectionStates }
export const SingleDark: Story = { globals: { theme: "dark" }, render: () => <SelectionStates type="single" />, play: verifySelectionStates }
export const MultipleLight: Story = { globals: { theme: "light" }, render: () => <SelectionStates type="multiple" />, play: verifySelectionStates }
export const MultipleDark: Story = { globals: { theme: "dark" }, render: () => <SelectionStates type="multiple" />, play: verifySelectionStates }

export const Playground: Story = {}

export const Multiple: Story = {
  render: () => (
    <ToggleGroup type="multiple" defaultValue={["bold", "underline"]}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const ConnectedOutline: Story = {
  render: () => (
    <ToggleGroup type="single" variant="outline" spacing={0} defaultValue="bold">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ToggleGroup
      type="single"
      orientation="vertical"
      variant="outline"
      defaultValue="bold"
    >
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Disabled: Story = {
  render: () => (
    <ToggleGroup type="single" disabled defaultValue="bold">
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
    </ToggleGroup>
  ),
}

function ControlledSingleStory() {
  const [value, setValue] = React.useState("bold")

  return (
    <ToggleGroup type="single" value={value} onValueChange={setValue}>
      <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
      <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
    </ToggleGroup>
  )
}

export const Controlled: Story = {
  render: () => <ControlledSingleStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <ToggleGroup
        type="single"
        dir="rtl"
        variant="outline"
        spacing={0}
        defaultValue="bold"
      >
        <ToggleGroupItem value="bold">عريض</ToggleGroupItem>
        <ToggleGroupItem value="italic">مائل</ToggleGroupItem>
        <ToggleGroupItem value="underline">تحته خط</ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
}
