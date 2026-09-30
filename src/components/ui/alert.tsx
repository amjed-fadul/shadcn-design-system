import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-lg border p-4 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 has-[>[data-slot=alert-action]]:pe-28 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 bg-background text-destructive [&_[data-slot=alert-description]]:text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const statusVariants = cva("text-sm", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      error: "text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 min-h-4 font-medium leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute end-3 top-3", className)}
      {...props}
    />
  )
}

type StatusProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "role" | "aria-live"
> & {
  variant?: "default" | "error"
  /** Keeps the message in the accessibility tree but hides it visually. */
  visuallyHidden?: boolean
}

const Status = React.forwardRef<HTMLDivElement, StatusProps>(({
  className,
  variant = "default",
  visuallyHidden = false,
  ...props
}, ref) => (
    <div
      ref={ref}
      data-slot="status"
      data-variant={variant}
      {...props}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        statusVariants({ variant }),
        visuallyHidden && "sr-only",
        className
      )}
    />
  ))
Status.displayName = "Status"

export { Alert, AlertTitle, AlertDescription, AlertAction, Status, alertVariants }
