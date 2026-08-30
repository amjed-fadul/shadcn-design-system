"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SidebarContextValue = { open: boolean; setOpen: (open: boolean) => void; toggleSidebar: () => void }
const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.")
  return context
}

function SidebarProvider({ defaultOpen = true, open: openProp, onOpenChange, className, children, ...props }: React.ComponentProps<"div"> & { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = openProp ?? internalOpen
  const setOpen = React.useCallback((next: boolean) => { onOpenChange?.(next); if (openProp === undefined) setInternalOpen(next) }, [onOpenChange, openProp])
  const value = React.useMemo(() => ({ open, setOpen, toggleSidebar: () => setOpen(!open) }), [open, setOpen])
  return <SidebarContext.Provider value={value}><div data-slot="sidebar-wrapper" className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)} {...props}>{children}</div></SidebarContext.Provider>
}

function Sidebar({ side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, ...props }: React.ComponentProps<"aside"> & { side?: "left" | "right"; variant?: "sidebar" | "floating" | "inset"; collapsible?: "offcanvas" | "icon" | "none" }) {
  const { open } = useSidebar()
  return <aside data-slot="sidebar" data-side={side} data-variant={variant} data-state={open ? "expanded" : "collapsed"} data-collapsible={open ? "" : collapsible} className={cn("flex h-full min-h-svh w-64 flex-col border-r bg-sidebar text-sidebar-foreground", side === "right" && "border-r-0 border-l", collapsible === "icon" && !open && "w-12", collapsible === "offcanvas" && !open && "-ml-64", className)} {...props}>{children}</aside>
}

function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) { const { toggleSidebar } = useSidebar(); return <Button data-slot="sidebar-trigger" variant="ghost" size="icon" className={className} onClick={toggleSidebar} {...props}><PanelLeft className="size-4" /><span className="sr-only">Toggle Sidebar</span></Button> }
function SidebarRail({ className, ...props }: React.ComponentProps<"button">) { const { toggleSidebar } = useSidebar(); return <button data-slot="sidebar-rail" aria-label="Toggle Sidebar" className={cn("absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all after:absolute after:inset-y-0 after:left-1/2 after:w-px hover:after:bg-border sm:flex", className)} onClick={toggleSidebar} {...props} /> }
function SidebarInset({ className, ...props }: React.ComponentProps<"main">) { return <main data-slot="sidebar-inset" className={cn("relative flex w-full flex-1 flex-col bg-background", className)} {...props} /> }
function SidebarInput({ className, ...props }: React.ComponentProps<"input">) { return <input data-slot="sidebar-input" className={cn("h-8 w-full rounded-md bg-background shadow-none", className)} {...props} /> }
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} /> }
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} /> }
function SidebarSeparator({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-separator" role="separator" className={cn("mx-2 h-px bg-sidebar-border", className)} {...props} /> }
function SidebarContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)} {...props} /> }
function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} /> }
function SidebarGroupLabel({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) { const Comp = asChild ? Slot.Root : "div"; return <Comp data-slot="sidebar-group-label" className={cn("flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70", className)} {...props} /> }
function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} /> }
function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) { return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} /> }
function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) { return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} /> }
function SidebarMenuButton({ className, asChild = false, isActive = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) { const Comp = asChild ? Slot.Root : "button"; return <Comp data-slot="sidebar-menu-button" data-active={isActive} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium", className)} {...props} /> }
function SidebarMenuAction({ className, asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) { const Comp = asChild ? Slot.Root : "button"; return <Comp data-slot="sidebar-menu-action" className={cn("absolute right-1 top-1.5 flex size-5 items-center justify-center rounded-md hover:bg-sidebar-accent", className)} {...props} /> }

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar }
