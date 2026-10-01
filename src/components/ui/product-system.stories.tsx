import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within, waitFor } from "storybook/test"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle, Status } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle, Form } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const meta = {
  title: "System/Product UI",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function FormsExample() {
  const [saved, setSaved] = React.useState(false)
  const [plan, setPlan] = React.useState("team")
  const [view, setView] = React.useState("list")
  const [notifications, setNotifications] = React.useState(true)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-medium">Workspace preferences</h1>
            <p className="text-sm text-muted-foreground">A composed set of product controls and form states.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">Cancel</Button>
          <Button loading={saved} onClick={() => setSaved(true)}><Icon name="check" placement="inline-start" />Save changes</Button>
        </div>
      </header>

      <section aria-labelledby="form-actions-heading" className="flex flex-col gap-4">
        <h2 id="form-actions-heading" className="text-sm font-medium">Actions and sizes</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Continue</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button><Button variant="destructive">Remove</Button><Button variant="link">Learn more</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">Extra small</Button><Button size="sm">Small</Button><Button>Default</Button><Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search"><Icon name="search" /></Button>
          <Button size="icon-sm" variant="outline" aria-label="Close"><Icon name="x" /></Button>
          <Button disabled>Disabled</Button><Button loading>Saving</Button>
        </div>
      </section>

      <Form className="grid gap-8 lg:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setSaved(true) }}>
        <FieldSet>
            <FieldLegend variant="label">Profile details</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-name">Workspace name</FieldLabel>
              <Input id="profile-name" name="workspace" defaultValue="Northstar Studio" />
              <FieldDescription>Choose a name your team will recognize.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Contact email</FieldLabel>
              <Input id="profile-email" name="email" type="email" defaultValue="team@example.com" aria-invalid="true" />
              <FieldError>Enter a verified team email address.</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-notes">Description</FieldLabel>
              <Textarea id="profile-notes" name="description" defaultValue="A shared place for project updates and decisions." />
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-plan">Plan</FieldLabel>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="workspace-plan" aria-label="Plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem><SelectItem value="team">Team</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-region">Workspace region</FieldLabel>
              <Select defaultValue="eu" disabled>
                <SelectTrigger id="workspace-region" aria-label="Workspace region" disabled><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="eu">Europe</SelectItem></SelectContent>
              </Select>
              <FieldDescription>Region is locked after workspace creation.</FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>

        <div className="flex flex-col gap-6">
          <FieldSet>
            <FieldLegend variant="label">Access and notifications</FieldLegend>
            <FieldGroup>
              <Field orientation="horizontal">
                <Checkbox id="invite-members" defaultChecked />
                <FieldContent><FieldLabel htmlFor="invite-members">Allow member invitations</FieldLabel><FieldDescription>Members can invite teammates to this workspace.</FieldDescription></FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
                <FieldContent><FieldLabel htmlFor="notifications">Email notifications</FieldLabel><FieldDescription>Send a daily summary of workspace activity.</FieldDescription></FieldContent>
              </Field>
              <Field orientation="horizontal" data-disabled="true">
                <Switch id="audit-log" disabled /><FieldContent><FieldLabel htmlFor="audit-log">Audit log</FieldLabel><FieldDescription>Available on the Enterprise plan.</FieldDescription></FieldContent>
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Default view</FieldLegend>
            <RadioGroup value={view} onValueChange={setView} aria-label="Default view">
              <Field orientation="horizontal"><RadioGroupItem value="list" id="view-list" /><FieldContent><FieldLabel htmlFor="view-list">List</FieldLabel><FieldDescription>Compact rows with key details.</FieldDescription></FieldContent></Field>
              <Field orientation="horizontal"><RadioGroupItem value="board" id="view-board" /><FieldContent><FieldLabel htmlFor="view-board">Board</FieldLabel><FieldDescription>Group work into columns.</FieldDescription></FieldContent></Field>
              <Field orientation="horizontal"><RadioGroupItem value="calendar" id="view-calendar" disabled /><FieldContent><FieldLabel htmlFor="view-calendar">Calendar</FieldLabel><FieldDescription>Requires a connected calendar.</FieldDescription></FieldContent></Field>
            </RadioGroup>
          </FieldSet>

          <Field>
            <FieldLabel htmlFor="seat-limit">Seat limit</FieldLabel>
            <Slider id="seat-limit" defaultValue={[18]} min={1} max={50} thumbAriaLabels={["Seat limit"]} />
            <FieldDescription>18 seats selected out of 50.</FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Display options</FieldLegend>
            <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value)} aria-label="Display mode">
              <ToggleGroupItem value="list" aria-label="List display">List</ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board display">Board</ToggleGroupItem>
              <ToggleGroupItem value="calendar" aria-label="Calendar display" disabled>Calendar</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle aria-label="Pin workspace" defaultPressed><Icon name="check" />Pinned</Toggle>
              <Toggle aria-label="Mark as favorite" aria-invalid="true">Favorite</Toggle>
              <Toggle aria-label="Disabled option" disabled>Disabled</Toggle>
            </div>
          </FieldSet>
        </div>
      </Form>

      <Separator />
      <div className="grid gap-6 md:grid-cols-2">
        <FieldSet>
          <FieldLegend variant="label">Input group</FieldLegend>
          <FieldDescription>Addon, control, and action stay inside the component group.</FieldDescription>
          <InputGroup>
            <InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>
            <InputGroupInput aria-label="Workspace URL" defaultValue="northstar.example.com" />
            <InputGroupAddon align="inline-end"><InputGroupButton aria-label="Copy workspace URL"><Icon name="check" /></InputGroupButton></InputGroupAddon>
          </InputGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">Field states</FieldLegend>
          <Field data-invalid="true"><FieldTitle>Required field</FieldTitle><Input aria-label="Required field" aria-invalid="true" placeholder="Add a value" /><FieldError>This field needs attention.</FieldError></Field>
        </FieldSet>
      </div>
    </div>
  )
}

export const Forms: Story = {
  render: () => <FormsExample />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Workspace preferences" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Saving" })).toHaveAttribute("aria-busy", "true")
    await userEvent.click(canvas.getByRole("switch", { name: /Email notifications/ }))
    await expect(canvas.getByRole("switch", { name: /Email notifications/ })).toHaveAttribute("data-state", "unchecked")
    await userEvent.click(canvas.getByRole("radio", { name: "Board display" }))
    await expect(canvas.getByRole("radio", { name: "Board display" })).toHaveAttribute("data-state", "on")
    await userEvent.click(canvas.getByRole("button", { name: /Save changes/ }))
  },
}

function DataWorkspaceExample() {
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(1)
  const rows = [
    { name: "Website refresh", owner: "Mina Patel", status: "In progress", due: "Oct 12" },
    { name: "Mobile onboarding", owner: "Omar Ali", status: "Review", due: "Oct 16" },
    { name: "Billing updates", owner: "Lena Kim", status: "Planned", due: "Oct 21" },
  ].filter((row) => row.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-lg font-medium">Projects</h1><p className="text-sm text-muted-foreground">Track active work across your workspace.</p></div>
        <Button><Icon name="check" placement="inline-start" />New project</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="max-w-sm"><InputGroupAddon><Icon name="search" /></InputGroupAddon><InputGroupInput aria-label="Search projects" placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} /><InputGroupAddon align="inline-end"><InputGroupText>{rows.length} results</InputGroupText></InputGroupAddon></InputGroup>
        <div className="flex items-center gap-2"><Badge variant="secondary">{rows.length} active</Badge><Button variant="outline">Filter</Button></div>
      </div>
      <Table>
        <TableCaption>Project activity for this workspace.</TableCaption>
        <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Due date</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.name}><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.owner}</TableCell><TableCell><Badge variant={row.status === "In progress" ? "default" : "secondary"}>{row.status}</Badge></TableCell><TableCell>{row.due}</TableCell></TableRow>)}</TableBody>
      </Table>
      {rows.length === 0 && <Empty><EmptyHeader><EmptyTitle>No projects found</EmptyTitle><EmptyDescription>Try a different search term.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => setQuery("")}>Clear search</Button></EmptyContent></Empty>}
      <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#projects" onClick={(event) => { event.preventDefault(); setPage(Math.max(1, page - 1)) }} /></PaginationItem><PaginationItem><PaginationLink href="#projects" isActive aria-current="page" onClick={(event) => event.preventDefault()}>{page}</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#projects" onClick={(event) => { event.preventDefault(); setPage(page + 1) }} /></PaginationItem></PaginationContent></Pagination>
    </div>
  )
}

export const DataWorkspace: Story = {
  render: () => <DataWorkspaceExample />,
  play: async ({ canvas }) => {
    const search = canvas.getByRole("textbox", { name: "Search projects" })
    await userEvent.type(search, "billing")
    await expect(canvas.getByRole("cell", { name: "Billing updates" })).toBeVisible()
    await expect(canvas.queryByRole("cell", { name: "Website refresh" })).not.toBeInTheDocument()
    await userEvent.clear(search)
  },
}

function SettingsFormExample() {
  const [digest, setDigest] = React.useState(false)
  const [message, setMessage] = React.useState("Changes have not been saved.")
  return (
    <Form className="mx-auto flex w-full max-w-2xl flex-col gap-6" onSubmit={(event) => { event.preventDefault(); setMessage("Preferences saved.") }}>
      <header><h1 className="text-lg font-medium">Notification settings</h1><p className="text-sm text-muted-foreground">Choose what updates arrive in your inbox.</p></header>
      <FieldSet><FieldLegend>Email preferences</FieldLegend><FieldGroup>
        <Field orientation="horizontal"><Checkbox id="weekly-summary" defaultChecked /><FieldContent><FieldLabel htmlFor="weekly-summary">Weekly summary</FieldLabel><FieldDescription>A recap of project activity every Monday.</FieldDescription></FieldContent></Field>
        <Field orientation="horizontal"><Switch id="product-updates" checked={digest} onCheckedChange={setDigest} /><FieldContent><FieldLabel htmlFor="product-updates">Product updates</FieldLabel><FieldDescription>Announcements about features and improvements.</FieldDescription></FieldContent></Field>
        <Field><FieldLabel htmlFor="delivery-frequency">Delivery frequency</FieldLabel><Select defaultValue="daily"><SelectTrigger id="delivery-frequency" aria-label="Delivery frequency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realtime">As they happen</SelectItem><SelectItem value="daily">Daily digest</SelectItem><SelectItem value="weekly">Weekly digest</SelectItem></SelectContent></Select></Field>
      </FieldGroup></FieldSet>
      <div className="flex flex-wrap items-center justify-between gap-3"><Status>{message}</Status><Button type="submit">Save preferences</Button></div>
    </Form>
  )
}

export const SettingsForm: Story = {
  render: () => <SettingsFormExample />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save preferences" }))
    await expect(canvas.getByRole("status")).toHaveTextContent("Preferences saved.")
  },
}

function RecordDetailExample() {
  const [complete, setComplete] = React.useState(false)
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#workspace">Workspace</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink href="#projects">Projects</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Website refresh</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
      <header className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-medium">Website refresh</h1><Badge variant={complete ? "secondary" : "default"}>{complete ? "Complete" : "In progress"}</Badge></div><p className="text-sm text-muted-foreground">A focused update to the public website and onboarding flow.</p></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Icon name="more-horizontal" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>Project actions</DropdownMenuLabel><DropdownMenuItem onSelect={() => setComplete(true)}>Mark complete</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive">Archive project</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header>
      <Separator />
      <div className="grid gap-6 md:grid-cols-2"><section className="flex flex-col gap-3"><h2 className="text-sm font-medium">Project progress</h2><div className="flex items-center justify-between text-sm"><span>Tasks completed</span><span>18 of 24</span></div><Progress value={75} aria-label="Project progress" /><p className="text-sm text-muted-foreground">Next review is scheduled for October 12.</p></section><section className="flex flex-col gap-3"><h2 className="text-sm font-medium">Project team</h2><AvatarGroup><Avatar><AvatarFallback>MP</AvatarFallback></Avatar><Avatar><AvatarFallback>OA</AvatarFallback></Avatar><Avatar><AvatarFallback>LK</AvatarFallback></Avatar><AvatarGroupCount>+2</AvatarGroupCount></AvatarGroup><p className="text-sm text-muted-foreground">Five people have access to this project.</p></section></div>
      <Tabs defaultValue="activity"><TabsList aria-label="Project details"><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList><TabsContent value="activity"><Table><TableHeader><TableRow><TableHead>Update</TableHead><TableHead>Owner</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Homepage review completed</TableCell><TableCell>Mina Patel</TableCell><TableCell>Today</TableCell></TableRow><TableRow><TableCell>Copy draft shared</TableCell><TableCell>Omar Ali</TableCell><TableCell>Yesterday</TableCell></TableRow></TableBody></Table></TabsContent><TabsContent value="files"><Empty><EmptyHeader><EmptyTitle>No files attached</EmptyTitle><EmptyDescription>Files shared with the project will appear here.</EmptyDescription></EmptyHeader></Empty></TabsContent><TabsContent value="details"><p className="text-sm text-muted-foreground">Owned by the Design team. Created September 8.</p></TabsContent></Tabs>
    </article>
  )
}

export const RecordDetail: Story = {
  render: () => <RecordDetailExample />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Actions" }))
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Mark complete" }))
    await expect(canvas.getByText("Complete")).toBeVisible()
    await userEvent.click(await canvas.findByRole("tab", { name: "Files" }))
    await expect(canvas.getByText("No files attached")).toBeVisible()
  },
}

function SidePanelFormExample() {
  const [open, setOpen] = React.useState(false)
  const [created, setCreated] = React.useState(false)
  return (
    <div className="flex flex-col gap-4"><h1 className="text-lg font-medium">Project workspace</h1><p className="text-sm text-muted-foreground">Create a project from the side panel.</p>
      <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button><Icon name="check" placement="inline-start" />Create project</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>New project</SheetTitle><SheetDescription>Add a name and owner to get started.</SheetDescription></SheetHeader><Form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); setCreated(true); setOpen(false) }}><Field><FieldLabel htmlFor="new-project-name">Project name</FieldLabel><Input id="new-project-name" required placeholder="Project name" /></Field><Field><FieldLabel htmlFor="new-project-owner">Owner</FieldLabel><Select defaultValue="mina"><SelectTrigger id="new-project-owner" aria-label="Owner"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mina">Mina Patel</SelectItem><SelectItem value="omar">Omar Ali</SelectItem></SelectContent></Select></Field><SheetFooter><Button type="submit">Save project</Button></SheetFooter></Form></SheetContent></Sheet>
      {created && <Status>Project created.</Status>}
    </div>
  )
}

export const SidePanelForm: Story = {
  render: () => <SidePanelFormExample />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Create project" }))
    const page = within(document.body)
    await expect(await page.findByRole("heading", { name: "New project" })).toBeVisible()
    await userEvent.type(page.getByRole("textbox", { name: "Project name" }), "Research portal")
    await userEvent.click(page.getByRole("button", { name: "Save project" }))
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Project created."))
  },
}

export const EmptyWorkspace: Story = {
  render: () => <Empty><EmptyHeader><EmptyMedia variant="icon"><Icon name="search" /></EmptyMedia><EmptyTitle><h1>No projects yet</h1></EmptyTitle><EmptyDescription>Create a project to start planning and sharing work with your team.</EmptyDescription></EmptyHeader><EmptyContent><Button>Create your first project</Button><Button variant="outline">Import projects</Button></EmptyContent></Empty>,
  play: async ({ canvas }) => { await expect(canvas.getByRole("heading", { name: "No projects yet" })).toBeVisible(); await expect(canvas.getByRole("button", { name: "Create your first project" })).toBeEnabled() },
}

function CommandSearchExample() {
  const [selected, setSelected] = React.useState("")
  return <div className="flex w-full max-w-md flex-col gap-4"><h1 className="text-lg font-medium">Quick actions</h1><Command label="Search for a command" className="border"><CommandInput aria-label="Search for a command" placeholder="Search for a command" /><CommandList><CommandEmpty>No matching commands.</CommandEmpty><CommandGroup heading="Workspace"><CommandItem value="create project" onSelect={() => setSelected("Create project selected")}>Create project</CommandItem><CommandItem value="invite member" onSelect={() => setSelected("Invite member selected")}>Invite member</CommandItem><CommandItem value="search records" onSelect={() => setSelected("Search records selected")}>Search records</CommandItem></CommandGroup></CommandList></Command>{selected && <Status>{selected}</Status>}</div>
}

export const CommandSearch: Story = {
  render: () => <CommandSearchExample />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Search for a command" }), "invite")
    await expect(canvas.getByRole("option", { name: "Invite member" })).toBeVisible()
    await userEvent.click(canvas.getByRole("option", { name: "Invite member" }))
    await expect(canvas.getByRole("status")).toHaveTextContent("Invite member selected")
  },
}

function NavigationDataExample() {
  const [section, setSection] = React.useState("Overview")
  return <SidebarProvider className="min-h-[32rem] overflow-hidden rounded-md border"><Sidebar collapsible="none" role="navigation" aria-label="Workspace navigation"><SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive>Northstar</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{["Overview", "Projects", "Reports"].map((item) => <SidebarMenuItem key={item}><SidebarMenuButton isActive={section === item} onClick={() => setSection(item)}>{item}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton><Avatar size="sm"><AvatarFallback>MP</AvatarFallback></Avatar>Mina Patel</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar><SidebarInset><header className="flex items-center gap-3 border-b p-4"><SidebarTrigger /><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#workspace">Workspace</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{section}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></header><section aria-label="Workspace content" className="flex flex-col gap-5 p-6"><div><h1 className="text-lg font-medium">{section}</h1><p className="text-sm text-muted-foreground">A shared view of current workspace activity.</p></div><Tabs defaultValue="recent"><TabsList aria-label="Activity views"><TabsTrigger value="recent">Recent</TabsTrigger><TabsTrigger value="assigned">Assigned to me</TabsTrigger></TabsList><TabsContent value="recent"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Website refresh</TableCell><TableCell>Today</TableCell></TableRow><TableRow><TableCell>Mobile onboarding</TableCell><TableCell>Yesterday</TableCell></TableRow></TableBody></Table></TabsContent><TabsContent value="assigned"><p className="text-sm text-muted-foreground">No items are assigned to you.</p></TabsContent></Tabs></section></SidebarInset></SidebarProvider>
}

export const NavigationData: Story = {
  parameters: { providesDocumentLandmarks: true },
  render: () => <NavigationDataExample />,
  play: async ({ canvas }) => { await userEvent.click(canvas.getByRole("button", { name: "Projects" })); await expect(canvas.getByRole("heading", { name: "Projects" })).toBeVisible(); await userEvent.click(canvas.getByRole("tab", { name: "Assigned to me" })); await expect(canvas.getByText("No items are assigned to you.")).toBeVisible() },
}

export const MenusOverlays: Story = {
  render: () => <TooltipProvider><div className="flex flex-wrap items-center gap-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Open menu</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuCheckboxItem checked>Show details</DropdownMenuCheckboxItem><DropdownMenuSeparator /><DropdownMenuItem>Duplicate</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Popover><PopoverTrigger asChild><Button variant="secondary">Open popover</Button></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>Share workspace</PopoverTitle><PopoverDescription>Invite a teammate to join the workspace.</PopoverDescription></PopoverHeader><Field className="mt-3"><FieldLabel htmlFor="share-email">Email address</FieldLabel><Input id="share-email" type="email" placeholder="name@example.com" /></Field><Button className="mt-3">Send invite</Button></PopoverContent></Popover><Dialog><DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Rename workspace</DialogTitle><DialogDescription>Choose a clear name for your team.</DialogDescription></DialogHeader><Field><FieldLabel htmlFor="rename-workspace">Workspace name</FieldLabel><Input id="rename-workspace" defaultValue="Northstar" /></Field><DialogFooter><Button>Save name</Button></DialogFooter></DialogContent></Dialog><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive">Delete project</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this project?</AlertDialogTitle><AlertDialogDescription>This action will permanently remove the project and its activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive">Delete project</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Sheet><SheetTrigger asChild><Button variant="outline">Open sheet</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Project details</SheetTitle><SheetDescription>Additional information for this project.</SheetDescription></SheetHeader><p className="text-sm">The sheet keeps related actions close to the current view.</p></SheetContent></Sheet><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="More information"><Icon name="info" /></Button></TooltipTrigger><TooltipContent>More information</TooltipContent></Tooltip></div></TooltipProvider>,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open menu" }))
    await waitFor(() => expect(within(document.body).getByRole("menuitemcheckbox", { name: "Show details" })).toBeVisible())
    await userEvent.keyboard("{Escape}")
    await userEvent.click(await canvas.findByRole("button", { name: "Open dialog" }))
    await waitFor(() => expect(within(document.body).getByRole("heading", { name: "Rename workspace" })).toBeVisible())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull())
  },
}

export const FeedbackDisclosure: Story = {
  render: () => <div className="flex w-full max-w-2xl flex-col gap-6"><Status>Your workspace is up to date.</Status><Alert><Icon name="info" /><AlertTitle>Review complete</AlertTitle><AlertDescription>All required details are present. You can continue with the next step.</AlertDescription></Alert><Alert variant="destructive"><Icon name="alert-circle" /><AlertTitle>Action needed</AlertTitle><AlertDescription>One member invitation could not be delivered.</AlertDescription></Alert><div className="flex flex-col gap-2"><div className="flex justify-between text-sm"><span>Storage used</span><span>72%</span></div><Progress value={72} aria-label="Storage used" /></div><Accordion type="single" collapsible><AccordionItem value="history"><AccordionTrigger>What changed?</AccordionTrigger><AccordionContent>The workspace settings were updated by Mina Patel this morning.</AccordionContent></AccordionItem><AccordionItem value="help"><AccordionTrigger>Need help?</AccordionTrigger><AccordionContent>Contact your workspace administrator for access or billing questions.</AccordionContent></AccordionItem></Accordion><Collapsible><CollapsibleTrigger asChild><Button variant="outline">Show advanced details</Button></CollapsibleTrigger><CollapsibleContent><p className="mt-3 text-sm text-muted-foreground">Workspace ID: ws-northstar-1842</p></CollapsibleContent></Collapsible></div>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Your workspace is up to date.")
    await userEvent.click(canvas.getByRole("button", { name: "What changed?" }))
    await expect(canvas.getByText(/settings were updated/)).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Show advanced details" }))
    await expect(canvas.getByText(/Workspace ID/)).toBeVisible()
  },
}
