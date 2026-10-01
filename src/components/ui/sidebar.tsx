"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"
import { Slot } from "radix-ui"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"

type SidebarContextValue = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void
  openMobile: boolean
  setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)
const SidebarRuntimeContext = React.createContext<React.MutableRefObject<HTMLButtonElement | null> | null>(null)
const SidebarRenderContext = React.createContext<{ side: "left" | "right"; state: "expanded" | "collapsed" }>({ side: "left", state: "expanded" })

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.")
  return context
}

function useSidebarRuntime() {
  const context = React.useContext(SidebarRuntimeContext)
  if (!context) throw new Error("Sidebar runtime must be used within a SidebarProvider.")
  return context
}

function SidebarProvider({
  isMobile = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  defaultOpenMobile = false,
  openMobile: openMobileProp,
  onOpenMobileChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  isMobile?: boolean
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpenMobile?: boolean
  openMobile?: boolean
  onOpenMobileChange?: (open: boolean) => void
}) {
  const activeTriggerRef = React.useRef<HTMLButtonElement>(null)
  const [_openMobile, _setOpenMobile] = React.useState(defaultOpenMobile)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp !== undefined ? openProp : _open
  const openMobile = openMobileProp !== undefined ? openMobileProp : _openMobile

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (openProp === undefined) _setOpen(openState)
      onOpenChange?.(openState)
    },
    [onOpenChange, open, openProp]
  )

  const setOpenMobile = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(openMobile) : value
      if (openMobileProp === undefined) _setOpenMobile(openState)
      onOpenMobileChange?.(openState)
    },
    [onOpenMobileChange, openMobile, openMobileProp]
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((value) => !value) : setOpen((value) => !value)
  }, [isMobile, setOpen, setOpenMobile])

  const state = open ? "expanded" : "collapsed"
  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <SidebarRuntimeContext.Provider value={activeTriggerRef}>
        <div
          data-slot="sidebar-wrapper"
          data-mobile={isMobile || undefined}
          style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
          className={cn("group/sidebar-wrapper relative flex h-full min-h-0 w-full has-data-[variant=inset]:bg-sidebar", className)}
          {...props}
        >
          {children}
        </div>
      </SidebarRuntimeContext.Provider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  portalContainer,
  className,
  children,
  dir,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
  portalContainer?: React.ComponentProps<typeof SheetContent>["portalContainer"]
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
  const activeTriggerRef = useSidebarRuntime()
  const effectiveState = collapsible === "none" ? "expanded" : state
  const flowSpacer = <div data-slot="sidebar-flow-spacer" data-state={effectiveState} data-collapsible={effectiveState === "collapsed" ? collapsible : ""} data-side={side} className={cn("h-full shrink-0 w-(--sidebar-width) data-[collapsible=offcanvas]:w-0 data-[collapsible=icon]:w-(--sidebar-width-icon) data-[side=left]:order-first rtl:data-[side=left]:order-last data-[side=right]:order-last rtl:data-[side=right]:order-first", !isMobile && collapsible !== "none" && "transition-[width] duration-300 ease-out", (variant === "floating" || variant === "inset") && "data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+--spacing(4))]")} />

  if (collapsible === "none") {
    return <SidebarRenderContext.Provider value={{ side, state: effectiveState }}><>{flowSpacer}<div dir={dir} data-slot="sidebar" data-state={effectiveState} data-collapsible="" data-variant={variant} data-side={side} className={cn("absolute inset-y-0 flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground data-[side=left]:left-0 data-[side=right]:right-0", className)} style={style} {...props}>{children}</div></></SidebarRenderContext.Provider>
  }

  if (isMobile) {
    return (
      <SidebarRenderContext.Provider value={{ side, state: openMobile ? "expanded" : "collapsed" }}><Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          data-state={openMobile ? "expanded" : "collapsed"}
          data-collapsible={openMobile ? "" : collapsible}
          data-variant={variant}
          className={cn("w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden", className)}
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE, ...style } as React.CSSProperties}
          side={side}
          portalContainer={portalContainer}
          onCloseAutoFocus={(event) => {
            const opener = activeTriggerRef.current
            const checkVisibility = (opener as (HTMLButtonElement & { checkVisibility?: (options: { checkOpacity: boolean; checkVisibilityCSS: boolean }) => boolean }) | null)?.checkVisibility
            const canRestoreFocus = opener?.isConnected && !opener.hidden && !opener.disabled && opener.tabIndex >= 0 && opener.getAttribute("aria-hidden") !== "true" && opener.getClientRects().length > 0 && (checkVisibility ? checkVisibility.call(opener, { checkOpacity: true, checkVisibilityCSS: true }) : true)
            if (canRestoreFocus) {
              event.preventDefault()
              opener.focus()
            }
          }}
          {...props}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet></SidebarRenderContext.Provider>
    )
  }

  return (
    <SidebarRenderContext.Provider value={{ side, state: effectiveState }}><>{flowSpacer}<div dir={dir} className="group peer absolute inset-y-0 flex h-full w-(--sidebar-width) text-sidebar-foreground data-[side=left]:left-0 data-[side=right]:right-0" data-state={effectiveState} data-collapsible={effectiveState === "collapsed" ? collapsible : ""} data-variant={variant} data-side={side} data-slot="sidebar">
      <div data-slot="sidebar-gap" className={cn("relative w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-out", "group-data-[collapsible=offcanvas]:w-0", "group-data-[side=right]:rotate-180", variant === "floating" || variant === "inset" ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+--spacing(4))]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)")} />
      <div data-slot="sidebar-container" data-side={side} className={cn("absolute inset-y-0 z-10 flex h-full w-(--sidebar-width) transition-[left,right,width,transform] duration-300 ease-out data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:-translate-x-full data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:translate-x-full", variant === "floating" || variant === "inset" ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+--spacing(4)+2px)]" : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l", className)} style={style} {...props}>
        <div data-sidebar="sidebar" data-slot="sidebar-inner" className="flex size-full flex-col">{children}</div>
      </div>
    </div></></SidebarRenderContext.Provider>
  )
}

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ className, onClick, ...props }, forwardedRef) => {
  const { toggleSidebar } = useSidebar()
  const activeTriggerRef = useSidebarRuntime()
  return <Button ref={forwardedRef} data-sidebar="trigger" data-slot="sidebar-trigger" variant="ghost" size="icon-sm" className={className} onClick={(event) => { onClick?.(event); if (event.defaultPrevented) return; activeTriggerRef.current = event.currentTarget; toggleSidebar() }} {...props}><PanelLeft className="size-4" /><span className="sr-only">Toggle Sidebar</span></Button>
})
SidebarTrigger.displayName = "SidebarTrigger"

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { isMobile, toggleSidebar } = useSidebar()
  if (isMobile) return null
  return <button data-sidebar="rail" data-slot="sidebar-rail" aria-label="Toggle Sidebar" tabIndex={-1} onClick={toggleSidebar} title="Toggle Sidebar" className={cn("absolute inset-y-0 z-20 flex w-4 transition-[color,background-color,border-color,box-shadow] duration-100 ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] ltr:-translate-x-1/2 rtl:-translate-x-1/2 in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize [[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar [[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2", className)} {...props} />
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("relative flex w-full flex-1 flex-col bg-background", className)} {...props} />
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input data-sidebar="input" data-slot="sidebar-input" className={cn("h-8 w-full rounded-md bg-background shadow-none", className)} {...props} />
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="header" data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="footer" data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-sidebar="separator" data-slot="sidebar-separator" className={cn("mx-2 w-auto", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="content" data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group" data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
}

function SidebarGroupLabel({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"
  return <Comp data-sidebar="group-label" data-slot="sidebar-group-label" className={cn("flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70", className)} {...props} />
}

function SidebarGroupAction({ className, asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-sidebar="group-action" data-slot="sidebar-group-action" className={cn("flex aspect-square items-center justify-center rounded-md outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-150 group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 [&>svg]:shrink-0", className)} {...props} />
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group-content" data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-sidebar="menu" data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-sidebar="menu-item" data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-start text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span:last-child]:sr-only",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
        outline: "border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      size: { default: "h-7", sm: "h-6 text-xs", lg: "h-9 text-sm" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

const SidebarMenuButton = React.forwardRef<HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}, ref) => {
  const Comp = asChild ? Slot.Root : "button"
  const { isMobile, state } = useSidebar()
  const { side, state: effectiveState } = React.useContext(SidebarRenderContext)
  const button = <Comp ref={ref} data-sidebar="menu-button" data-slot="sidebar-menu-button" data-size={size} data-active={isActive} data-state={effectiveState} className={cn(sidebarMenuButtonVariants({ variant, size }), className)} {...props} />

  if (!tooltip) return button
  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip
  return <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side={side === "left" ? "right" : "left"} align="center" hidden={effectiveState !== "collapsed" || isMobile} {...tooltipProps} /></Tooltip>
})
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean; showOnHover?: boolean }>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp ref={ref} data-sidebar="menu-action" data-slot="sidebar-menu-action" className={cn("absolute end-1 top-0.5 flex size-6 items-center justify-center rounded-md outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-150 group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 [&>svg]:shrink-0", showOnHover && "opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100", className)} {...props} />
})
SidebarMenuAction.displayName = "SidebarMenuAction"

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="menu-badge" data-slot="sidebar-menu-badge" className={cn("flex items-center justify-center tabular-nums select-none group-data-[collapsible=icon]:hidden", className)} {...props} />
}

function SidebarMenuSkeleton({ className, showIcon = false, width = "70%", style, ...props }: React.ComponentProps<"div"> & { showIcon?: boolean; width?: React.CSSProperties["width"] }) {
  return <div data-sidebar="menu-skeleton" data-slot="sidebar-menu-skeleton" className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", className)} style={style} {...props}>{showIcon && <Skeleton data-sidebar="menu-skeleton-icon" data-slot="sidebar-menu-skeleton-icon" className="size-4 rounded-md" />}<Skeleton data-sidebar="menu-skeleton-text" data-slot="sidebar-menu-skeleton-text" className="h-4 max-w-(--skeleton-width) flex-1" style={{ "--skeleton-width": width } as React.CSSProperties} /></div>
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-sidebar="menu-sub" data-slot="sidebar-menu-sub" className={cn("mx-3.5 flex min-w-0 translate-x-px rtl:-translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5", className)} {...props} />
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-sidebar="menu-sub-item" data-slot="sidebar-menu-sub-item" className={cn("group/menu-sub-item relative", className)} {...props} />
}

function SidebarMenuSubButton({ asChild = false, size = "md", isActive = false, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean; size?: "sm" | "md"; isActive?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return <Comp data-sidebar="menu-sub-button" data-slot="sidebar-menu-sub-button" data-size={size} data-active={isActive} className={cn("flex min-w-0 -translate-x-px rtl:translate-x-px items-center h-7 gap-2 overflow-hidden rounded-md px-2 py-1 text-start text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0", size === "sm" && "text-xs", className)} {...props} />
}

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar }
