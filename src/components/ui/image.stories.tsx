import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"

import { Image } from "@/components/ui/image"

const contentSource = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#dbeafe"/><circle cx="510" cy="80" r="38" fill="#fde68a"/><path d="M0 360V280L180 100l170 210 130-140 160 190Z" fill="#334155"/><path d="M0 360V325l200-130 140 165Z" fill="#64748b"/></svg>')}`
const logoSource = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><rect width="240" height="80" fill="#f8fafc"/><path d="M24 56 44 24 64 56Z" fill="#0f172a"/><path d="M88 24h120v10H88zm0 22h88v10H88z" fill="#0f172a"/></svg>')}`

const meta = {
  title: "Components/Image",
  component: Image,
  args: { src: contentSource, alt: "Mountain landscape under a bright sun", width: 640, height: 360 },
  parameters: { controls: { include: ["src", "alt", "width", "height", "layout", "fit", "loading"] } },
} satisfies Meta<typeof Image>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img", { name: "Mountain landscape under a bright sun" }) as HTMLImageElement
    await expect(image).toBeVisible()
    await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true))
    await expect(image.getBoundingClientRect().width).toBe(640)
    await expect(image.getBoundingClientRect().height).toBe(360)
    await expect(image).toHaveAttribute("loading", "eager")
  },
}

export const Logo: Story = {
  args: { src: logoSource, alt: "Example company", width: 240, height: 80 },
}

export const Decorative: Story = {
  render: () => <div className="flex flex-col gap-2"><Image src={contentSource} alt="" width={640} height={360} /><p>Mountain landscape collection</p></div>,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole("img")).toBeNull()
    await expect(canvasElement.querySelector("img")).toHaveAttribute("alt", "")
  },
}

export const Constrained: Story = {
  render: () => <div className="w-48"><Image src={contentSource} alt="Mountain landscape" width={640} height={360} /></div>,
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img", { name: "Mountain landscape" }) as HTMLImageElement
    await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true))
    await expect(image.getBoundingClientRect().width).toBe(192)
    await expect(image.getBoundingClientRect().height).toBe(108)
  },
}

export const Fill: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="flex flex-col gap-2"><p>Contain</p><div className="size-48 bg-muted"><Image src={contentSource} alt="Full mountain landscape" width={640} height={360} layout="fill" /></div></div>
      <div className="flex flex-col gap-2"><p>Cover</p><div className="size-48 bg-muted"><Image src={contentSource} alt="Cropped mountain landscape" width={640} height={360} layout="fill" fit="cover" /></div></div>
    </div>
  ),
  play: async ({ canvas }) => {
    for (const [name, fit] of [["Full mountain landscape", "contain"], ["Cropped mountain landscape", "cover"]]) {
      const image = canvas.getByRole("img", { name }) as HTMLImageElement
      await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true))
      await expect(image.getBoundingClientRect().width).toBe(192)
      await expect(image.getBoundingClientRect().height).toBe(192)
      await expect(getComputedStyle(image).objectFit).toBe(fit)
    }
  },
}

export const Lazy: Story = { args: { loading: "lazy" } }

export const Light: Story = { globals: { theme: "light" }, args: { src: logoSource, alt: "Example company", width: 240, height: 80 } }
export const Dark: Story = { globals: { theme: "dark" }, args: { src: logoSource, alt: "Example company", width: 240, height: 80 } }

export const Rtl: Story = {
  render: () => <div dir="rtl" className="w-48"><Image src={contentSource} alt="منظر جبلي" width={640} height={360} /><p>منظر جبلي</p></div>,
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img", { name: "منظر جبلي" })
    await expect(getComputedStyle(image).transform).toBe("none")
    await expect(getComputedStyle(image).rotate).toBe("none")
    await expect(image.getBoundingClientRect().width).toBe(192)
  },
}
