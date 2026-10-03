// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import * as designSystem from "../src/package"

// Start through the public package so a missing option fails as an assertion.
type Loose = React.ComponentType<Record<string, unknown>>
const { Badge, Alert, AlertTitle, AlertDescription, Avatar, AvatarImage, AvatarFallback, Icon } = designSystem as unknown as Record<string, Loose>

const dom = (element: React.ReactElement) => {
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(element)
  return container
}
const classes = (node: Element | null) => new Set((node?.getAttribute("class") ?? "").split(/\s+/))

describe("Release 011 Badge variants", () => {
  test("primary is a primary fill with the primary hover for link badges", () => {
    const node = dom(<Badge variant="primary">Most popular</Badge>).querySelector('[data-slot="badge"]')
    expect(node?.getAttribute("data-variant")).toBe("primary")
    for (const utility of ["bg-primary", "text-primary-foreground", "[a]:hover:bg-primary/80"]) expect(classes(node)).toContain(utility)
  })

  test("default stays neutral", () => {
    const node = dom(<Badge>Draft</Badge>).querySelector('[data-slot="badge"]')
    expect(node?.getAttribute("data-variant")).toBe("default")
    expect(classes(node)).toContain("bg-secondary")
    expect(classes(node)).not.toContain("bg-primary")
  })

  test.each(["success", "warning", "info"])("%s is a status tint with status text", (status) => {
    const node = dom(<Badge variant={status}>Status</Badge>).querySelector('[data-slot="badge"]')
    expect(node?.getAttribute("data-variant")).toBe(status)
    for (const utility of [`bg-${status}/10`, `text-${status}`, `border-${status}/20`, `[a]:hover:bg-${status}/15`]) {
      expect(classes(node)).toContain(utility)
    }
  })
})

describe("Release 011 Alert variants", () => {
  test.each(["success", "warning", "info"])("%s colours text, description and icon with the status token", (status) => {
    const node = dom(
      <Alert variant={status}>
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>Description</AlertDescription>
      </Alert>,
    ).querySelector('[data-slot="alert"]')
    expect(node?.getAttribute("role")).toBe("alert")
    for (const utility of [`border-${status}/30`, "bg-background", `text-${status}`, `[&_[data-slot=alert-description]]:text-${status}`, `[&>svg]:text-${status}`]) {
      expect(classes(node)).toContain(utility)
    }
  })

  test("default and destructive are unchanged", () => {
    expect(classes(dom(<Alert>Plain</Alert>).querySelector('[data-slot="alert"]'))).toContain("bg-background")
    expect(classes(dom(<Alert variant="destructive">Error</Alert>).querySelector('[data-slot="alert"]'))).toContain("text-destructive")
  })
})

describe("Release 011 Avatar shape", () => {
  const avatar = (props: Record<string, unknown> = {}) =>
    dom(
      <Avatar {...props}>
        <AvatarImage src="/logo.png" alt="Acme" />
        <AvatarFallback>AC</AvatarFallback>
      </Avatar>,
    )

  test("defaults to a circle", () => {
    const root = avatar().querySelector('[data-slot="avatar"]')
    expect(root?.getAttribute("data-shape")).toBe("circle")
    expect(classes(root)).toContain("rounded-full")
  })

  test.each([
    ["rounded", "rounded-lg"],
    ["square", "rounded-none"],
  ])("%s shape reshapes the root, its border ring and the fallback", (shape, radius) => {
    const container = avatar({ shape })
    const root = container.querySelector('[data-slot="avatar"]')
    expect(root?.getAttribute("data-shape")).toBe(shape)
    expect(classes(root)).toContain(`data-[shape=${shape}]:${radius}`)
    expect(classes(root)).toContain(`data-[shape=${shape}]:after:${radius}`)
    expect(classes(container.querySelector('[data-slot="avatar-fallback"]'))).toContain(`group-data-[shape=${shape}]/avatar:${radius}`)
  })
})

describe("Release 011 Icon additions", () => {
  const content = [
    "home", "users", "receipt", "credit-card", "chart-column", "settings", "download", "calendar",
    "trending-up", "trending-down", "arrow-up", "arrow-down", "clock", "star", "shield", "lock",
    "building", "quote", "bell",
  ]

  test.each(content)("renders the governed %s identity as a physical (non-mirrored) glyph", (name) => {
    const svg = dom(<Icon name={name} />).querySelector("svg")
    expect(svg?.getAttribute("data-slot")).toBe("icon")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(classes(svg)).not.toContain("rtl:rotate-180")
  })

  test("content identities render distinct glyphs", () => {
    const markup = new Set(content.map((name) => dom(<Icon name={name} />).querySelector("svg")?.innerHTML))
    expect(markup.size).toBe(content.length)
  })

  test.each(["success", "warning", "info"])("colours with the governed %s token", (color) => {
    expect(classes(dom(<Icon name="trending-up" color={color} />).querySelector("svg"))).toContain(`text-${color}`)
  })

  test.each(["chart", "house", "building-2", "pie-chart"])("rejects the ungoverned identity %s", (name) => {
    expect(() => renderToStaticMarkup(<Icon name={name} />)).toThrow(/governed identity/)
  })
})
