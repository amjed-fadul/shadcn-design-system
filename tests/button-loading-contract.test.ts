import { describe, expect, test } from "vitest"

import { lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const facts = () => lookupComponentExport("button", "Button").component!.accessibility
const factText = () => facts().map((fact) => `${fact.feature}: ${fact.mechanism}`).join("\n")
const guidance = (id: string) =>
  [...(getComponentKnowledge(id).howToUse ?? []), ...(getComponentKnowledge(id).options ?? []), ...(getComponentKnowledge(id).writing ?? [])]

describe("Button loading contract", () => {
  test("declares loading as an optional boolean prop that defaults to false", () => {
    const prop = lookupComponentExport("button", "Button").component!.localProps.find((item) => item.name === "loading")!

    expect(prop).toMatchObject({ required: false, type: { kind: "boolean" }, default: false })
  })

  test("declares the Spinner as a conditional child rendered while loading", () => {
    const rendering = lookupComponentExport("button", "Button").component!.rendering
    const alternatives = "alternatives" in rendering ? rendering.alternatives : []
    const otherwise = alternatives.find((item) => "otherwise" in item)!.rendering
    const host = otherwise.nodes.find((node) => node.id === otherwise.rootNodeId)!
    const spinnerEdge = host.children.find((child) => child.nodeId === "spinner")!

    expect(spinnerEdge.when).toEqual({ source: "state", name: "isLoading", truthiness: "truthy" })
    expect(otherwise.nodes.find((node) => node.id === "spinner")!.host).toEqual({ kind: "cross-family-export", familyId: "spinner", exportName: "Spinner" })
  })

  test("states that the caller owns the loading state and Button runs no async work", () => {
    const fact = facts().find((item) => item.feature === "loading state")!

    expect(fact.owner).toBe("component")
    expect(fact.mechanism).toMatch(/caller-controlled/)
    expect(fact.mechanism).toMatch(/does not start, track, or finish async work/)
  })

  test("documents aria-busy, native disabled, Spinner, and blocked activation", () => {
    const text = factText()

    expect(text).toContain('aria-busy="true"')
    expect(text).toContain("native disabled attribute")
    expect(text).toContain("governed Spinner")
    expect(text).toMatch(/pointer, keyboard \(Enter and Space\), and form-submit activation are blocked/)
    expect(text).toMatch(/cannot keep keyboard focus/)
    expect(text).toMatch(/data-size starts with icon[^.]*InputGroupButton/)
  })

  test("documents that the Spinner adds no accessible name or announcement and the name stays stable", () => {
    const fact = facts().find((item) => item.feature === "loading accessible name")!

    expect(fact.mechanism).toContain('aria-hidden="true"')
    expect(fact.mechanism).toContain('role="status"')
    expect(fact.mechanism).toMatch(/no accessible-name text and no live-region announcement/)
    expect(fact.mechanism).toContain('"Log in"')
  })

  test("tells authors to keep the action label and report the result themselves", () => {
    const fact = facts().find((item) => item.feature === "loading label wording")!

    expect(fact.owner).toBe("author")
    expect(fact.mechanism).toMatch(/keep the action label unchanged/)
    expect(fact.mechanism).toMatch(/does not announce completion or failure/)
  })

  test("documents that loading is ignored under asChild", () => {
    const fact = facts().find((item) => item.feature === "loading under asChild")!

    expect(fact.mechanism).toMatch(/ignored when asChild is true/)
  })

  test("Button knowledge tells agents how to use loading without a separate LoadingButton", () => {
    const claims = guidance("button").filter((claim) => claim.statement.includes("loading"))
    const text = claims.map((claim) => claim.statement).join("\n")

    expect(text).toContain("<Button loading>")
    expect(text).toContain("aria-busy")
    expect(text).toMatch(/caller/i)
    expect(text).toMatch(/keep the label/i)
    expect(text).toContain("Spinner")
    for (const claim of claims) expect(claim.basis.kind).toBe("source-derived")
  })

  test("Spinner knowledge points Button users to the loading prop instead of composing a Spinner", () => {
    const text = guidance("spinner").map((claim) => claim.statement).join("\n")

    expect(text).toContain("<Button loading>")
  })
})
