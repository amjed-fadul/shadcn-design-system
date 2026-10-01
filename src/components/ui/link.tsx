import * as React from "react"

type LinkProps = {
  href: string
  children: React.ReactNode
  newTab?: boolean
}

function Link({ href, children, newTab = false }: LinkProps) {
  if (typeof href !== "string" || !href.trim()) {
    throw new Error("Link href must be a non-empty string.")
  }
  // Opaque elements own their accessible content; only plainly empty content
  // can be checked here without interpreting caller components.
  if (!React.Children.toArray(children).some((child) => typeof child !== "string" || Boolean(child.trim()))) {
    throw new Error("Link children must contain non-empty content.")
  }

  return (
    <a
      data-slot="link"
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      className="text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {children}
    </a>
  )
}

export { Link }
