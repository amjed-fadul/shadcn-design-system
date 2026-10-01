import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"

import { Link } from "@/components/ui/link"

const meta = {
  title: "Components/Link",
  component: Link,
  args: { href: "/docs", children: "Documentation" },
  parameters: { controls: { include: ["href", "children", "newTab"] } },
} satisfies Meta<typeof Link>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Documentation" })).toHaveAttribute("href", "/docs")
  },
}

export const Destinations: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p><Link href="/docs">Internal documentation</Link></p>
      <p><Link href="#link-destinations-details">Jump to details</Link></p>
      <p><Link href="https://example.com/docs">External documentation</Link></p>
      <p><Link href="mailto:team@example.com">Email the team</Link></p>
      <p><Link href="tel:+9715550100">Call the team</Link></p>
      <p id="link-destinations-details">Destination details</p>
    </div>
  ),
  play: async ({ canvas }) => {
    const external = canvas.getByRole("link", { name: "External documentation" })
    await expect(external).not.toHaveAttribute("target")
    await expect(canvas.getByRole("link", { name: "Email the team" })).toHaveAttribute("href", "mailto:team@example.com")
    await expect(canvas.getByRole("link", { name: "Call the team" })).toHaveAttribute("href", "tel:+9715550100")
  },
}

export const NewTab: Story = {
  args: { href: "https://example.com/docs", newTab: true, children: "Documentation (opens in a new tab)" },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "Documentation (opens in a new tab)" })
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", "noopener")
  },
}

export const Keyboard: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p><Link href="#link-details">Read details</Link></p>
      <p id="link-details">Native hash destination</p>
    </div>
  ),
}

export const Multiline: Story = {
  render: () => (
    <p className="w-48 text-lg">
      Explore <Link href="/docs">the complete documentation for building accessible interfaces</Link> with examples.
    </p>
  ),
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "the complete documentation for building accessible interfaces" })
    await expect(getComputedStyle(link).display).toBe("inline")
    await expect(getComputedStyle(link).fontSize).toBe("18px")
    await expect(link.getClientRects().length).toBeGreaterThan(1)
  },
}

export const Light: Story = { globals: { theme: "light" } }
export const Dark: Story = { globals: { theme: "dark" } }
export const Rtl: Story = {
  render: () => <p dir="rtl">اقرأ <Link href="#link-rtl-details">التوثيق الكامل لإنشاء واجهات سهلة الاستخدام</Link> لمعرفة المزيد.<span id="link-rtl-details"> التفاصيل</span></p>,
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "التوثيق الكامل لإنشاء واجهات سهلة الاستخدام" })
    await expect(getComputedStyle(link).direction).toBe("rtl")
    await expect(getComputedStyle(link).display).toBe("inline")
  },
}
