import * as React from "react"
import { createRoot } from "react-dom/client"
import "../../src/index.css"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "../../src/components/ui/sidebar"
import { TooltipProvider } from "../../src/components/ui/tooltip"

// Real anchors composed through SidebarMenuButton asChild. The design system
// owns no routing, so every href here is a plain native navigation target.
const target = "/tests/fixtures/sidebar-navigation-target.html"

function Navigation({ id, dir, collapsible, open }: { id: string; dir: "ltr" | "rtl"; collapsible: "none" | "icon"; open: boolean }) {
  const [actions, setActions] = React.useState(0)
  return (
    <div dir={dir} id={id} style={{ position: "relative", width: 320, height: 260, overflow: "hidden", transform: "translateZ(0)", margin: 8 }}>
      <SidebarProvider defaultOpen={open}>
        <Sidebar collapsible={collapsible} dir={dir} role="navigation" aria-label={`${id} navigation`}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive tooltip="Follow-ups">
                      <a href="#current" aria-current="page"><span aria-hidden>★</span><span>Follow-ups</span></a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Clients">
                      <a href={target}><span aria-hidden>●</span><span>Clients</span></a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Settings">
                      <a href={`${target}?from=settings`}><span aria-hidden>■</span><span>Settings</span></a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Command menu" onClick={() => setActions((count) => count + 1)} data-actions={actions}>
                      <span aria-hidden>⌘</span><span>Command menu</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <Navigation id="expanded" dir="ltr" collapsible="none" open />
    <Navigation id="collapsed" dir="ltr" collapsible="icon" open={false} />
    <Navigation id="rtl" dir="rtl" collapsible="none" open />
    <Navigation id="rtl-collapsed" dir="rtl" collapsible="icon" open={false} />
  </TooltipProvider>
)
