import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract, validateAuthoredUi, type ValidationError } from "../src/validator"
import type { AuthoredNode, AuthoredUi, AuthoredValue, JsonValue } from "../src/validator/types"
import { createNeutralExecutableContractSource } from "./fixtures/executable-neutral-contract"

const contract = projectExecutableContract({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
})

const literal = (value: JsonValue): AuthoredValue => ({ kind: "literal", value })

function component(familyId: string, exportName: string, props: Record<string, AuthoredValue> = {}, children: AuthoredNode[] = [], id = `${familyId}-${exportName}`): AuthoredNode {
  return { kind: "component", id, familyId, exportName, props, children, location: { path: id } }
}

function text(value: string, id = `text-${value}`): AuthoredNode {
  return { kind: "text", id, value, location: { path: id } }
}

function ui(root: AuthoredNode, tokenIds: string[] = []): AuthoredUi {
  return {
    root,
    tokenUses: tokenIds.map((tokenId, index) => ({ tokenId, nodeId: root.id, location: { path: `${root.id}.tokenUses[${index}]` } })),
  }
}

function errorsFor(input: AuthoredUi): ValidationError[] {
  return [...validateAuthoredUi(input, contract).errors]
}

describe("executable contract validator", () => {
  test("accepts legal Button props and approved token uses", () => {
    expect(validateAuthoredUi(ui(component("button", "Button", { variant: literal("outline"), size: literal("sm") }, [text("Save")]), ["color.border"]), contract)).toEqual({ ok: true, errors: [] })
  })

  test("reports an unknown Button prop with a factual expected shape", () => {
    const [error] = errorsFor(ui(component("button", "Button", { variant: literal("default"), invented: literal(true) })))

    expect(error).toMatchObject({
      code: "INVALID_PROP",
      target: { kind: "prop", nodeId: "button-Button", propName: "invented", location: { path: "button-Button.invented" } },
      expected: { kind: "known-prop" },
      received: true,
    })
  })

  test("reports an illegal Button variant without inventing a repair", () => {
    const [error] = errorsFor(ui(component("button", "Button", { variant: literal("pill") })))

    expect(error).toMatchObject({ code: "INVALID_PROP_VALUE", expected: { kind: "enum", values: ["default", "outline", "secondary", "ghost", "destructive", "link"] }, received: "pill" })
    expect(error.repair).toBeUndefined()
  })

  test("selects Accordion single and multiple branches independently", () => {
    expect(validateAuthoredUi(ui(component("accordion", "Accordion", { type: literal("single"), value: literal("details"), onValueChange: { kind: "callback", parameterType: { kind: "string" } } })), contract).ok).toBe(true)
    expect(validateAuthoredUi(ui(component("accordion", "Accordion", { type: literal("multiple"), value: literal(["details", "more"]) })), contract).ok).toBe(true)

    const singleArrayError = errorsFor(ui(component("accordion", "Accordion", { type: literal("single"), value: literal(["details"]) })))[0]
    expect(singleArrayError).toMatchObject({ code: "INVALID_PROP_VALUE", target: { propName: "value" }, expected: { kind: "type", type: { kind: "string" } } })

    const multipleCollapsibleError = errorsFor(ui(component("accordion", "Accordion", { type: literal("multiple"), collapsible: literal(true) })))[0]
    expect(multipleCollapsibleError).toMatchObject({ code: "CONDITIONAL_API_VIOLATION", target: { propName: "collapsible" }, expected: { kind: "unavailable-prop" } })
  })

  test("enforces Dialog context and Slot cardinality", () => {
    const legal = component("dialog", "Dialog", {}, [
      component("dialog", "DialogTrigger", { asChild: literal(true) }, [component("button", "Button", {}, [text("Open")], "open-button")], "trigger"),
      component("dialog", "DialogContent", {}, [component("dialog", "DialogTitle", {}, [text("Details")], "title")], "content"),
    ])
    expect(validateAuthoredUi(ui(legal), contract).ok).toBe(true)

    const slotError = errorsFor(ui(component("dialog", "Dialog", {}, [component("dialog", "DialogTrigger", { asChild: literal(true) }, [text("one"), text("two")], "trigger")])))
    expect(slotError.some((error) => error.code === "SLOT_VIOLATION")).toBe(true)

    const unresolvedSlot = errorsFor(ui(component("dialog", "Dialog", {}, [component("dialog", "DialogTrigger", { asChild: { kind: "expression", expression: "useSlot" } }, [component("button", "Button")], "dynamic-trigger")])))
    expect(unresolvedSlot.some((error) => error.code === "UNRESOLVED_FACT" && error.target.propName === "asChild")).toBe(true)

    const capabilityError = errorsFor(ui(component("dialog", "DialogContent", {}, [component("dialog", "DialogTitle", {}, [], "title")])))
    expect(capabilityError[0]).toMatchObject({ code: "CAPABILITY_VIOLATION", expected: { kind: "capability", capability: "dialog.context" } })
  })

  test("enforces Sidebar provider capability facts", () => {
    expect(validateAuthoredUi(ui(component("sidebar", "SidebarProvider", {}, [component("sidebar", "Sidebar"), component("sidebar", "SidebarTrigger")])), contract).ok).toBe(true)
    expect(errorsFor(ui(component("sidebar", "Sidebar")))[0]).toMatchObject({ code: "CAPABILITY_VIOLATION", expected: { kind: "capability", capability: "sidebar.context" } })
  })

  test("routes overlapping Sidebar callback props through the factual event contract", () => {
    expect(validateAuthoredUi(ui(component("sidebar", "SidebarProvider", {
      onOpenChange: { kind: "callback", parameterType: { kind: "boolean" } },
    })), contract).ok).toBe(true)
  })

  test("rejects invalid tokens, non-authorable exports, and unresolved values", () => {
    expect(errorsFor(ui(component("button", "Button"), ["spacing.17"]))[0]).toMatchObject({ code: "INVALID_TOKEN", expected: { kind: "token" }, received: "spacing.17" })
    expect(errorsFor(ui(component("button", "buttonVariants")))[0]).toMatchObject({ code: "NON_AUTHORABLE_EXPORT" })
    expect(errorsFor(ui(component("button", "Button", { variant: { kind: "expression", expression: "requestedVariant" } })))[0]).toMatchObject({ code: "UNRESOLVED_FACT" })
  })

  test("allows controlled and default Accordion values to coexist when their factual types are valid", () => {
    expect(validateAuthoredUi(ui(component("accordion", "Accordion", { type: literal("single"), value: literal("one"), defaultValue: literal("two") })), contract)).toEqual({ ok: true, errors: [] })
  })

  test("fails closed for branch-sensitive Accordion props without a discriminator", () => {
    const errors = errorsFor(ui(component("accordion", "Accordion", { value: literal(["one"]), collapsible: literal(true) })))

    expect(errors.some((entry) => entry.code === "UNRESOLVED_FACT" && entry.target.propName === "value")).toBe(true)
    expect(errors.some((entry) => entry.code === "UNRESOLVED_FACT" && entry.target.propName === "collapsible")).toBe(true)
  })

  test("validates a fictional design system without shadcn-specific rules", () => {
    const neutral = projectExecutableContract(createNeutralExecutableContractSource())
    const valid = validateAuthoredUi(ui(component("action-button", "ActionButton", { tone: literal("critical") }, [text("Escalate")], "action-button"), ["color.signal"]), neutral)

    expect(valid).toEqual({ ok: true, errors: [] })
    expect(validateAuthoredUi(ui(component("action-button", "ActionButton", { tone: literal("primary") }, [], "invalid-action-button")), neutral).errors[0]).toMatchObject({ code: "INVALID_PROP_VALUE", expected: { kind: "enum", values: ["strong", "quiet", "critical"] } })
  })

  test("enforces composition.requires as an ancestor capability requirement", () => {
    const requiring = projectExecutableContract(createNeutralExecutableContractSource({ requires: ["nebula.context"] }))
    const result = validateAuthoredUi(ui(component("action-button", "ActionButton", {}, [], "missing-nebula-context")), requiring)

    expect(result.errors).toEqual([expect.objectContaining({
      code: "CAPABILITY_VIOLATION",
      expected: { kind: "capability", capability: "nebula.context" },
    })])
  })

  test("keeps hardConstraints opaque and fails closed when their semantics are unsupported", () => {
    const hardConstraint = "opaque.relationship"
    const constrained = projectExecutableContract(createNeutralExecutableContractSource({ hardConstraints: [hardConstraint] }))
    const projected = constrained.exports["action-button\u0000ActionButton"].component!
    const result = validateAuthoredUi(ui(component("action-button", "ActionButton", {}, [], "unsupported-hard-constraint")), constrained)

    expect(projected.composition.hardConstraints).toEqual([hardConstraint])
    expect(constrained.capabilityIds).not.toContain(hardConstraint)
    expect(result.errors).toEqual([expect.objectContaining({
      code: "UNSUPPORTED_HARD_CONSTRAINT",
      expected: { kind: "unsupported-hard-constraint", constraint: hardConstraint },
      received: hardConstraint,
    })])
    expect(result.errors.some((error) => error.code === "CAPABILITY_VIOLATION")).toBe(false)
  })
})
