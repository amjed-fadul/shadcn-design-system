import { describe, expect, test } from "vitest"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { projectExecutableContract } from "../src/validator/projection"
import { validateAuthoredUi } from "../src/validator/validate"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const loaded = loadComponentContracts()
const executable = projectExecutableContract({ componentContracts: loaded, tokenContract: getTokenContract() })
const definition = () => loaded.families.find((family) => family.id === "icon")?.exports.find((entry) => entry.name === "Icon")?.component
const validate = (props: Record<string, string | boolean>) => validateAuthoredUi({ root: {
  kind: "component", id: "icon", familyId: "icon", exportName: "Icon",
  props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, { kind: "literal" as const, value }])),
  children: [], location: { path: "icon" },
} }, executable)

describe("Icon canonical and authoring contract", () => {
  test("registers a closed API and repo-native provenance", () => {
    const family = loaded.families.find((family) => family.id === "icon")
    expect(family).toBeDefined()
    expect(family!.source.implementationKind).toBe("repo-native")
    expect(family!.source.upstreamPath).toBeUndefined()
    expect(definition()!.inherits).toEqual([])
    expect(definition()!.localProps.map((prop) => prop.name).sort()).toEqual(["color", "decorative", "label", "name", "placement", "size"])
  })

  test("requires meaningful labels while decorative icons do not accept labels", () => {
    expect(validate({ name: "info" }).ok).toBe(true)
    expect(validate({ name: "info", decorative: false, label: "Information" }).ok).toBe(true)
    expect(validate({ name: "info", decorative: false }).ok).toBe(false)
    expect(validate({ name: "info", label: "Information" }).ok).toBe(false)
  })

  test.each(["className", "style", "viewBox", "role", "children"])("does not authorize %s passthrough", (name) => {
    expect(validate({ name: "search", [name]: "arbitrary" }).ok).toBe(false)
  })

  test("rejects an arbitrary icon identity and size", () => {
    expect(validate({ name: "alarm-clock" }).ok).toBe(false)
    expect(validate({ name: "search", size: "xl" }).ok).toBe(false)
  })

  test("accepts only governed semantic colors and binds their tokens", () => {
    for (const color of ["inherit", "foreground", "primary", "muted-foreground", "destructive", "success", "warning", "info"]) {
      expect(validate({ name: "info", color }).ok).toBe(true)
    }
    for (const color of ["red", "#ff0000", "var(--custom)"]) {
      expect(validate({ name: "info", color }).ok).toBe(false)
    }
    expect(definition()!.localProps.find((prop) => prop.name === "color")!.default).toBe("inherit")
    expect(definition()!.tokenDependencies.filter((dependency) => dependency.when?.propName === "color").map((dependency) => dependency.tokenId).sort()).toEqual(["color.destructive", "color.foreground", "color.info", "color.muted-foreground", "color.primary", "color.success", "color.warning"])
  })

  test("makes semantic use and RTL policy discoverable", () => {
    const knowledge = getComponentKnowledge("icon")
    const text = [...(knowledge.howToUse ?? []), ...(knowledge.options ?? [])].map((claim) => claim.statement).join(" ")
    expect(text).toContain("decorative={false}")
    expect(text).toContain("label")
    expect(text).toContain("RTL")
    expect(text).toContain("placement")
  })
})
