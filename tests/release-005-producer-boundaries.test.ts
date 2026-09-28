import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract } from "../src/validator/projection"

const source = loadComponentContracts()
const projection = projectExecutableContract({ componentContracts: source, tokenContract: getTokenContract() })

function family(id: string) {
  const result = source.families.find((entry) => entry.id === id)
  if (!result) throw new Error(`Missing family ${id}`)
  return result
}

function exported(familyId: string, name: string) {
  const result = family(familyId).exports.find((entry) => entry.name === name)
  if (!result?.component) throw new Error(`Missing component ${familyId}.${name}`)
  return result.component
}

function projected(familyId: string, name: string) {
  const result = projection.exports[`${familyId}\u0000${name}`]
  if (!result?.component) throw new Error(`Missing projected component ${familyId}.${name}`)
  return result
}

describe("Release 005 producer boundaries", () => {
  test("has no unresolved family-level model limitation", () => {
    expect(source.families.flatMap((entry) => entry.unresolved.map((fact) => `${entry.id}: ${fact.topic}`)).sort()).toEqual([])
  })

  test("retains Vaul's snap-point presence requirement in executable branches", () => {
    const drawer = projected("drawer", "Drawer").component!
    const present = drawer.conditionalApi.find((entry) => "presence" in entry.when && entry.when.presence === "present")
    const absent = drawer.conditionalApi.find((entry) => "presence" in entry.when && entry.when.presence === "absent")

    expect(present?.shape.props.find((prop) => prop.name === "snapPoints")).toMatchObject({ availability: "available", required: true })
    expect(absent?.shape.props.find((prop) => prop.name === "snapPoints")).toMatchObject({ availability: "available", required: false })
  })

  test("projects resolved ToggleGroupItem without render internals", () => {
    expect(family("toggle-group").unresolved).toEqual([])
    expect(projected("toggle-group", "ToggleGroupItem").unresolved).toEqual([])
    expect(family("toggle-group").exports.find((entry) => entry.name === "ToggleGroupItem")?.authorableJsx).toBe(true)
    expect(exported("toggle-group", "ToggleGroupItem").context).toBeDefined()
    expect("context" in projected("toggle-group", "ToggleGroupItem").component!).toBe(false)
  })

  test.each([["field", "FieldError"], ["slider", "Slider"]])("projects resolved %s.%s without a structural limitation", (familyId, exportName) => {
    expect(family(familyId).unresolved).toEqual([])
    expect(projected(familyId, exportName).unresolved).toEqual([])
    expect(exported(familyId, exportName).renderingFlow).toBeDefined()
  })

  test("projects the pinned SVG public API and wrapper defaults for Spinner", () => {
    const svg = source.interfaces.find((entry) => entry.id === "html.svg")
    const spinner = exported("spinner", "Spinner")
    const effective = projected("spinner", "Spinner").component!
    const rendering = spinner.rendering

    expect(svg?.source).toMatchObject({ kind: "react-intrinsic", package: "@types/react", version: "18.3.3", symbol: 'React.JSX.IntrinsicElements["svg"]' })
    expect(spinner.inherits).toContain("html.svg")
    expect(svg?.props.map((prop) => prop.name)).toEqual(expect.arrayContaining(["viewBox", "onClick", "role", "aria-label", "ref"]))
    expect(effective.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "viewBox", type: { kind: "string" }, origin: "inherited" }),
      expect.objectContaining({ name: "role", default: "status", origin: "inherited" }),
      expect.objectContaining({ name: "aria-label", default: "Loading", origin: "inherited" }),
    ]))
    expect("nodes" in rendering && rendering.nodes.find((node) => node.id === rendering.rootNodeId)?.host)
      .toEqual({ kind: "inherited-interface", interfaceId: "html.svg" })
    expect(projected("spinner", "Spinner").unresolved).toEqual([])
  })

  test("keeps executable projection narrower than the full structural contracts", () => {
    expect("rendering" in exported("field", "FieldError")).toBe(true)
    expect("accessibility" in exported("field", "FieldError")).toBe(true)
    expect("rendering" in projected("field", "FieldError").component!).toBe(false)
    expect("accessibility" in projected("field", "FieldError").component!).toBe(false)
  })
})
