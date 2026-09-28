import type { Meta, StoryObj } from "@storybook/react-vite"

import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"

const meta = {
  title: "Components/Field",
  component: Field,
  args: {
    orientation: "vertical",
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
  parameters: {
    controls: {
      include: ["orientation"],
    },
  },
  render: (args) => (
    <Field {...args}>
      <FieldLabel htmlFor="field-email">Email</FieldLabel>
      <Input id="field-email" type="email" placeholder="name@example.com" />
      <FieldDescription>We’ll only use this for account updates.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Fieldset: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>Profile</FieldLegend>
      <FieldDescription>This information appears in your account.</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
          <Input id="profile-name" />
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="profile-username">Username</FieldLabel>
          <Input id="profile-username" aria-invalid />
          <FieldError>Choose another username.</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
}

export const HorizontalSwitch: Story = {
  render: () => (
    <Field orientation="horizontal">
      <Switch id="newsletter" />
      <FieldContent>
        <FieldLabel htmlFor="newsletter">Newsletter</FieldLabel>
        <FieldDescription>Receive product news by email.</FieldDescription>
      </FieldContent>
    </Field>
  ),
}

export const RadioChoices: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend variant="label">Plan</FieldLegend>
      <RadioGroup defaultValue="monthly" name="field-plan">
        <Field orientation="horizontal">
          <RadioGroupItem value="monthly" id="field-monthly" />
          <FieldLabel htmlFor="field-monthly">Monthly</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="yearly" id="field-yearly" />
          <FieldLabel htmlFor="field-yearly">Yearly</FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  ),
}

export const WithSeparatorAndSlider: Story = {
  render: () => (
    <FieldGroup>
      <Field>
        <FieldTitle>Volume</FieldTitle>
        <Slider defaultValue={[40]} thumbAriaLabels={["Volume"]} />
      </Field>
      <FieldSeparator>Advanced</FieldSeparator>
      <Field>
        <FieldTitle>Notifications</FieldTitle>
        <FieldDescription>Configure this later in settings.</FieldDescription>
      </Field>
    </FieldGroup>
  ),
}

export const MultipleErrors: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="field-password">Password</FieldLabel>
      <Input id="field-password" type="password" aria-invalid />
      <FieldError
        errors={[
          { message: "Use at least 12 characters." },
          { message: "Add at least one number." },
          { message: "Use at least 12 characters." },
        ]}
      />
    </Field>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <FieldSet>
        <FieldLegend>الملف الشخصي</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rtl-name">الاسم الكامل</FieldLabel>
            <Input id="rtl-name" />
            <FieldDescription>سيظهر هذا الاسم في حسابك.</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Switch id="rtl-updates" />
            <FieldLabel htmlFor="rtl-updates">تحديثات البريد الإلكتروني</FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
}
