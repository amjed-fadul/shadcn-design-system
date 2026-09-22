# Sidebar in a normal application

The core `Sidebar` is deterministic: its provider does not inspect the browser, persist state, or install a global shortcut. A normal application can own those policies in an app-level adapter and pass their results into the component explicitly.

```tsx
import * as React from "react"

import { SidebarProvider } from "@adc/shadcn-design-system"
import { useIsMobile } from "@/hooks/use-mobile"

const WEEK = 60 * 60 * 24 * 7

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.matches("input, textarea, select") ||
    target.isContentEditable ||
    Boolean(target.closest("[contenteditable]:not([contenteditable='false'])"))
}

export function AppSidebarProvider({ children, active = true }: React.PropsWithChildren<{ active?: boolean }>) {
  const isMobile = useIsMobile()
  const [open, setOpenState] = React.useState(true)
  const [openMobile, setOpenMobileState] = React.useState(false)

  const setOpen = React.useCallback((value: boolean) => {
    setOpenState(value)
    document.cookie = `sidebar_state=${value}; path=/; max-age=${WEEK}`
  }, [])
  const setOpenMobile = React.useCallback((value: boolean) => {
    setOpenMobileState(value)
    document.cookie = `sidebar_mobile_state=${value}; path=/; max-age=${WEEK}`
  }, [])

  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || (!event.metaKey && !event.ctrlKey) || isEditable(event.target)) return
      event.preventDefault()
      if (isMobile) setOpenMobile(!openMobile)
      else setOpen(!open)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active, isMobile, open, openMobile, setOpen, setOpenMobile])

  return (
    <SidebarProvider
      isMobile={isMobile}
      open={open}
      onOpenChange={setOpen}
      openMobile={openMobile}
      onOpenMobileChange={setOpenMobile}
    >
      {children}
    </SidebarProvider>
  )
}
```

Only the active application provider should install the shortcut. Editable `input`, `textarea`, `select`, and contenteditable targets are excluded so Cmd/Ctrl+B remains available to the focused editor. If persistence must survive reloads, initialize each state channel from its corresponding cookie before rendering; the tested fixture at `tests/fixtures/sidebar-normal-app-recipe.tsx` demonstrates that complete variant.

This adapter is application documentation, not a package export.
