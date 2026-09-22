import * as React from "react"

import { Sidebar, SidebarContent, SidebarProvider } from "../../src/components/ui/sidebar"
import { useIsMobile } from "../../src/hooks/use-mobile"

const DESKTOP_COOKIE = "sidebar_state"
const MOBILE_COOKIE = "sidebar_mobile_state"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function cookieValue(name: string, fallback: boolean) {
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))?.split("=")[1]
  return value === undefined ? fallback : value === "true"
}

function persist(name: string, value: boolean) {
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}`
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.matches("input, textarea, select") || target.isContentEditable || Boolean(target.closest("[contenteditable]:not([contenteditable='false'])"))
}

export function SidebarNormalAppFixture({
  active = false,
  children,
  defaultOpen = true,
  defaultOpenMobile = false,
  isMobile: isMobileOverride,
  label = "Navigation",
}: React.PropsWithChildren<{
  active?: boolean
  defaultOpen?: boolean
  defaultOpenMobile?: boolean
  isMobile?: boolean
  label?: string
}>) {
  const detectedIsMobile = useIsMobile()
  const isMobile = isMobileOverride ?? detectedIsMobile
  const [open, setOpenState] = React.useState(() => cookieValue(DESKTOP_COOKIE, defaultOpen))
  const [openMobile, setOpenMobileState] = React.useState(() => cookieValue(MOBILE_COOKIE, defaultOpenMobile))

  const setOpen = React.useCallback((value: boolean) => {
    setOpenState(value)
    persist(DESKTOP_COOKIE, value)
  }, [])
  const setOpenMobile = React.useCallback((value: boolean) => {
    setOpenMobileState(value)
    persist(MOBILE_COOKIE, value)
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
      <Sidebar role="navigation" aria-label={label}><SidebarContent>{label}</SidebarContent></Sidebar>
      {children}
    </SidebarProvider>
  )
}
