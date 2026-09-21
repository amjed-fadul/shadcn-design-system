import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderOpen, Plus } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

const meta = {
  title: "Components/Empty",
  component: Empty,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Empty>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Empty className="min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>No projects yet</EmptyTitle>
        <EmptyDescription>
          Create your first project to start organizing your work.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </EmptyContent>
    </Empty>
  ),
}

export const Outline: Story = {
  render: () => (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>
          Try adjusting your filters or search terms.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
}

export const WithAvatar: Story = {
  render: () => (
    <Empty className="min-h-72">
      <EmptyHeader>
        <EmptyMedia>
          <Avatar size="lg">
            <AvatarFallback>AF</AvatarFallback>
          </Avatar>
        </EmptyMedia>
        <EmptyTitle>No teammates yet</EmptyTitle>
        <EmptyDescription>
          Invite teammates to collaborate in this workspace.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline">Invite teammate</Button>
      </EmptyContent>
    </Empty>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Empty className="min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>لا توجد مشاريع بعد</EmptyTitle>
          <EmptyDescription>
            أنشئ مشروعك الأول لبدء تنظيم العمل.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>
            <Plus data-icon="inline-start" />
            مشروع جديد
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
}
