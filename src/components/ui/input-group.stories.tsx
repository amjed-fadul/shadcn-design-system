import type { Meta, StoryObj } from "@storybook/react-vite"
import { Search, Send, X } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

const meta = {
  title: "Components/Input Group",
  component: InputGroup,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof InputGroup>

export default meta

type Story = StoryObj<typeof meta>

export const SearchInput: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput placeholder="Search..." aria-label="Search" />
      <InputGroupAddon align="inline-start">
        <Search />
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const InlineEndAction: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput defaultValue="Project Alpha" aria-label="Project name" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Clear value">
          <X />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const TextAddon: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput type="number" placeholder="0.00" aria-label="Amount" />
      <InputGroupAddon align="inline-start">
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupText>USD</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const TextareaAction: Story = {
  render: () => (
    <InputGroup>
      <InputGroupTextarea placeholder="Write a message..." aria-label="Message" />
      <InputGroupAddon align="block-end">
        <InputGroupButton>
          <Send data-icon="inline-start" />
          Send
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const Loading: Story = {
  render: () => (
    <InputGroup>
      <InputGroupInput placeholder="Searching..." aria-label="Search query" />
      <InputGroupAddon align="inline-end">
        <Spinner />
      </InputGroupAddon>
    </InputGroup>
  ),
}

export const States: Story = {
  render: () => (
    <div className="grid gap-4">
      <InputGroup>
        <InputGroupInput disabled defaultValue="Disabled" aria-label="Disabled input" />
      </InputGroup>
      <InputGroup>
        <InputGroupInput aria-invalid defaultValue="Invalid" aria-label="Invalid input" />
      </InputGroup>
    </div>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <InputGroup>
        <InputGroupInput placeholder="ابحث..." aria-label="بحث" />
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="مسح">
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}
