import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import {
  getComponentContractSet,
  getComponentFamily,
  getInheritedInterface,
  isAuthorableJsxExport,
  listComponentFamilies,
  lookupComponentExport,
  queryComponentCapabilities,
  queryComponentTokenDependencies,
} from "../src/contracts/components/index"

describe("component contract query API", () => {
  test("uses exact family, export, and interface identifiers", () => {
    expect(getComponentContractSet().familyCount).toBe(20)
    expect(getComponentFamily("button").id).toBe("button")
    expect(lookupComponentExport("button", "Button")).toMatchObject({ name: "Button", kind: "component", authorableJsx: true })
    expect(lookupComponentExport("button", "buttonVariants")).toMatchObject({ name: "buttonVariants", kind: "helper", authorableJsx: false })
    expect(getInheritedInterface("radix.dialog.root").id).toBe("radix.dialog.root")

    expect(() => getComponentFamily("Button")).toThrow("COMPONENT_FAMILY_NOT_CONTRACTED")
    expect(() => lookupComponentExport("button", "DialogBody")).toThrow("COMPONENT_EXPORT_NOT_CONTRACTED")
    expect(() => getInheritedInterface("radix.dialog.Root")).toThrow("INHERITED_INTERFACE_NOT_CONTRACTED")
  })

  test("rejects case, whitespace, and alias variants instead of normalizing them", () => {
    expect(() => getComponentFamily(" button")).toThrow("COMPONENT_FAMILY_NOT_CONTRACTED")
    expect(() => getComponentFamily("BUTTON")).toThrow("COMPONENT_FAMILY_NOT_CONTRACTED")
    expect(() => lookupComponentExport("button", " buttonVariants")).toThrow("COMPONENT_EXPORT_NOT_CONTRACTED")
    expect(() => lookupComponentExport("button", "buttonvariants")).toThrow("COMPONENT_EXPORT_NOT_CONTRACTED")
    expect(() => getInheritedInterface(" radix.dialog.root")).toThrow("INHERITED_INTERFACE_NOT_CONTRACTED")
    expect(() => getInheritedInterface("radix.dialog.Root ")).toThrow("INHERITED_INTERFACE_NOT_CONTRACTED")
  })

  test("keeps lexical family order and prevents non-JSX exports from becoming components", () => {
    const families = listComponentFamilies()
    expect(families.map((family) => family.id)).toEqual([...families].map((family) => family.id).sort())
    expect(isAuthorableJsxExport("button", "Button")).toBe(true)
    expect(isAuthorableJsxExport("badge", "badgeVariants")).toBe(false)
    expect(isAuthorableJsxExport("sidebar", "useSidebar")).toBe(false)
    expect(() => isAuthorableJsxExport("sidebar", "SidebarMissing")).toThrow("COMPONENT_EXPORT_NOT_CONTRACTED")
  })

  test("indexes every canonical family, public export, and inherited interface exactly once", () => {
    const loaded = loadComponentContracts()
    const families = listComponentFamilies()
    const familyKeys = families.map((family) => family.id)
    const exportKeys = families.flatMap((family) => family.exports.map((entry) => `${family.id}:${entry.name}`))
    const interfaceKeys = loaded.interfaces.map((contract) => contract.id)

    expect(new Set(familyKeys).size).toBe(familyKeys.length)
    expect(new Set(exportKeys).size).toBe(exportKeys.length)
    expect(new Set(interfaceKeys).size).toBe(interfaceKeys.length)
    for (const family of families) {
      expect(getComponentFamily(family.id)).toBe(family)
      for (const entry of family.exports) expect(lookupComponentExport(family.id, entry.name)).toBe(entry)
    }
    for (const contract of loaded.interfaces) expect(getInheritedInterface(contract.id)).toMatchObject({ id: contract.id })
  })

  test("returns only factual capability matches with no duplicate references", () => {
    const matches = queryComponentCapabilities("dialog.context")
    const keys = matches.map((match) => `${match.familyId}:${match.exportName}:${match.relation}`)

    expect(matches.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
    expect(matches.every((match) => match.familyId === "dialog")).toBe(true)
    expect(matches.every((match) => match.relation === "requires" || match.relation === "provides")).toBe(true)
    expect(queryComponentCapabilities("dialog.context")).toEqual(matches)
    expect(() => queryComponentCapabilities("missing.context")).toThrow("COMPONENT_CAPABILITY_NOT_CONTRACTED")
  })

  test("does not allow capability query results to mutate canonical state", () => {
    const matches = queryComponentCapabilities("dialog.context")
    const before = structuredClone(matches)

    expect(Object.isFrozen(matches)).toBe(true)
    expect(Object.isFrozen(matches[0])).toBe(true)
    expect(() => (matches as unknown as Array<unknown>).pop()).toThrow(TypeError)
    expect(() => ((matches[0] as unknown as { familyId: string }).familyId = "changed")).toThrow(TypeError)
    expect(queryComponentCapabilities("dialog.context")).toEqual(before)
  })

  test("returns only factual token dependencies with deterministic immutable results", () => {
    const matches = queryComponentTokenDependencies("radius.md")
    const keys = matches.map((match) => `${match.familyId}:${match.exportName}:${JSON.stringify(match.dependency)}`)

    expect(matches.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
    expect(matches.every((match) => match.dependency.tokenId === "radius.md")).toBe(true)
    expect(matches.some((match) => match.familyId === "button" && match.exportName === "Button")).toBe(true)
    expect(queryComponentTokenDependencies("radius.md")).toEqual(matches)
    expect(Object.isFrozen(matches)).toBe(true)
    expect(Object.isFrozen(matches[0])).toBe(true)
    expect(Object.isFrozen(matches[0].dependency)).toBe(true)
    expect(() => (matches as unknown as Array<unknown>).pop()).toThrow(TypeError)
    expect(() => queryComponentTokenDependencies("spacing.17")).toThrow("COMPONENT_TOKEN_NOT_CONTRACTED")
  })

  test("does not allow mutations through query results to alter canonical state", () => {
    const families = listComponentFamilies()
    const button = getComponentFamily("button")
    const exportContract = lookupComponentExport("button", "Button")

    expect(Object.isFrozen(getComponentContractSet())).toBe(true)
    expect(Object.isFrozen(families)).toBe(true)
    expect(Object.isFrozen(button)).toBe(true)
    expect(Object.isFrozen(exportContract)).toBe(true)
    expect(() => (button.exports as unknown as Array<unknown>).pop()).toThrow(TypeError)
    expect(() => ((exportContract as unknown as { name: string }).name = "Changed")).toThrow(TypeError)
    expect(lookupComponentExport("button", "Button").name).toBe("Button")
  })
})
