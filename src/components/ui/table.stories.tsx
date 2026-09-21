import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const meta = {
  title: "Components/Table",
  component: Table,
  parameters: {
    controls: {
      include: [],
    },
  },
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Design review</TableCell>
          <TableCell>Complete</TableCell>
          <TableCell className="text-right">$120</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Content audit</TableCell>
          <TableCell>In progress</TableCell>
          <TableCell className="text-right">$80</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}

export const CompleteComposition: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <Table>
      <TableCaption>A summary of this month&apos;s invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">INV-001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell className="text-right">Card</TableCell>
          <TableCell className="text-right">$250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">INV-002</TableCell>
          <TableCell>Pending</TableCell>
          <TableCell className="text-right">Bank transfer</TableCell>
          <TableCell className="text-right">$180.00</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">$430.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}
