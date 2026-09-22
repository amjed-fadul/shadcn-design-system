import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner data-icon="inline-start" />
      Saving
    </Button>
  ),
}

export const WithCustomAccessibleLabel: Story = {
  render: () => <Spinner aria-label="Loading results" />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Button disabled>
        <Spinner data-icon="inline-start" aria-label="جارٍ الحفظ" />
        جارٍ الحفظ
      </Button>
    </div>
  ),
}
