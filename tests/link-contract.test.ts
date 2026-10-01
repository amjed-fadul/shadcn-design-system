import { describe, expect, test } from "vitest"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { projectExecutableContract } from "../src/validator/projection"
import { validateAuthoredUi } from "../src/validator/validate"
import type { AuthoredNode } from "../src/validator/types"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const loaded = loadComponentContracts()
const executable = projectExecutableContract({ componentContracts: loaded, tokenContract: getTokenContract() })
const definition = () => loaded.families.find((family) => family.id === "link")?.exports.find((entry) => entry.name === "Link")?.component
const text: AuthoredNode = { kind: "text", id: "label", value: "Documentation", location: { path: "link.children" } }
const validate = (props: Record<string, string | boolean> = { href: "/docs" }, children: AuthoredNode[] = [text]) => validateAuthoredUi({ root: {
  kind: "component", id: "link", familyId: "link", exportName: "Link",
  props: Object.fromEntries(Object.entries(props).map(([name, value]) => [name, { kind: "literal" as const, value }])),
  children, location: { path: "link" },
} }, executable)

describe("Link canonical and authoring contract", () => {
  test("registers a closed repo-native anchor API", () => {
    const family = loaded.families.find((family) => family.id === "link")
    expect(family).toBeDefined()
    expect(family!.source.implementationKind).toBe("repo-native")
    expect(family!.source.upstreamPath).toBeUndefined()
    expect(definition()!.inherits).toEqual([])
    expect(definition()!.localProps.map((prop) => prop.name).sort()).toEqual(["children", "href", "newTab"])
    const rendering = definition()!.rendering
    expect("nodes" in rendering).toBe(true)
    if ("nodes" in rendering) expect(rendering.nodes[0].host).toEqual({ kind: "intrinsic", tag: "a" })
  })

  test("accepts structural JSX children and explicit new-tab choice", () => {
    expect(validate().ok).toBe(true)
    expect(validate({ href: "https://example.com", newTab: true }).ok).toBe(true)
  })

  test("requires a destination and authored children", () => {
    expect(validate({}).ok).toBe(false)
    expect(validate({ href: "/docs" }, []).ok).toBe(false)
  })

  test.each(["className", "style", "role", "disabled", "asChild", "onClick", "target", "rel", "ref", "aria-label"])("rejects %s as an authoring escape hatch", (name) => {
    expect(validate({ href: "/docs", [name]: "arbitrary" }).ok).toBe(false)
  })

  test("rejects a nonboolean new-tab choice", () => {
    expect(validate({ href: "/docs", newTab: "yes" }).ok).toBe(false)
  })

  test("publishes destination, naming and runtime refinement guidance", () => {
    const knowledge = getComponentKnowledge("link")
    const guidance = [...(knowledge.howToUse ?? []), ...(knowledge.options ?? [])].map((claim) => claim.statement).join(" ")
    for (const subject of ["newTab", "noopener", "mailto", "tel", "opaque", "runtime"]) expect(guidance).toContain(subject)
  })
})
