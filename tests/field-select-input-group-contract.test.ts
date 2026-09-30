import { describe, expect, test } from "vitest"

import { lookupComponentExport } from "../src/contracts/components/index"
import { getComponentKnowledge } from "../src/contracts/knowledge"

describe("contract metadata for the supported compositions", () => {
  const facts = (family: string, exportName: string) => {
    const component = lookupComponentExport(family, exportName).component!
    return component.accessibility.map((fact) => `${fact.feature}: ${fact.mechanism}`).join("\n")
  }

  test("Field contracts name Select and InputGroup as supported controls and who owns each relationship", () => {
    const field = facts("field", "Field")

    expect(field).toContain("Select (via SelectTrigger)")
    expect(field).toContain("InputGroup (via InputGroupInput or InputGroupTextarea)")
    expect(field).toContain("aria-describedby")
    expect(facts("field", "FieldDescription")).toContain("aria-describedby")
    expect(facts("field", "FieldError")).toContain("role=\"alert\"")
  })

  test("SelectTrigger contract states where id, invalid, description, required, and disabled live", () => {
    const trigger = facts("select", "SelectTrigger")

    for (const expected of ["htmlFor", "aria-invalid", "aria-describedby", "aria-required", "disabled", "combobox"]) {
      expect(trigger).toContain(expected)
    }
    expect(lookupComponentExport("select", "SelectTrigger").component!.tokenDependencies).toContainEqual(
      expect.objectContaining({ tokenId: "color.destructive", when: expect.objectContaining({ subject: "aria", propName: "invalid" }) })
    )
  })

  test("InputGroup contracts describe Field composition and the default non-submitting inline button", () => {
    expect(facts("input-group", "InputGroup")).toContain("direct child of Field")
    expect(facts("input-group", "InputGroupInput")).toContain("aria-describedby")
    expect(facts("input-group", "InputGroupButton")).toContain("does not submit a surrounding form")
    expect(lookupComponentExport("input-group", "InputGroupButton").component!.inheritedPropDefaults).toContainEqual(
      expect.objectContaining({ propName: "type", value: "button" })
    )
  })

  test("component knowledge lets agents discover Select and InputGroup as Field controls", () => {
    const fieldGuidance = (getComponentKnowledge("field").howToUse ?? []).map((claim) => claim.statement).join("\n")

    expect(fieldGuidance).toContain("Select is a supported Field control")
    expect(fieldGuidance).toContain("InputGroup is a supported Field control")
    expect((getComponentKnowledge("select").howToUse ?? []).some((claim) => claim.statement.includes("inside Field"))).toBe(true)
    expect((getComponentKnowledge("input-group").howToUse ?? []).some((claim) => claim.statement.includes("Inside Field"))).toBe(true)
  })
})
