"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border border-transparent bg-input outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2",
        "data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-input/80",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 translate-x-0 rounded-full bg-background ring-0 transition-transform",
          "group-data-[size=sm]/switch:size-3",
          "group-data-[size=default]/switch:data-[state=checked]:translate-x-3.5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-2.5",
          "rtl:group-data-[size=default]/switch:data-[state=checked]:translate-x-0 rtl:group-data-[size=sm]/switch:data-[state=checked]:translate-x-0",
          "rtl:group-data-[size=default]/switch:data-[state=unchecked]:translate-x-3.5 rtl:group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-2.5",
          "dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
