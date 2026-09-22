import { describe, expect, test } from "vitest"

import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import type { StructuredPropType } from "../src/contracts/components/types"
import { getTokenContract } from "../src/contracts/tokens/contract"
import { projectExecutableContract, validateAuthoredUi, type ValidationError } from "../src/validator"
import type { AuthoredNode, AuthoredUi, AuthoredValue, ExecutableComponent, ExecutableExport, JsonValue } from "../src/validator/types"

const contract = projectExecutableContract({
  componentContracts: loadComponentContracts(),
  tokenContract: getTokenContract(),
})

const familyIds = [
  "accordion",
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "card",
  "checkbox",
  "collapsible",
  "command",
  "dialog",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "input-group",
  "input",
  "label",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toggle",
  "toggle-group",
  "tooltip",
] as const

const literal = (value: JsonValue): AuthoredValue => ({ kind: "literal", value })

function component(familyId: string, exportName: string, props: Record<string, AuthoredValue> = {}, children: AuthoredNode[] = [], id = `${familyId}-${exportName}`): AuthoredNode {
  return { kind: "component", id, familyId, exportName, props, children, location: { path: id } }
}

function text(value: string, id: string): AuthoredNode {
  return { kind: "text", id, value, location: { path: id } }
}

function intrinsic(tag: string, id: string): AuthoredNode {
  return { kind: "intrinsic", id, tag, children: [], location: { path: id } }
}

function authoredValueForType(type: StructuredPropType): AuthoredValue {
  if (type.kind === "boolean") return literal(false)
  if (type.kind === "string") return literal("value")
  if (type.kind === "number") return literal(0)
  if (type.kind === "enum") return literal(type.values[0])
  if (type.kind === "literal") return literal(type.value)
  if (type.kind === "array") return literal([])
  if (type.kind === "union") return authoredValueForType(type.members[0])
  return { kind: "expression", expression: "unresolved-required-value" }
}

function componentFor(entry: ExecutableExport): ExecutableComponent {
  if (!entry.component) throw new Error(`Expected component export: ${entry.familyId}.${entry.name}`)
  return entry.component
}

function bareNode(entry: ExecutableExport, childrenOverride?: AuthoredNode[], propsOverride: Record<string, AuthoredValue> = {}): AuthoredNode {
  const componentContract = componentFor(entry)
  const props: Record<string, AuthoredValue> = {}
  for (const prop of componentContract.props) {
    if (prop.availability === "available" && prop.required && prop.name !== "children") props[prop.name] = authoredValueForType(prop.type)
  }
  const selected = new Map<string, string | number | boolean>()
  for (const conditional of componentContract.conditionalApi) {
    if (!selected.has(conditional.when.propName)) selected.set(conditional.when.propName, conditional.when.equals)
  }
  for (const [propName, value] of selected) props[propName] ??= literal(value)
  Object.assign(props, propsOverride)

  const children = childrenOverride ?? (
    componentContract.props.some((prop) => prop.availability === "available" && prop.required && prop.name === "children")
      ? [intrinsic("span", `${entry.familyId}-${entry.name}-child`)]
      : componentContract.slots.some((slot) => slot.default)
        ? [intrinsic("span", `${entry.familyId}-${entry.name}-slot-child`)]
        : []
  )
  return component(entry.familyId, entry.name, props, children)
}

function entryFor(familyId: string, exportName: string): ExecutableExport {
  const entry = contract.exports[`${familyId}\u0000${exportName}`]
  if (!entry) throw new Error(`Missing projected export: ${familyId}.${exportName}`)
  return entry
}

function nodeFor(familyId: string, exportName: string, children?: AuthoredNode[], props: Record<string, AuthoredValue> = {}): AuthoredNode {
  const entry = entryFor(familyId, exportName)
  let root = bareNode(entry, children, props)
  for (const capability of componentFor(entry).composition.requires) {
    const provider = Object.values(contract.exports).find((candidate) => candidate.component?.composition.provides.includes(capability))
    if (!provider) throw new Error(`No capability provider for ${capability}`)
    root = nodeFor(provider.familyId, provider.name, [root])
  }
  return root
}

function ui(root: AuthoredNode, tokenIds: string[] = []): AuthoredUi {
  return {
    root,
    tokenUses: tokenIds.map((tokenId, index) => ({ tokenId, location: { path: `${root.id}.tokenUses[${index}]` } })),
  }
}

function errorsFor(input: AuthoredUi): ValidationError[] {
  return [...validateAuthoredUi(input, contract).errors]
}

const approvedUnresolvedFacts = new Map<string, string[]>([
  ["drawer.Drawer", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerClose", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerContent", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerDescription", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerOverlay", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerPortal", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerTitle", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
  ["drawer.DrawerTrigger", ["UNRESOLVED_FACT:Factual contract for drawer.Drawer is unresolved: snap-point fade conditional API."]],
])

describe("Phase 5 executable validator coverage across all 38 canonical families", () => {
  test("projects and resolves every authorable canonical export", () => {
    const projectedFamilies = new Set(Object.values(contract.exports).map((entry) => entry.familyId))
    const authorable = Object.values(contract.exports).filter((entry) => entry.authorableJsx && entry.kind === "component")
    const nonAuthorable = Object.values(contract.exports).filter((entry) => !entry.authorableJsx)
    const hardConstraints = Object.values(contract.exports).flatMap((entry) => entry.component?.composition.hardConstraints ?? [])

    expect([...projectedFamilies].sort()).toEqual([...familyIds].sort())
    expect(authorable).toHaveLength(199)
    expect(nonAuthorable).toHaveLength(6)
    expect(hardConstraints).toEqual([])
    const failures: Array<{ exportId: string; errors: ReadonlyArray<ValidationError> }> = []
    for (const entry of authorable) {
      const exportId = `${entry.familyId}.${entry.name}`
      const result = validateAuthoredUi({ root: nodeFor(entry.familyId, entry.name) }, contract)
      const actual = result.errors.map((error) => `${error.code}:${error.message}`)
      const approved = approvedUnresolvedFacts.get(exportId) ?? []
      if (!approved.length) {
        expect(result.errors, exportId).toEqual([])
      } else if (actual.join("\u0000") !== approved.join("\u0000")) {
        failures.push({ exportId, errors: result.errors })
      }
    }
    expect(failures).toEqual([])
  })

  test("models FieldError useMemo children as a source-backed dynamic expression", async () => {
    const { analyzeJsxRenderTree } = await import("../src/contracts/components/render-source-analysis")
    const result = analyzeJsxRenderTree("src/components/ui/field.tsx", "FieldError")
    expect(result.unresolved).toEqual([])
    expect(result.root?.kind).toBe("intrinsic")
  })

  test.each([
    ["unknown family/export identity", component("missing-family", "Button"), "UNKNOWN_EXPORT"],
    ["non-authorable helper export", component("button", "buttonVariants"), "NON_AUTHORABLE_EXPORT"],
    ["invalid local enum literal", component("badge", "Badge", { variant: literal("invented") }), "INVALID_PROP_VALUE"],
    ["invalid inherited boolean literal", component("button", "Button", { disabled: literal("yes") }), "INVALID_PROP_VALUE"],
    ["missing factual required prop", component("accordion", "Accordion"), "INVALID_PROP"],
    ["missing structural required children", component("tooltip", "TooltipProvider"), "INVALID_PROP"],
    ["invalid state value type", component("checkbox", "Checkbox", { checked: literal("yes") }), "INVALID_PROP_VALUE"],
    ["incompatible state event callback", component("checkbox", "Checkbox", { onCheckedChange: { kind: "callback", parameterType: { kind: "string" } } }), "INVALID_PROP_VALUE"],
    ["invalid Accordion discriminated value", component("accordion", "Accordion", { type: literal("multiple"), value: literal("one") }), "INVALID_PROP_VALUE"],
    ["Slot cardinality overflow", nodeFor("dialog", "DialogTrigger", [text("one", "slot-one"), text("two", "slot-two")], { asChild: literal(true) }), "SLOT_VIOLATION"],
    ["unresolved Slot enablement", nodeFor("dialog", "DialogTrigger", [intrinsic("button", "dynamic-slot-child")], { asChild: { kind: "expression", expression: "useSlot" } }), "UNRESOLVED_FACT"],
    ["missing ancestor capability", component("select", "SelectItem", { value: literal("one") }), "CAPABILITY_VIOLATION"],
    ["unsupported opaque event payload", nodeFor("dropdown-menu", "DropdownMenuItem", [], { onSelect: { kind: "callback", parameterType: { kind: "string" } } }), "UNRESOLVED_FACT"],
    ["invalid explicit token", component("button", "Button"), "INVALID_TOKEN"],
    ["unresolved authored expression", component("button", "Button", { variant: { kind: "expression", expression: "requestedVariant" } }), "UNRESOLVED_FACT"],
  ] as const)("fails closed for %s", (_name, root, code) => {
    const tokenIds = _name === "invalid explicit token" ? ["spacing.unknown"] : []
    const errors = errorsFor(ui(root, tokenIds))
    expect(errors.some((entry) => entry.code === code), _name).toBe(true)
  })

  test("accepts controlled/default state channels and factual callback payloads", () => {
    const select = validateAuthoredUi({ root: nodeFor("select", "Select", [], { value: literal("one"), defaultValue: literal("two"), onValueChange: { kind: "callback", parameterType: { kind: "string" } } }), tokenUses: [] }, contract)
    const checkbox = validateAuthoredUi({
      root: component("checkbox", "Checkbox", {
        checked: literal(true),
        defaultChecked: literal(false),
        onCheckedChange: {
          kind: "callback",
          parameterType: { kind: "union", members: [{ kind: "literal", value: false }, { kind: "literal", value: true }, { kind: "literal", value: "indeterminate" }] },
        },
      }),
    }, contract)

    expect(select.ok).toBe(true)
    expect(checkbox).toEqual({ ok: true, errors: [] })
  })

  test("validates an approved derived token rule reference without accepting unknown rules", () => {
    const valid = {
      root: component("button", "Button"),
      tokenUses: [{ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", parameter: literal(2) }, location: { path: "button-Button.tokenUses[0]" } }],
    }
    const invalid = {
      root: component("button", "Button"),
      tokenUses: [{ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.unknown", parameter: literal(2) }, location: { path: "button-Button.tokenUses[0]" } }],
    }

    expect(validateAuthoredUi(valid, contract)).toEqual({ ok: true, errors: [] })
    expect(validateAuthoredUi(invalid, contract).errors[0]).toMatchObject({ code: "INVALID_DERIVED_TOKEN_RULE" })
  })

  test("fails closed for unresolved or out-of-range derived token parameters", () => {
    const unresolvedParameter: AuthoredValue = { kind: "expression", expression: "multiplier" }
    const expression = {
      root: component("button", "Button"),
      tokenUses: [{ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", parameter: unresolvedParameter }, location: { path: "button-Button.tokenUses[0]" } }],
    }
    const negative = {
      root: component("button", "Button"),
      tokenUses: [{ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", parameter: literal(-1) }, location: { path: "button-Button.tokenUses[0]" } }],
    }

    expect(validateAuthoredUi(expression, contract).errors[0]).toMatchObject({ code: "UNRESOLVED_FACT" })
    expect(validateAuthoredUi(negative, contract).errors[0]).toMatchObject({ code: "INVALID_DERIVED_TOKEN_PARAMETER" })
  })
})
