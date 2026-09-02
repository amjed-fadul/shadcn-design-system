import * as React from "react"

function ReplacementSurface({ children, ...props }: React.ComponentProps<"section">) {
  const child = React.Children.only(children) as React.ReactElement
  return React.cloneElement(child, props)
}

export function ReviewPanel({ delegateHost = false, ...props }: React.ComponentProps<"section"> & { delegateHost?: boolean }) {
  const Host = delegateHost ? ReplacementSurface : "section"
  return <Host {...props} />
}
