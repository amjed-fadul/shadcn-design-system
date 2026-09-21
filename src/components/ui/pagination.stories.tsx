import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="?page=1" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="?page=1">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="?page=2" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="?page=3">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="?page=3" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
}

export const Simple: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href="?page=1">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="?page=2" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="?page=3">3</PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
}

export const IconsOnly: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="?page=1"
            text=""
            aria-label="Previous page"
            size="icon"
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="?page=3"
            text=""
            aria-label="Next page"
            size="icon"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
}

export const Rtl: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <div dir="rtl">
      <Pagination aria-label="التنقل بين الصفحات">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="?page=1"
              text="السابق"
              aria-label="الانتقال إلى الصفحة السابقة"
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?page=1">١</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?page=2" isActive>
              ٢
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?page=3">٣</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="?page=3"
              text="التالي"
              aria-label="الانتقال إلى الصفحة التالية"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  ),
}
