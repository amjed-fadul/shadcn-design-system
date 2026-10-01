"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) { return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} /> }
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) { return <TooltipPrimitive.Root data-slot="tooltip" {...props} /> }
const TooltipTrigger = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>>(({ ...props }, ref) => <TooltipPrimitive.Trigger ref={ref} data-slot="tooltip-trigger" {...props} />)
TooltipTrigger.displayName = "TooltipTrigger"
function TooltipContent({ className, sideOffset = 0, children, portalContainer, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content> & { portalContainer?: React.ComponentProps<typeof TooltipPrimitive.Portal>["container"] }) { return <TooltipPrimitive.Portal container={portalContainer}><TooltipPrimitive.Content data-slot="tooltip-content" sideOffset={sideOffset} className={cn("z-50 rounded-lg border border-foreground bg-foreground px-3 py-1.5 text-xs text-background shadow-sm duration-200 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0", className)} {...props}>{children}<TooltipPrimitive.Arrow className="fill-foreground" /></TooltipPrimitive.Content></TooltipPrimitive.Portal> }

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
