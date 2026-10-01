"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) { return <SheetPrimitive.Root data-slot="sheet" {...props} /> }
const SheetTrigger = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Trigger>>(({ ...props }, ref) => <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" {...props} />)
SheetTrigger.displayName = "SheetTrigger"
function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) { return <SheetPrimitive.Close data-slot="sheet-close" {...props} /> }
function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) { return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} /> }
const SheetOverlay = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>>(({ className, ...props }, ref) => <SheetPrimitive.Overlay ref={ref} data-slot="sheet-overlay" className={cn("fixed inset-0 z-50 bg-black/30 duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0", className)} {...props} />)
SheetOverlay.displayName = "SheetOverlay"

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "top" | "right" | "bottom" | "left"; showCloseButton?: boolean; portalContainer?: React.ComponentProps<typeof SheetPrimitive.Portal>["container"] }>(({ className, children, side = "right", showCloseButton = true, portalContainer, ...props }, ref) => <SheetPortal container={portalContainer}><SheetOverlay /><SheetPrimitive.Content ref={ref} data-slot="sheet-content" data-side={side} className={cn("fixed z-50 flex flex-col gap-4 overflow-y-auto border bg-popover p-4 text-popover-foreground shadow-md duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out", side === "right" && "inset-y-0 right-0 h-full w-3/4 max-w-[min(30rem,calc(100%-2rem))] border-l data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full", side === "left" && "inset-y-0 left-0 h-full w-3/4 max-w-[min(30rem,calc(100%-2rem))] border-r data-[state=open]:slide-in-from-left-full data-[state=closed]:slide-out-to-left-full", side === "top" && "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-top-full", side === "bottom" && "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full", className)} {...props}>{children}{showCloseButton && <SheetPrimitive.Close data-slot="sheet-close" asChild><Button variant="ghost" size="icon-sm" className="absolute top-4 end-4"><X className="size-4" /><span className="sr-only">Close</span></Button></SheetPrimitive.Close>}</SheetPrimitive.Content></SheetPortal>)
SheetContent.displayName = "SheetContent"
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-header" className={cn("flex flex-col gap-2 pe-8", className)} {...props} /> }
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2", className)} {...props} /> }
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) { return <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-heading text-lg font-medium", className)} {...props} /> }
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) { return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} /> }

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
