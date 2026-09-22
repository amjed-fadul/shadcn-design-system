import type { Meta, StoryObj } from "@storybook/react-vite"

import { Label } from "@/components/ui/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"

const meta = {
  title: "Components/Radio Group",
  component: RadioGroup,
  args: {
    defaultValue: "option-one",
    orientation: "vertical",
    disabled: false,
    required: false,
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
  },
  parameters: {
    controls: {
      include: ["orientation", "disabled", "required"],
    },
  },
  render: (args) => (
    <RadioGroup {...args} name="example-options">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="option-one" id="option-one" />
        <Label htmlFor="option-one">Option One</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="option-two" id="option-two" />
        <Label htmlFor="option-two">Option Two</Label>
      </div>
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const DisabledItem: Story = {
  render: () => (
    <RadioGroup defaultValue="available" name="availability">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="available" id="available" />
        <Label htmlFor="available">Available</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="unavailable" id="unavailable" disabled />
        <Label htmlFor="unavailable">Unavailable</Label>
      </div>
    </RadioGroup>
  ),
}

export const Invalid: Story = {
  render: () => (
    <RadioGroup name="invalid-example" aria-label="Selection with an error">
      <div className="flex items-center gap-3">
        <RadioGroupItem value="one" id="invalid-one" aria-invalid />
        <Label htmlFor="invalid-one">First choice</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="two" id="invalid-two" aria-invalid />
        <Label htmlFor="invalid-two">Second choice</Label>
      </div>
    </RadioGroup>
  ),
}

export const Horizontal: Story = {
  render: () => (
    <RadioGroup
      defaultValue="monthly"
      name="billing-cycle"
      orientation="horizontal"
      className="flex w-fit gap-6"
    >
      <div className="flex items-center gap-3">
        <RadioGroupItem value="monthly" id="monthly" />
        <Label htmlFor="monthly">Monthly</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="yearly" id="yearly" />
        <Label htmlFor="yearly">Yearly</Label>
      </div>
    </RadioGroup>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <RadioGroup defaultValue="first" name="rtl-options" dir="rtl">
        <div className="flex items-center gap-3">
          <RadioGroupItem value="first" id="rtl-first" />
          <Label htmlFor="rtl-first">الخيار الأول</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="second" id="rtl-second" />
          <Label htmlFor="rtl-second">الخيار الثاني</Label>
        </div>
      </RadioGroup>
    </div>
  ),
}
