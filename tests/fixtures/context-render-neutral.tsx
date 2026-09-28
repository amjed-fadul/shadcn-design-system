import * as React from "react"

type Appearance = {
  tone: string | null
  density: string | null
}

const AppearanceContext = React.createContext<Appearance>({
  tone: "quiet",
  density: "compact",
})

export function AppearanceProvider({
  tone = "calm",
  children,
}: {
  tone?: string
  children: React.ReactNode
}) {
  return (
    <AppearanceContext.Provider value={{ tone, density: "comfortable" }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function AppearanceBadge({
  localTone = "plain",
  ...props
}: React.ComponentProps<"span"> & { localTone?: string }) {
  const appearance = React.useContext(AppearanceContext)

  return (
    <span
      data-tone={appearance.tone ?? localTone}
      data-density={appearance.density ?? "compact"}
      {...props}
    />
  )
}
