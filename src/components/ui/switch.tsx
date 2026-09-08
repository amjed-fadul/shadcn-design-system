"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({ className, size = "default", ...props }: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: "sm" | "default" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer inline-flex shrink-0 items-center rounded-full border border-transparent outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        size === "sm" ? "h-3.5 w-6" : "h-[18.4px] w-8",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[calc(100%-2px)]",
          size === "sm" ? "size-3" : "size-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
