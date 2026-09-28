import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { getTokenContract } from "@/contracts/tokens/contract"
import type { TokenMode } from "@/contracts/tokens/types"

const tokenContract = getTokenContract()

function getContractedColor(tokenId: `color.${string}`, mode: TokenMode) {
  const token = tokenContract.tokens.find(({ id }) => id === tokenId)

  if (!token || token.category !== "color" || token.value.kind !== "modes") {
    throw new Error(`Missing contracted color token: ${tokenId}`)
  }

  return {
    cssVariable: token.binding.cssVariable,
    value: token.value.values[mode],
  }
}

function resolveColor(value: string) {
  const probe = document.createElement("span")
  probe.style.color = value
  document.body.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
}

function ThemeContractFixture() {
  return (
    <main
      aria-label="Theme contract fixture"
      className="min-h-96 bg-background p-6 text-foreground"
    >
      <Card className="max-w-md" data-testid="theme-card">
        <CardHeader>
          <CardTitle>Release readiness</CardTitle>
          <CardDescription>
            Semantic surfaces must follow the active design-system mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button data-testid="theme-button">Primary action</Button>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview content</TabsContent>
            <TabsContent value="details">Details content</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog defaultOpen modal={false}>
        <DialogContent data-testid="theme-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Portal surface</DialogTitle>
            <DialogDescription>
              This content is rendered under document.body.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  )
}

const meta = {
  title: "Release Readiness/Theme Contract",
  component: ThemeContractFixture,
  parameters: {
    controls: {
      disable: true,
    },
    providesDocumentLandmarks: true,
  },
} satisfies Meta<typeof ThemeContractFixture>

export default meta

type Story = StoryObj<typeof meta>

async function expectTheme(mode: TokenMode, canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const documentRoot = document.documentElement
  const rootStyles = getComputedStyle(documentRoot)
  const expectedDarkClass = mode === "dark"

  await waitFor(() => {
    expect(documentRoot.classList.contains("dark")).toBe(expectedDarkClass)
  })
  await expect(document.body).not.toHaveClass("dark")

  const background = getContractedColor("color.background", mode)
  const foreground = getContractedColor("color.foreground", mode)
  const cardBackground = getContractedColor("color.card", mode)
  const cardForeground = getContractedColor("color.card-foreground", mode)
  const primary = getContractedColor("color.primary", mode)
  const primaryForeground = getContractedColor("color.primary-foreground", mode)
  const muted = getContractedColor("color.muted", mode)
  const border = getContractedColor("color.border", mode)

  for (const token of [
    background,
    foreground,
    cardBackground,
    cardForeground,
    primary,
    primaryForeground,
    muted,
    border,
  ]) {
    await expect(rootStyles.getPropertyValue(token.cssVariable).trim()).toBe(token.value)
  }

  const fixture = canvas.getByRole("main", { name: "Theme contract fixture" })
  const card = canvas.getByTestId("theme-card")
  const button = canvas.getByTestId("theme-button")
  const tabList = canvas.getByRole("tablist")
  const activeTab = canvas.getByRole("tab", { name: "Overview" })
  const dialog = within(document.body).getByRole("dialog", { name: "Portal surface" })

  await expect(getComputedStyle(fixture)).toMatchObject({
    backgroundColor: resolveColor(background.value),
    color: resolveColor(foreground.value),
  })
  await expect(getComputedStyle(card)).toMatchObject({
    backgroundColor: resolveColor(cardBackground.value),
    borderColor: resolveColor(border.value),
    color: resolveColor(cardForeground.value),
  })
  const resolvedPrimary = resolveColor(primary.value)
  const resolvedPrimaryForeground = resolveColor(primaryForeground.value)

  await waitFor(() => {
    expect(getComputedStyle(button)).toMatchObject({
      backgroundColor: resolvedPrimary,
      color: resolvedPrimaryForeground,
    })
  })
  await expect(getComputedStyle(tabList).backgroundColor).toBe(resolveColor(muted.value))
  await expect(getComputedStyle(activeTab).backgroundColor).toBe(
    resolveColor(background.value)
  )
  await expect(dialog.parentElement).toBe(document.body)
  await expect(getComputedStyle(dialog)).toMatchObject({
    backgroundColor: resolveColor(background.value),
    borderColor: resolveColor(border.value),
    color: resolveColor(foreground.value),
  })

  await userEvent.click(canvas.getByRole("tab", { name: "Details" }))
  await expect(canvas.getByRole("tab", { name: "Details" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(documentRoot.classList.contains("dark")).toBe(expectedDarkClass)
}

export const Light: Story = {
  globals: {
    theme: "light",
  },
  play: async ({ canvasElement }) => {
    await expectTheme("light", canvasElement)
  },
}

export const Dark: Story = {
  globals: {
    theme: "dark",
  },
  play: async ({ canvasElement }) => {
    await expectTheme("dark", canvasElement)
  },
}

export const RestoredLight: Story = {
  globals: {
    theme: "light",
  },
  play: async ({ canvasElement }) => {
    await expectTheme("light", canvasElement)
  },
}
