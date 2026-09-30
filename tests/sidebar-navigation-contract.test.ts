import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const root = fileURLToPath(new URL("../", import.meta.url))
const menuButton = () => lookupComponentExport("sidebar", "SidebarMenuButton").component!
const fact = (feature: string) => menuButton().accessibility.find((item) => item.feature === feature)!
const howToUse = () => getComponentKnowledge("sidebar").howToUse ?? []
const statement = (pattern: RegExp) => howToUse().find((claim) => pattern.test(claim.statement))!

describe("Sidebar navigation contract", () => {
  test("SidebarMenuButton still exposes the asChild host replacement that navigation composes through", () => {
    const component = menuButton()
    const slot = component.slots.find((item) => item.propName === "asChild")!

    expect(slot).toMatchObject({ default: false, replacesHost: true, forwardsProps: true, refForwarding: "supported" })
    expect(component.localProps.find((item) => item.name === "asChild")).toMatchObject({ required: false, type: { kind: "boolean" }, default: false })
    expect(component.localProps.find((item) => item.name === "isActive")).toMatchObject({ required: false, type: { kind: "boolean" }, default: false })
  })

  test("adds no custom navigation prop: href and navigation events stay on the authored anchor", () => {
    const names = menuButton().localProps.map((item) => item.name)

    expect(names).not.toEqual(expect.arrayContaining(["href", "to", "onNavigate", "asLink", "current"]))
    expect(menuButton().events.map((item) => item.propName)).not.toContain("onNavigate")
  })

  test("documents the anchor composition, native behaviour, and no nested interactive element", () => {
    const mechanism = fact("navigation item").mechanism

    expect(fact("navigation item").owner).toBe("author")
    expect(mechanism).toContain('<SidebarMenuButton asChild><a href="/follow-ups">Follow-ups</a></SidebarMenuButton>')
    expect(mechanism).toMatch(/anchor is the menu button itself/)
    expect(mechanism).toMatch(/nest no Button or second link/)
    expect(mechanism).toMatch(/text content is the accessible name/)
    expect(mechanism).toMatch(/Enter activation, modified click, middle click, context menu, and open in new tab stay native/)
    expect(mechanism).toMatch(/Do not emulate navigation with a button onClick/)
  })

  test("says isActive never adds aria-current and the anchor owns current-page semantics", () => {
    const mechanism = fact("current page").mechanism

    expect(mechanism).toMatch(/isActive only sets data-active/)
    expect(mechanism).toMatch(/never adds aria-current/)
    expect(mechanism).toContain('aria-current="page"')
    expect(mechanism).toMatch(/on no action button/)
    expect(mechanism).toMatch(/router owns it/)
  })

  test("separates navigation items (anchor) from action items (button)", () => {
    expect(fact("native host semantics").mechanism).toMatch(/button by default; under asChild the replacement child is the host/)
    expect(fact("action item").mechanism).toMatch(/without asChild and stays a native button/)
    expect(fact("action item").mechanism).toMatch(/do not give it href or aria-current/)
  })

  test("states that routing belongs to the application, not the design system", () => {
    const mechanism = fact("routing").mechanism

    expect(mechanism).toMatch(/does not own application routing and does no client-side navigation/)
    expect(mechanism).toMatch(/router link component that renders an anchor and forwards its props and ref/)
    expect(mechanism).not.toMatch(/SPA routing is supported|performs client-side navigation/)
  })

  test("documents disabled and collapsed behaviour without inventing disabled-link logic", () => {
    expect(fact("disabled").mechanism).toMatch(/disabled attribute applies to button items only/)
    expect(fact("disabled").mechanism).toMatch(/intercepts no link activation/)
    expect(fact("collapsed presentation").mechanism).toMatch(/keeps its link role, href, aria-current, keyboard focus, and accessible name/)
    expect(fact("collapsed presentation").mechanism).toMatch(/TooltipProvider/)
  })

  test("Sidebar knowledge tells authors the same rules with source-derived basis", () => {
    const knowledge = getComponentKnowledge("sidebar")

    expect(statement(/navigates to another page or view/).statement).toContain("<SidebarMenuButton asChild><a href=\"/follow-ups\">Follow-ups</a></SidebarMenuButton>")
    expect(statement(/current page/).statement).toMatch(/isActive only sets the data-active styling and never adds aria-current/)
    expect(statement(/performs an action instead of navigating/).statement).toMatch(/Navigation items are anchors; action items are buttons/)
    expect(statement(/does not own application routing/).statement).toMatch(/performs no client-side navigation/)
    expect(statement(/disabled attribute applies to button items only/).statement).toMatch(/no disabled-link behaviour/)
    expect(statement(/icon-collapsed presentation/).statement).toMatch(/TooltipProvider/)
    expect(knowledge.whenNotToUse?.[0].statement).toMatch(/native link/)
    expect(knowledge.guidanceStatus).toMatchObject({ howToUse: "available", whenNotToUse: "available" })
  })

  test("every reference cited by the new guidance exists", () => {
    const references = JSON.parse(readFileSync(join(root, "contracts/knowledge/references.json"), "utf8")).references as { id: string }[]
    const known = new Set(references.map(({ id }) => id))
    const knowledge = getComponentKnowledge("sidebar")
    const cited = [...(knowledge.howToUse ?? []), ...(knowledge.whenNotToUse ?? [])].flatMap((claim) => (claim.basis.kind === "source-derived" ? claim.basis.referenceIds : []))

    expect(cited).toEqual(expect.arrayContaining(["w3c.aria.aria-current", "whatwg.html.the-a-element", "radix.composition.docs"]))
    for (const id of cited) expect(known.has(id), id).toBe(true)
  })
})
