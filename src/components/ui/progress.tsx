"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const DEFAULT_MAX = 100

function Progress({
  className,
  value,
  max = DEFAULT_MAX,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const resolvedMax =
    typeof max === "number" && Number.isFinite(max) && max > 0
      ? max
      : DEFAULT_MAX
  const resolvedValue =
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= resolvedMax
      ? value
      : null
  const percentage =
    resolvedValue === null ? 0 : (resolvedValue / resolvedMax) * 100

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "relative flex h-1 w-full items-center overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full bg-primary transition-[width] duration-150"
        style={{ width: `${percentage}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
