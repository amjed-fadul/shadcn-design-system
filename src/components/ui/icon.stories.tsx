import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

const meta = {
  title: "Components/Icon",
  component: Icon,
  args: { name: "search" },
  parameters: { controls: { include: ["name", "size", "color", "decorative", "label", "placement"] } },
} satisfies Meta<typeof Icon>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => <div className="flex items-center gap-4"><Icon name="search" size="sm" /><Icon name="search" /><Icon name="search" size="lg" /></div>,
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll("svg")
    for (const [index, pixels] of [14, 16, 20].entries()) {
      await expect(icons[index].getBoundingClientRect().width).toBe(pixels)
      await expect(icons[index].getBoundingClientRect().height).toBe(pixels)
    }
  },
}

export const Accessibility: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-2"><Icon name="check-circle" />Saved</span>
      <Icon name="info" decorative={false} label="Information" />
      <Button size="icon" aria-label="Search"><Icon name="search" /></Button>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Information" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Search" })).toBeVisible()
    await expect(canvas.getAllByRole("img")).toHaveLength(1)
  },
}

export const InButtons: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button><Icon name="search" placement="inline-start" />Search</Button>
      <Button variant="outline">Continue<Icon name="arrow-end" placement="inline-end" /></Button>
      <Button size="icon" aria-label="Close"><Icon name="x" /></Button>
      <Button loading><Icon name="search" placement="inline-start" />Search</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const loadingButton = canvasElement.querySelector('[aria-busy="true"]')!
    await expect(loadingButton.querySelector('[data-slot="icon"]')).not.toBeVisible()
  },
}

function DirectionExamples({ direction }: { direction: "ltr" | "rtl" }) {
  return (
    <div dir={direction} className="flex flex-col gap-4">
      <span className="flex items-center gap-2"><Icon name="arrow-start" />Logical start<Icon name="arrow-end" />Logical end</span>
      <span className="flex items-center gap-2"><Icon name="chevron-start" />Logical start<Icon name="chevron-end" />Logical end</span>
      <span className="flex items-center gap-2"><Icon name="arrow-left" />Physical left<Icon name="arrow-right" />Physical right</span>
      <Button variant="outline">Continue<Icon name="arrow-end" placement="inline-end" /></Button>
    </div>
  )
}

export const Ltr: Story = { render: () => <DirectionExamples direction="ltr" /> }
export const Rtl: Story = {
  render: () => <DirectionExamples direction="rtl" />,
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll("svg")
    await expect(getComputedStyle(icons[0]).rotate).toBe("180deg")
    await expect(getComputedStyle(icons[4]).rotate).toBe("none")
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
  render: () => <div className="flex items-center gap-4"><Icon name="info" decorative={false} label="Information" /><Button size="icon" aria-label="Search"><Icon name="search" /></Button></div>,
}

function ColorExamples({ direction = "ltr" }: { direction?: "ltr" | "rtl" }) {
  return (
    <div dir={direction} className="flex flex-col gap-4">
      {(["inherit", "foreground", "primary", "muted-foreground", "destructive"] as const).map((color) => (
        <span key={color} className="flex items-center gap-2">
          <Icon name="info" color={color} decorative={false} label={`${color} information`} />
          {color}
        </span>
      ))}
      <Button><Icon name="search" />Search — inherited button color</Button>
    </div>
  )
}

const checkColors: Story["play"] = async ({ canvasElement, canvas }) => {
  for (const color of ["foreground", "primary", "muted-foreground", "destructive"]) {
    const icon = canvas.getByRole("img", { name: `${color} information` })
    const probe = document.createElement("span")
    probe.style.color = `var(--${color})`
    canvasElement.append(probe)
    await expect(getComputedStyle(icon).color).toBe(getComputedStyle(probe).color)
    await expect(icon.getAttribute("stroke")).toBe("currentColor")
    probe.remove()
  }
}

export const Colors: Story = { globals: { theme: "light" }, render: () => <ColorExamples />, play: checkColors }
export const ColorsDark: Story = { globals: { theme: "dark" }, render: () => <ColorExamples />, play: checkColors }
export const ColorsRtl: Story = { render: () => <ColorExamples direction="rtl" />, play: checkColors }
