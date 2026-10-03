import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Building2,
  Calendar, ChartColumn, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, Circle, Clock, CreditCard, Download, House, Info,
  Loader2, Lock, MoreHorizontal, PanelLeft, Quote, Receipt, Search, Settings,
  Shield, Star, TrendingDown, TrendingUp, Users, X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

type IconName = "alert-circle" | "arrow-down" | "arrow-end" | "arrow-left" | "arrow-right" | "arrow-start" | "arrow-up" | "bell" | "building" | "calendar" | "chart-column" | "check" | "check-circle" | "chevron-down" | "chevron-end" | "chevron-left" | "chevron-right" | "chevron-start" | "chevron-up" | "circle" | "clock" | "credit-card" | "download" | "home" | "info" | "loader" | "lock" | "more-horizontal" | "panel-left" | "quote" | "receipt" | "search" | "settings" | "shield" | "star" | "trending-down" | "trending-up" | "users" | "x"

// The registry is deliberately finite. Add identities only for an established
// product use case; consumers cannot supply their own SVG or Lucide component.
const iconRegistry: Readonly<Record<IconName, LucideIcon>> = {
  "alert-circle": AlertCircle,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-start": ArrowLeft,
  "arrow-end": ArrowRight,
  "arrow-up": ArrowUp,
  bell: Bell,
  building: Building2,
  calendar: Calendar,
  "chart-column": ChartColumn,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-start": ChevronLeft,
  "chevron-end": ChevronRight,
  circle: Circle,
  clock: Clock,
  "credit-card": CreditCard,
  download: Download,
  home: House,
  info: Info,
  loader: Loader2,
  lock: Lock,
  "more-horizontal": MoreHorizontal,
  "panel-left": PanelLeft,
  quote: Quote,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  shield: Shield,
  star: Star,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  users: Users,
  x: X,
} as const

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      sm: "size-3.5",
      default: "size-4",
      lg: "size-5",
    },
    color: {
      inherit: "",
      foreground: "text-foreground",
      primary: "text-primary",
      "muted-foreground": "text-muted-foreground",
      destructive: "text-destructive",
      success: "text-success",
      warning: "text-warning",
      info: "text-info",
    },
  },
  defaultVariants: { size: "default", color: "inherit" },
})

type IconProps = {
  name: IconName
  size?: "sm" | "default" | "lg"
  color?: "inherit" | "foreground" | "primary" | "muted-foreground" | "destructive" | "success" | "warning" | "info"
  placement?: "inline-start" | "inline-end"
} & (
  | { decorative?: true; label?: never }
  | { decorative: false; label: string }
)

function Icon({ name, size = "default", color = "inherit", decorative = true, label, placement }: IconProps) {
  if (!Object.hasOwn(iconRegistry, name)) throw new Error("Icon name must be a governed identity.")
  if (!["inherit", "foreground", "primary", "muted-foreground", "destructive", "success", "warning", "info"].includes(color)) {
    throw new Error("Icon color must be a governed semantic token.")
  }
  if (!decorative && (typeof label !== "string" || !label.trim())) {
    throw new Error("A meaningful Icon requires a non-empty label.")
  }
  const Glyph = iconRegistry[name]

  return (
    <Glyph
      data-slot="icon"
      data-icon={placement}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      focusable="false"
      className={cn(
        iconVariants({ size, color }),
        (name === "arrow-start" || name === "arrow-end" || name === "chevron-start" || name === "chevron-end") && "rtl:rotate-180"
      )}
    />
  )
}

export { Icon }
