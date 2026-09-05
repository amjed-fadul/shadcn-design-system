import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { getExecutableRelease, validateAuthoredUiAgainstRelease } from "../src/validator/canonical-release"
import type { AuthoredValue } from "../src/validator/types"

describe("release002 environment-owned portal containers", () => {
  test("SelectTrigger exposes exactly the supported native labeling facts", () => {
    const component = getExecutableRelease().projection.exports["select\0SelectTrigger"].component!
    for (const name of ["id", "aria-label", "aria-labelledby"]) {
      expect(component.props.find(prop => prop.name === name)).toEqual({ name, availability: "available", required: false, type: { kind: "string" }, origin: "inherited" })
    }
  })
  test("retains accepted release001 bytes and changes only the approved container and Select labeling props", () => {
    const previousPath = "provenance/releases/shadcn-radix-release-001.json"
    const previousBytes = readFileSync(previousPath, "utf8")
    expect(previousBytes).toBe(execFileSync("git", ["show", `293ff10:${previousPath}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))
    const previous = JSON.parse(previousBytes)
    const current = getExecutableRelease()
    expect(current.releaseId).toBe("shadcn-radix-release-002")
    expect(current.packageIdentity?.version).toBe("0.0.0-release.2")
    const projection = structuredClone(current.projection)
    for (const [family, name] of [["dialog", "DialogContent"], ["select", "SelectContent"]]) {
      const component = projection.exports[`${family}\0${name}`].component!
      for (const shape of [component, ...component.conditionalApi.map(branch => branch.shape)]) {
        const container = shape.props.find(prop => prop.name === "portalContainer")
        expect(container).toMatchObject({ availability: "available", required: false, type: { kind: "union", members: [{ kind: "typescript", typeText: "Element" }, { kind: "typescript", typeText: "DocumentFragment" }] } })
        Object.assign(shape, { props: shape.props.filter(prop => prop.name !== "portalContainer") })
      }
    }
    const trigger = projection.exports["select\0SelectTrigger"].component!
    Object.assign(trigger, { props: trigger.props.filter(prop => !["id", "aria-label", "aria-labelledby"].includes(prop.name)) })
    expect(projection).toEqual(previous.projection)
  })

  for (const [familyId, exportName, parent] of [["dialog", "DialogContent", "Dialog"], ["select", "SelectContent", "Select"]]) {
    for (const value of ["#page", null, {}, [], true, 1]) {
      test(`${exportName} rejects authored container ${JSON.stringify(value)}`, () => {
        const result = validateAuthoredUiAgainstRelease({ root: {
          kind: "component", id: "root", familyId, exportName: parent, props: {}, location: { path: "root" },
          children: [{ kind: "component", id: "content", familyId, exportName, props: { portalContainer: { kind: "literal", value } as AuthoredValue }, children: [], location: { path: "root.content" } }],
        } })
        expect(result.ok).toBe(false)
        expect(result.errors.some(error => error.code === "UNRESOLVED_FACT" && error.target.propName === "portalContainer")).toBe(true)
      })
    }
  }
})
