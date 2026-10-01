import { describe, expect, test } from "vitest"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { projectExecutableContract } from "../src/validator/projection"
import { validateAuthoredUi } from "../src/validator/validate"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { getComponentKnowledge } from "../src/contracts/knowledge"

const loaded = loadComponentContracts()
const executable = projectExecutableContract({ componentContracts: loaded, tokenContract: getTokenContract() })
const definition = () => loaded.families.find((family) => family.id === "image")?.exports.find((entry) => entry.name === "Image")?.component
const props = { src: "/landscape.png", alt: "Landscape", width: 640, height: 360 }
const validate = (values: Record<string, string | number>) => validateAuthoredUi({ root: {
  kind: "component", id: "image", familyId: "image", exportName: "Image",
  props: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { kind: "literal" as const, value }])),
  children: [], location: { path: "image" },
} }, executable)

describe("Image canonical and authoring contract", () => {
  test("registers a closed native img API with repository authority", () => {
    const family = loaded.families.find((family) => family.id === "image")
    expect(family).toBeDefined()
    expect(family!.source.implementationKind).toBe("repo-native")
    expect(family!.source.upstreamPath).toBeUndefined()
    expect(definition()!.inherits).toEqual([])
    expect(definition()!.localProps.map((prop) => prop.name).sort()).toEqual(["alt", "fit", "height", "layout", "loading", "src", "width"])
    const rendering = definition()!.rendering
    if (!("nodes" in rendering)) throw new Error("Image must expose native render nodes.")
    expect(rendering.nodes[0].host).toEqual({ kind: "intrinsic", tag: "img" })
    expect(definition()!.tokenDependencies).toEqual([])
  })

  test("accepts meaningful, decorative and bounded fill usages", () => {
    expect(validate(props).ok).toBe(true)
    expect(validate({ ...props, alt: "" }).ok).toBe(true)
    expect(validate({ ...props, layout: "fill", fit: "cover", loading: "lazy" }).ok).toBe(true)
  })

  test.each(["src", "alt", "width", "height"])("requires %s", (name) => {
    expect(validate(Object.fromEntries(Object.entries(props).filter(([key]) => key !== name))).ok).toBe(false)
  })

  test.each(["className", "style", "srcSet", "sizes", "role", "children", "onClick"])("does not authorize %s passthrough", (name) => {
    expect(validate({ ...props, [name]: "arbitrary" }).ok).toBe(false)
  })

  test.each([["layout", "absolute"], ["fit", "stretch"], ["loading", "auto"], ["width", "100%"]])("rejects an ungoverned %s", (name, value) => {
    expect(validate({ ...props, [name]: value }).ok).toBe(false)
  })

  test("documents native accessibility, runtime refinements and constrained-parent fill", () => {
    const knowledge = getComponentKnowledge("image")
    const text = [...(knowledge.howToUse ?? []), ...(knowledge.options ?? [])].map((claim) => claim.statement).join(" ")
    expect(text).toContain('alt=""')
    expect(text).toContain("positive integers")
    expect(text).toContain("runtime")
    expect(text).toContain("definite width and height")
    expect(text).toContain("RTL")
  })
})
