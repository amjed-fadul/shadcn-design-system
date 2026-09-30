import { describe, expect, test } from "vitest"

import references from "../contracts/knowledge/references.json"
import { getInheritedInterface, lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const accessibilityText = (family: string, exportName: string) =>
  lookupComponentExport(family, exportName)
    .component!.accessibility.map((fact) => `${fact.feature}: ${fact.mechanism}`)
    .join("\n")

const knowledgeText = (id: string) =>
  [...(getComponentKnowledge(id).howToUse ?? []), ...(getComponentKnowledge(id).options ?? [])]
    .map((claim) => claim.statement)
    .join("\n")

describe("Input autoComplete discoverability", () => {
  test("Input inherits html.input, whose autoComplete prop is a typed union, not unknown", () => {
    expect(lookupComponentExport("input", "Input").component!.inherits).toContain("html.input")

    const prop = getInheritedInterface("html.input").props.find((item) => item.name === "autoComplete")!
    expect(prop).toBeDefined()
    expect(prop.type.kind).toBe("union")
    const members = prop.type.kind === "union" ? prop.type.members : []
    const literals = members.flatMap((member) => (member.kind === "literal" ? [member.value] : []))
    for (const token of ["name", "email", "username", "current-password", "new-password", "one-time-code", "organization", "street-address", "postal-code", "tel"]) {
      expect(literals).toContain(token)
    }
    // Any other string stays representable, so the contract is not a closed list.
    expect(members).toContainEqual({ kind: "typescript", typeText: "string & {}" })
  })

  test("Input contract does not redeclare autoComplete as a custom local prop", () => {
    const localProps = lookupComponentExport("input", "Input").component!.localProps
    expect(localProps.map((prop) => prop.name)).not.toContain("autoComplete")
  })

  test("Input accessibility facts name the prop, the native attribute, its value shape, and examples", () => {
    const facts = accessibilityText("input", "Input")

    expect(facts).toContain("autoComplete")
    expect(facts).toContain("autocomplete attribute")
    for (const example of ["email", "username", "current-password", "new-password", "one-time-code"]) {
      expect(facts).toContain(example)
    }
    expect(facts).toContain("Field pairing")
  })

  test("the autocomplete fact is owned by the author and does not claim validation", () => {
    const fact = lookupComponentExport("input", "Input").component!.accessibility.find(
      (item) => item.feature === "autocomplete hints"
    )!

    expect(fact.owner).toBe("author")
    expect(fact.mechanism).toMatch(/not validated|does not validate/i)
  })

  test("autocomplete guidance says browsers and password managers may ignore or override the hint", () => {
    const fact = lookupComponentExport("input", "Input").component!.accessibility.find(
      (item) => item.feature === "autocomplete hints"
    )!
    const claim = (getComponentKnowledge("input").howToUse ?? []).find((item) => item.statement.includes("autoComplete"))!

    for (const text of [fact.mechanism, claim.statement]) {
      expect(text).toMatch(/browsers? and password managers may ignore or override/i)
    }
    expect(fact.mechanism).not.toMatch(/autofill hints/i)
    expect(claim.statement).not.toMatch(/autofill hints/i)
  })

  test("the HTML standard reference has a clear title", () => {
    const reference = references.references.find((item) => item.id === "whatwg.html.autofill")!

    expect(reference.title).toBe("HTML Standard: Autofill")
  })

  test("Input knowledge tells agents how to author autocomplete and cites the HTML standard", () => {
    const text = knowledgeText("input")

    expect(text).toContain("autoComplete")
    expect(text).toContain("type=\"email\"")
    expect(text).toContain("autoComplete=\"username\"")
    expect(text).toContain("type=\"password\"")
    expect(text).toContain("autoComplete=\"current-password\"")

    const claim = (getComponentKnowledge("input").howToUse ?? []).find((item) => item.statement.includes("autoComplete"))!
    expect(claim.basis).toEqual({ kind: "source-derived", referenceIds: expect.arrayContaining(["whatwg.html.autofill"]) })
  })
})

describe("Task 1 wording fixes", () => {
  test("Field's supported-controls wording is not an exhaustive list", () => {
    const field = accessibilityText("field", "Field")

    expect(field).toMatch(/Field controls include Input/)
    expect(field).not.toContain("Field accepts Input, Textarea")
  })

  test("InputGroupButton does not claim it always follows the control in DOM or tab order", () => {
    const button = accessibilityText("input-group", "InputGroupButton")

    expect(button).not.toContain("follows the control in DOM order")
    expect(button).toContain("authored DOM order")
    expect(button).toContain("Tab")
  })
})
