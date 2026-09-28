"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbAriaLabels?: string[]
  thumbAriaLabelledBy?: string[]
}

function validateThumbAriaNames(
  values: number[],
  labels: string[] | undefined,
  labelledBy: string[] | undefined
) {
  if (labels !== undefined && labelledBy !== undefined) {
    throw new Error("Slider accepts only one of thumbAriaLabels or thumbAriaLabelledBy.")
  }

  if (labels !== undefined) {
    if (labels.length !== values.length) {
      throw new Error(`Slider thumbAriaLabels must contain exactly ${values.length} entries.`)
    }
    if (labels.some((label) => label.trim().length === 0)) {
      throw new Error("Slider thumbAriaLabels entries must not be blank.")
    }
  }

  if (labelledBy !== undefined) {
    if (labelledBy.length !== values.length) {
      throw new Error(`Slider thumbAriaLabelledBy must contain exactly ${values.length} entries.`)
    }
    if (labelledBy.some((id) => id.trim().length === 0)) {
      throw new Error("Slider thumbAriaLabelledBy entries must not be blank.")
    }
  }
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbAriaLabels,
  thumbAriaLabelledBy,
  ...props
}: SliderProps) {
  const values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min],
    [value, defaultValue, min]
  )

  validateThumbAriaNames(values, thumbAriaLabels, thumbAriaLabelledBy)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          {...(thumbAriaLabels !== undefined
            ? { "aria-label": thumbAriaLabels[index] }
            : thumbAriaLabelledBy !== undefined
              ? { "aria-labelledby": thumbAriaLabelledBy[index] }
              : {})}
          className="relative block size-3 shrink-0 select-none rounded-full border border-ring bg-background ring-ring/50 transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-none active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
