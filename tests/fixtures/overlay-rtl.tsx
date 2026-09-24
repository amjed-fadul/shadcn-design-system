import * as React from "react"
import { createRoot } from "react-dom/client"
import "../../src/index.css"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "../../src/components/ui/alert-dialog"
import { CommandDialog, CommandInput, CommandItem, CommandList } from "../../src/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../src/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuShortcut, DropdownMenuTrigger } from "../../src/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../src/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../src/components/ui/sheet"

const query = new URLSearchParams(location.search)
const direction = query.get("dir") === "rtl" ? "rtl" : "ltr"
const kind = query.get("kind") ?? "dialog"
const side = query.get("side") === "left" ? "left" : "right"
document.documentElement.dir = direction

function Fixture() {
  const [selected, setSelected] = React.useState("")
  return <>
    <output id="selected">{selected}</output>
    {kind === "dialog" && <Dialog open><DialogContent><DialogHeader><DialogTitle>Dialog title</DialogTitle><DialogDescription>Dialog content</DialogDescription></DialogHeader></DialogContent></Dialog>}
    {kind === "command" && <CommandDialog open title="Commands"><CommandInput placeholder={direction === "rtl" ? "ابحث عن أمر..." : "Search commands..."} /><CommandList><CommandItem value="alpha" onSelect={() => setSelected("alpha")}>Alpha</CommandItem><CommandItem value="beta" onSelect={() => setSelected("beta")}>Beta</CommandItem></CommandList></CommandDialog>}
    {kind === "sheet" && <Sheet open><SheetContent side={side}><SheetHeader><SheetTitle>Sheet title</SheetTitle><SheetDescription>Sheet content</SheetDescription></SheetHeader></SheetContent></Sheet>}
    {kind === "alert" && <AlertDialog open><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Alert title</AlertDialogTitle></AlertDialogHeader></AlertDialogContent></AlertDialog>}
    {kind === "select" && <Select open dir={direction} defaultValue="alpha"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alpha">Alpha</SelectItem><SelectItem value="beta">Beta</SelectItem></SelectContent></Select>}
    {kind === "dropdown" && <DropdownMenu open dir={direction}><DropdownMenuTrigger>Open</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel inset>Actions</DropdownMenuLabel><DropdownMenuItem inset>Action<DropdownMenuShortcut>⌘A</DropdownMenuShortcut></DropdownMenuItem><DropdownMenuCheckboxItem checked>Enabled</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>}
  </>
}

createRoot(document.getElementById("root")!).render(<Fixture />)
