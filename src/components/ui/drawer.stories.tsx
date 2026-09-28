import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

const meta = {
  title: "Components/Drawer",
  component: Drawer,
  parameters: {
    layout: "centered",
  },
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>
            Make changes to your profile here.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
          <Button>Save changes</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
} satisfies Meta<typeof Drawer>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

function DirectionStory({
  direction,
}: {
  direction: "top" | "bottom" | "left" | "right"
}) {
  return (
    <Drawer direction={direction}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open {direction}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{direction} drawer</DrawerTitle>
          <DrawerDescription>
            Drawer positioned from the {direction}.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const Top: Story = {
  render: () => <DirectionStory direction="top" />,
}

export const Left: Story = {
  render: () => <DirectionStory direction="left" />,
}

export const Right: Story = {
  render: () => <DirectionStory direction="right" />,
}


export const ScrollableContent: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open scrollable drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Release notes</DrawerTitle>
          <DrawerDescription>
            Content can scroll while the footer actions remain available.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[40vh] overflow-y-auto px-4">
          {Array.from({ length: 12 }, (_, index) => (
            <p className="mb-4 text-sm" key={index}>
              Drawer content section {index + 1}. This content demonstrates a
              scrollable region inside the drawer.
            </p>
          ))}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
}

function ControlledDrawerStory() {
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">{open ? "Drawer open" : "Open controlled drawer"}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Controlled drawer</DrawerTitle>
          <DrawerDescription>
            The open state is controlled by the story.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const Controlled: Story = {
  render: () => <ControlledDrawerStory />,
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Drawer direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">فتح الدرج</Button>
        </DrawerTrigger>
        <DrawerContent dir="rtl">
          <DrawerHeader>
            <DrawerTitle>تعديل الملف الشخصي</DrawerTitle>
            <DrawerDescription>
              عدّل بيانات الملف الشخصي من هذا الدرج.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DrawerClose>
            <Button>حفظ</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  ),
}
