import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import type { LoadedComponentContracts } from "../src/contracts/components/loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract } from "../src/validator/projection"

const contract = projectExecutableContract({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
})

describe("executable contract projection", () => {
  test("projects Button's authorability, effective props, and factual Slot/token vocabulary", () => {
    const button = contract.exports["button\u0000Button"]

    expect(button).toMatchObject({
      familyId: "button",
      name: "Button",
      kind: "component",
      authorableJsx: true,
    })
    expect(button.component?.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "variant", type: { kind: "enum", values: ["default", "outline", "secondary", "ghost", "destructive", "link"] } }),
      expect.objectContaining({ name: "disabled", origin: "inherited" }),
    ]))
    expect(button.component?.slots).toEqual([
      expect.objectContaining({ propName: "asChild", replacesHost: true, forwardsProps: true }),
    ])
    expect(contract.tokenIds).toContain("color.primary")
    expect(contract.derivedTokenRuleIds).toContain("spacing.multiplier")
    expect(contract.derivedTokenRules).toEqual([{ id: "spacing.multiplier", baseTokenId: "spacing.unit", parameter: { name: "multiplier", type: "number", minimum: 0 } }])
  })

  test("projects Accordion's single and multiple conditional API shapes", () => {
    const accordion = contract.exports["accordion\u0000Accordion"].component!
    const single = accordion.conditionalApi.find((entry) => entry.when.equals === "single")!
    const multiple = accordion.conditionalApi.find((entry) => entry.when.equals === "multiple")!

    expect(single.shape.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "value", availability: "available", type: { kind: "string" } }),
    ]))
    expect(multiple.shape.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "value", availability: "available", type: { kind: "array", item: { kind: "string" } } }),
      expect.objectContaining({ name: "collapsible", availability: "unavailable" }),
    ]))
    expect(contract.capabilityIds).toContain("dialog.context")
  })

  test("preserves hardConstraints as opaque composition facts rather than capability vocabulary", () => {
    const hardConstraint = "opaque.relationship"
    const source = structuredClone(loadComponentContracts()) as unknown as LoadedComponentContracts
    const button = source.families.find((family) => family.id === "button")!.exports.find((entry) => entry.name === "Button")!.component! as unknown as { composition: { hardConstraints: string[] } }
    button.composition.hardConstraints = [hardConstraint]

    const projected = projectExecutableContract({ componentContracts: source, tokenContract: getTokenContract() })
    const projectedButton = projected.exports["button\u0000Button"].component!

    expect(projectedButton.composition.hardConstraints).toEqual([hardConstraint])
    expect(projected.capabilityIds).not.toContain(hardConstraint)
  })

  test("projects wrapper-supplied inherited prop defaults as effective facts", () => {
    const separator = contract.exports["separator\u0000Separator"].component!

    expect(separator.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "orientation", default: "horizontal", origin: "inherited" }),
      expect.objectContaining({ name: "decorative", default: true, origin: "inherited" }),
    ]))
  })

  test("freezes the projection so validators cannot mutate factual authority", () => {
    expect(Object.isFrozen(contract)).toBe(true)
    expect(Object.isFrozen(contract.exports)).toBe(true)
    expect(Object.isFrozen(contract.exports["button\u0000Button"])).toBe(true)
    expect(Object.isFrozen(contract.exports["button\u0000Button"].component?.props)).toBe(true)
    expect(() => ((contract.exports["button\u0000Button"] as { name: string }).name = "forged")).toThrow(TypeError)
  })

  test("does not freeze the loaded Phase 3 source while freezing the projection", () => {
    const source = structuredClone(loadComponentContracts()) as unknown as LoadedComponentContracts
    const sourceComposition = source.families.find((family) => family.id === "button")!.exports.find((entry) => entry.name === "Button")!.component!.composition

    const projected = projectExecutableContract({ componentContracts: source, tokenContract: getTokenContract() })

    expect(Object.isFrozen(sourceComposition)).toBe(false)
    expect(Object.isFrozen(projected.exports["button\u0000Button"].component!.composition)).toBe(true)
  })

  test("rejects a token authority that is not approved", () => {
    const candidateTokenContract = { ...getTokenContract(), status: "candidate" as const }

    expect(() => projectExecutableContract({ componentContracts: loadComponentContracts(), tokenContract: candidateTokenContract })).toThrowError(/\[EXECUTABLE_TOKEN_CONTRACT_NOT_APPROVED\]/)
  })
})
