"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) { return <AccordionPrimitive.Root data-slot="accordion" className={cn("flex w-full flex-col", className)} {...props} /> }
function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) { return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b", className)} {...props} /> }
function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) { return <AccordionPrimitive.Header className="flex"><AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn("flex flex-1 items-center justify-between min-h-9 gap-2 rounded-md py-2 text-start text-sm font-medium outline-none transition-colors duration-100 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180", className)} {...props}>{children}<ChevronDown data-slot="accordion-trigger-icon" className="size-4 shrink-0 transition-transform duration-150" /></AccordionPrimitive.Trigger></AccordionPrimitive.Header> }
function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) { return <AccordionPrimitive.Content data-slot="accordion-content" className="overflow-hidden text-sm duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...props}><div className={cn("pb-3 pt-1 text-muted-foreground", className)}>{children}</div></AccordionPrimitive.Content> }

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
