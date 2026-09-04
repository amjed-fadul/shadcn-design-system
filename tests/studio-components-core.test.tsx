// @vitest-environment jsdom

import { act, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { Card, CardContent, CardTitle } from "../src/components/ui/card"
import { Checkbox } from "../src/components/ui/checkbox"
import { Label } from "../src/components/ui/label"
import { ScrollArea } from "../src/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select"
import { Sidebar, SidebarContent, SidebarProvider } from "../src/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../src/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs"
import { Textarea } from "../src/components/ui/textarea"
import { render } from "./studio-test-utils"

describe("Studio V1 core component foundation", () => {
  test("renders simple layout and form primitives with semantic slots", () => {
    const markup = renderToStaticMarkup(
      <>
        <Card>
          <CardTitle>Settings</CardTitle>
          <CardContent>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" aria-label="Description" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Button</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <SidebarProvider>
          <Sidebar collapsible="none">
            <SidebarContent>Studio navigation</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </>
    )

    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="label"')
    expect(markup).toContain('data-slot="textarea"')
    expect(markup).toContain('data-slot="table"')
    expect(markup).toContain('for="description"')
    expect(markup).toContain('data-slot="sidebar"')
  })

  test("updates a controlled checkbox through its public callback", () => {
    function Harness() {
      const [checked, setChecked] = useState(false)

      return (
        <>
          <Checkbox aria-label="Include deprecated" checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          <output>{String(checked)}</output>
        </>
      )
    }

    const container = render(<Harness />)
    const checkbox = container.querySelector('[role="checkbox"]')

    expect(checkbox).not.toBeNull()
    expect(checkbox?.getAttribute("aria-checked")).toBe("false")

    act(() => checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(checkbox?.getAttribute("aria-checked")).toBe("true")
    expect(container.querySelector("output")?.textContent).toBe("true")
  })

  test("changes the active tab and exposes only the selected panel", async () => {
    const container = render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="usage">Usage panel</TabsContent>
      </Tabs>
    )

    const usage = container.querySelector('[role="tab"][data-state="inactive"]') as HTMLButtonElement
    expect(container.querySelector('[role="tabpanel"][data-state="active"]')?.textContent).toContain("Overview panel")

    await act(async () => usage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })))

    expect(container.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain("Usage")
    expect(container.querySelector('[role="tabpanel"][data-state="active"]')?.textContent).toContain("Usage panel")
  })

  test("selects an item through the controlled Select composition", async () => {
    function Harness() {
      const [value, setValue] = useState("neutral")

      return (
        <>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger aria-label="Theme">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="contrast">Contrast</SelectItem>
            </SelectContent>
          </Select>
          <output>{value}</output>
        </>
      )
    }

    const container = render(<Harness />)
    const trigger = container.querySelector('[role="combobox"]') as HTMLButtonElement

    await act(async () => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }))
      trigger.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }))
    })
    const option = document.body.querySelectorAll('[role="option"]')[1] as HTMLElement
    expect(option).not.toBeNull()

    await act(async () => option.click())

    expect(container.querySelector("output")?.textContent).toBe("contrast")
  })

  test("creates a scroll-area viewport for long content", () => {
    const container = render(
      <ScrollArea type="always" className="h-20">
        <div>Token content</div>
      </ScrollArea>
    )

    expect(container.querySelector('[data-slot="scroll-area"]')).not.toBeNull()
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    expect(viewport).not.toBeNull()
    expect(viewport?.getAttribute("tabindex")).toBe("0")
    expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).not.toBeNull()
  })
})
