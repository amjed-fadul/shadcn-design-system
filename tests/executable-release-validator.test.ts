import { describe, expect, test } from "vitest"

import {
  getExecutableRelease,
  validateAuthoredUiAgainstRelease,
} from "../src/validator/canonical-release"
import { loadExecutableRelease } from "../src/validator/release"
import type {
  AuthoredNode,
  AuthoredTokenUse,
  AuthoredUi,
  AuthoredValue,
  ExecutableRelease,
  JsonValue,
} from "../src/validator/types"

const release = getExecutableRelease()

const literal = (value: JsonValue): AuthoredValue => ({ kind: "literal", value })

function component(
  familyId: string,
  exportName: string,
  props: Record<string, AuthoredValue> = {},
  children: AuthoredNode[] = [],
  id = `${familyId}-${exportName}`,
): AuthoredNode {
  return { kind: "component", id, familyId, exportName, props, children, location: { path: `page.${id}` } }
}

function intrinsic(tag: string, children: AuthoredNode[] = [], id = tag): AuthoredNode {
  return { kind: "intrinsic", id, tag, children, location: { path: `page.${id}` } }
}

function text(value: string, id = `text-${value}`): AuthoredNode {
  return { kind: "text", id, value, location: { path: `page.${id}` } }
}

function ui(root: AuthoredNode, tokenUses: AuthoredTokenUse[] = []): AuthoredUi {
  return { root, tokenUses }
}

function validDialog(): AuthoredNode {
  return component("dialog", "Dialog", {}, [
    component("dialog", "DialogTrigger", { asChild: literal(true) }, [
      component("button", "Button", { variant: literal("outline") }, [text("Open", "dialog-open-label")], "dialog-open-button"),
    ], "dialog-trigger"),
    component("dialog", "DialogContent", { showCloseButton: literal(true) }, [
      component("dialog", "DialogTitle", {}, [text("Details", "dialog-title-text")], "dialog-title"),
      component("dialog", "DialogDescription", {}, [text("Review the selected record.", "dialog-description-text")], "dialog-description"),
      component("dialog", "DialogClose", { asChild: literal(true) }, [
        component("button", "Button", {}, [text("Close", "dialog-close-label")], "dialog-close-button"),
      ], "dialog-close"),
    ], "dialog-content"),
  ])
}

function validSelect(): AuthoredNode {
  return component("select", "Select", {
    value: literal("overview"),
    defaultValue: literal("overview"),
    onValueChange: { kind: "callback", parameterType: { kind: "string" } },
  }, [
    component("select", "SelectTrigger", { asChild: literal(true) }, [
      component("button", "Button", {}, [text("Choose view", "select-trigger-label")], "select-trigger-button"),
    ], "select-trigger"),
    component("select", "SelectContent", { position: literal("popper") }, [
      component("select", "SelectItem", { value: literal("overview") }, [text("Overview", "select-overview-label")], "select-overview"),
      component("select", "SelectItem", { value: literal("settings") }, [text("Settings", "select-settings-label")], "select-settings"),
    ], "select-content"),
  ])
}

function validDropdownMenu(): AuthoredNode {
  return component("dropdown-menu", "DropdownMenu", {}, [
    component("dropdown-menu", "DropdownMenuTrigger", { asChild: literal(true) }, [
      component("button", "Button", {}, [text("Actions", "menu-trigger-label")], "menu-trigger-button"),
    ], "menu-trigger"),
    component("dropdown-menu", "DropdownMenuContent", {}, [
      component("dropdown-menu", "DropdownMenuItem", { variant: literal("default") }, [text("Duplicate", "menu-duplicate-label")], "menu-duplicate"),
      component("dropdown-menu", "DropdownMenuSub", {}, [
        component("dropdown-menu", "DropdownMenuSubTrigger", { asChild: literal(true) }, [
          component("button", "Button", {}, [text("More", "menu-more-label")], "menu-more-button"),
        ], "menu-more"),
        component("dropdown-menu", "DropdownMenuSubContent", {}, [
          component("dropdown-menu", "DropdownMenuItem", {}, [text("Archive", "menu-archive-label")], "menu-archive"),
        ], "menu-sub-content"),
      ], "menu-sub"),
    ], "menu-content"),
  ])
}

function validSidebarPage(): AuthoredNode {
  return component("sidebar", "SidebarProvider", {}, [
    component("sidebar", "Sidebar", { variant: literal("inset") }, [
      component("sidebar", "SidebarContent", {}, [
        component("sidebar", "SidebarMenu", {}, [
          component("sidebar", "SidebarMenuItem", {}, [
            component("sidebar", "SidebarMenuButton", { asChild: literal(true), isActive: literal(true), size: literal("sm") }, [
              component("button", "Button", {}, [text("Overview", "sidebar-overview-label")], "sidebar-overview-button"),
            ], "sidebar-overview"),
          ], "sidebar-menu-item"),
        ], "sidebar-menu"),
      ], "sidebar-content"),
    ], "sidebar"),
    component("sidebar", "SidebarTrigger", {}, [text("Toggle navigation", "sidebar-toggle-label")], "sidebar-trigger"),
    intrinsic("main", [validDialog(), validSelect(), validDropdownMenu()], "main-content"),
  ], "sidebar-provider")
}

type MutableRelease = {
  -readonly [Key in keyof ExecutableRelease]: ExecutableRelease[Key]
}

function cloneRelease(value: ExecutableRelease): MutableRelease {
  return structuredClone(value) as MutableRelease
}

describe("production validator against immutable release", () => {
  test("accepts a realistic composed page with valid capabilities and token uses", () => {
    const result = validateAuthoredUiAgainstRelease(ui(validSidebarPage(), [
      { tokenId: "color.primary", location: { path: "page.tokens.color.primary" } },
      {
        tokenId: "spacing.unit",
        viaDerivedRule: { id: "spacing.multiplier", parameter: literal(2) },
        location: { path: "page.tokens.spacing.unit" },
      },
      {
        tokenId: "spacing.unit",
        viaDerivedRule: { id: "spacing.multiplier", parameter: literal(-1) },
        location: { path: "page.tokens.spacing.unit.negative" },
      },
    ]))

    expect(result).toEqual({ ok: true, errors: [] })
  })

  test.each([
    ["unknown component/export", component("dialog", "NotARealExport"), "UNKNOWN_EXPORT"],
    ["hook/helper authored as JSX", component("button", "buttonVariants"), "NON_AUTHORABLE_EXPORT"],
    ["invalid prop", component("button", "Button", { invented: literal(true) }), "INVALID_PROP"],
    ["invalid enum/variant", component("button", "Button", { variant: literal("pill") }), "INVALID_PROP_VALUE"],
    ["required prop missing", component("accordion", "Accordion"), "INVALID_PROP"],
    ["invalid Accordion single value", component("accordion", "Accordion", { type: literal("single"), value: literal(["one"]) }), "INVALID_PROP_VALUE"],
    ["unavailable Accordion multiple prop", component("accordion", "Accordion", { type: literal("multiple"), collapsible: literal(true) }), "CONDITIONAL_API_VIOLATION"],
    ["unresolved Accordion branch", component("accordion", "Accordion", { value: literal(["one"]) }), "UNRESOLVED_FACT"],
    ["missing required ancestor capability", component("dialog", "DialogContent", {}, [text("orphan", "orphan-text")]), "CAPABILITY_VIOLATION"],
    ["invalid token", component("button", "Button"), "INVALID_TOKEN"],
    ["unresolved authored expression", component("button", "Button", { variant: { kind: "expression", expression: "requestedVariant" } }), "UNRESOLVED_FACT"],
  ] as const)("rejects %s", (_name, root, code) => {
    const tokenUses: AuthoredTokenUse[] = _name === "invalid token"
      ? [{ tokenId: "color.not-approved", location: { path: "page.tokens.invalid" } }]
      : []
    const result = validateAuthoredUiAgainstRelease(ui(root, tokenUses))

    expect(result.ok).toBe(false)
    expect(result.errors.some((entry) => entry.code === code), _name).toBe(true)
  })

  test("reports Slot/asChild cardinality with factual target, expected shape, and received count", () => {
    const root = component("dialog", "Dialog", {}, [
      component("dialog", "DialogTrigger", { asChild: literal(true) }, [text("one", "slot-one"), text("two", "slot-two")], "overflow-trigger"),
    ])
    const result = validateAuthoredUiAgainstRelease(ui(root))
    const error = result.errors.find((entry) => entry.code === "SLOT_VIOLATION")

    expect(error).toMatchObject({
      target: { kind: "children", nodeId: "overflow-trigger", location: { path: "page.overflow-trigger" } },
      expected: { kind: "slot-child", min: 0, max: 1 },
      received: 2,
    })
    expect(error?.repair).toBeUndefined()
  })

  test("accepts valid capability composition through each major provider family", () => {
    for (const [name, root] of [
      ["Dialog", validDialog()],
      ["Select", validSelect()],
      ["DropdownMenu", validDropdownMenu()],
      ["Sidebar", validSidebarPage()],
    ] as const) {
      expect(validateAuthoredUiAgainstRelease(ui(root)).errors, name).toEqual([])
    }
  })

  test("keeps state-channel types/events factual without prohibiting controlled plus default values", () => {
    const result = validateAuthoredUiAgainstRelease(ui(validSelect()))

    expect(result).toEqual({ ok: true, errors: [] })
  })

  test("orders repeated factual errors deterministically and does not suggest repairs", () => {
    const root = intrinsic("main", [
      component("button", "Button", { variant: literal("pill") }, [], "nested-invalid-button"),
      component("dialog", "DialogContent", {}, [], "orphan-content"),
    ], "invalid-page")
    const first = validateAuthoredUiAgainstRelease(ui(root, [{ tokenId: "color.not-approved", location: { path: "page.tokens.invalid" } }]))
    const second = validateAuthoredUiAgainstRelease(ui(root, [{ tokenId: "color.not-approved", location: { path: "page.tokens.invalid" } }]))

    expect(first).toEqual(second)
    expect(first.errors.map((entry) => entry.target.location.path)).toEqual([
      "page.nested-invalid-button.variant",
      "page.orphan-content",
      "page.tokens.invalid",
    ])
    expect(first.errors.every((entry) => entry.repair === undefined)).toBe(true)
    expect(first.errors.some((entry) => /guidance|recommended|should|prefer/i.test(entry.message))).toBe(false)
  })

  test("preserves factual expected and received values for invalid enum input", () => {
    const result = validateAuthoredUiAgainstRelease(ui(component("button", "Button", { variant: literal("pill") }, [], "bad-variant")))
    const error = result.errors[0]

    expect(error).toMatchObject({
      code: "INVALID_PROP_VALUE",
      target: { kind: "prop", nodeId: "bad-variant", propName: "variant", location: { path: "page.bad-variant.variant" } },
      expected: { kind: "enum", values: ["default", "outline", "secondary", "ghost", "destructive", "link"] },
      received: "pill",
    })
    expect(error.repair).toBeUndefined()
  })

  test("fails closed before production validation when release identity is tampered", () => {
    const candidate = cloneRelease(release)
    candidate.releaseId = "shadcn-radix-release-forged"

    expect(() => loadExecutableRelease(candidate, { expectedProjection: release.projection })).toThrowError(/RELEASE_ID_MISMATCH/)
  })

  test("fails closed when the immutable release projection is changed", () => {
    const candidate = cloneRelease(release)
    candidate.projection = { ...candidate.projection, tokenIds: [...candidate.projection.tokenIds, "forged.token"] }

    expect(() => loadExecutableRelease(candidate, {
      expectedProjection: release.projection,
      expectedReleaseId: "shadcn-radix-release-014",
    })).toThrowError(/PROJECTION_MISMATCH|HASH_MISMATCH/)
  })
})
