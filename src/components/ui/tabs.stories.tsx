import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

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
    <div className="flex flex-col gap-8">
      {(["default", "line"] as const).map((variant) => (
        <section key={variant} aria-label={`${variant} tabs`}>
          <p className="mb-2 text-sm text-muted-foreground">{variant}</p>
          <Tabs defaultValue="overview">
            <TabsList variant={variant}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview content</TabsContent>
            <TabsContent value="activity">Activity content</TabsContent>
          </Tabs>
        </section>
      ))}
      <section aria-label="vertical line tabs">
        <p className="mb-2 text-sm text-muted-foreground">vertical line</p>
        <Tabs defaultValue="overview" orientation="vertical">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview content</TabsContent>
          <TabsContent value="activity">Activity content</TabsContent>
        </Tabs>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const region = (name: string) => within(canvas.getByRole("region", { name }))
    const defaultTab = region("default tabs").getByRole("tab", { name: "Overview" })
    const line = region("line tabs")
    const overview = line.getByRole("tab", { name: "Overview" })
    const activity = line.getByRole("tab", { name: "Activity" })
    const appearance = (tab: HTMLElement) => {
      const style = getComputedStyle(tab)
      const after = getComputedStyle(tab, "::after")
      return {
        background: style.backgroundColor, shadow: style.boxShadow, radius: style.borderRadius,
        padding: style.padding, fontSize: style.fontSize,
        indicator: {
          content: after.content, position: after.position, height: after.height,
          bottom: after.bottom, left: after.left, right: after.right,
          background: after.backgroundColor, opacity: after.opacity,
        },
      }
    }
    const noVisibleShadow = /^(?:none|rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, rgba\(0, 0, 0, 0\) 0px 0px 0px 0px)*)$/

    // Preserve the default treatment; line mode keeps the pinned rounded-md
    // trigger, but must replace the active fill/shadow with a real indicator.
    await expect(appearance(defaultTab)).toMatchObject({ background: "oklch(1 0 0)", radius: "8px", padding: "0px 12px", fontSize: "14px" })
    await expect(getComputedStyle(defaultTab).boxShadow).not.toMatch(noVisibleShadow)
    await expect(getComputedStyle(defaultTab, "::after").opacity).toBe("0")
    await expect(getComputedStyle(defaultTab.closest('[data-slot="tabs"]')!).gap).toBe("normal")
    await expect(getComputedStyle(overview.closest('[data-slot="tabs"]')!).gap).toBe("8px")
    await expect(getComputedStyle(line.getByRole("tablist"))).toMatchObject({ backgroundColor: "rgba(0, 0, 0, 0)", gap: "4px", borderBottomWidth: "1px" })
    await expect(appearance(overview)).toMatchObject({
      background: "rgba(0, 0, 0, 0)", shadow: expect.stringMatching(noVisibleShadow), radius: "8px",
      indicator: { content: '""', position: "absolute", height: "2px", bottom: "-5px", left: "0px", right: "0px", background: "oklch(0.145 0 0)", opacity: "1" },
    })
    await expect(getComputedStyle(activity, "::after").opacity).toBe("0")
    await expect(line.getByRole("tabpanel").getBoundingClientRect().top).toBeGreaterThan(overview.getBoundingClientRect().bottom + 5)

    await userEvent.click(activity)
    // Focus rings also use box-shadow. Inspect unfocused elevation without
    // suppressing the component's existing keyboard-focus treatment.
    activity.blur()
    await waitFor(() => {
      expect(activity).toHaveAttribute("aria-selected", "true")
      expect(line.getByText("Activity content")).toBeVisible()
      expect(line.queryByText("Overview content")).not.toBeInTheDocument()
      expect(appearance(activity)).toMatchObject({ background: "rgba(0, 0, 0, 0)", shadow: expect.stringMatching(noVisibleShadow), indicator: { opacity: "1" } })
      expect(getComputedStyle(overview, "::after").opacity).toBe("0")
    })
    activity.focus()
    await userEvent.keyboard("{ArrowLeft}")
    await waitFor(() => {
      expect(overview).toHaveAttribute("aria-selected", "true")
      expect(line.getByText("Overview content")).toBeVisible()
      expect(getComputedStyle(overview, "::after").opacity).toBe("1")
      expect(getComputedStyle(activity, "::after").opacity).toBe("0")
    })

    const vertical = region("vertical line tabs").getByRole("tab", { name: "Overview" })
    await expect(getComputedStyle(vertical, "::after")).toMatchObject({ position: "absolute", width: "2px", top: "0px", bottom: "0px", right: "-4px", opacity: "1", backgroundColor: "oklch(0.145 0 0)" })
  },
}
