import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import { loadExecutableRelease } from "../src/validator/release"

type JsonRecord = Record<string, any>

const release002Path = "provenance/releases/shadcn-radix-release-002.json"
const release003Path = "provenance/releases/shadcn-radix-release-003.json"
const portalContainerType = {
  kind: "union",
  members: [
    { kind: "typescript", typeText: "Element" },
    { kind: "typescript", typeText: "DocumentFragment" },
  ],
}

describe("release003 approved delta", () => {
  test("retains committed release002 bytes and changes only approved release003 semantics", () => {
    const previousBytes = readFileSync(release002Path, "utf8")
    expect(previousBytes).toBe(execFileSync("git", ["show", `383a0bbd54a90bfdb227a788001d2793eda2c284:${release002Path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))

    const previous = JSON.parse(previousBytes) as JsonRecord
    const current = JSON.parse(readFileSync(release003Path, "utf8")) as JsonRecord
    expect(loadExecutableRelease(current, { expectedProjection: current.projection, expectedReleaseId: "shadcn-radix-release-003", requirePackageIdentity: true })).toEqual(current)

    expect(current.releaseId).toBe("shadcn-radix-release-003")
    expect(current.packageIdentity).toEqual({ ...previous.packageIdentity, version: "0.0.0-release.3" })
    expect({
      documentSchemaVersion: current.documentSchemaVersion,
      projectionSchemaVersion: current.projectionSchemaVersion,
      componentContractSetId: current.componentContractSetId,
      tokenContractId: current.tokenContractId,
      sourceBaselines: current.sourceBaselines,
    }).toEqual({
      documentSchemaVersion: previous.documentSchemaVersion,
      projectionSchemaVersion: previous.projectionSchemaVersion,
      componentContractSetId: previous.componentContractSetId,
      tokenContractId: previous.tokenContractId,
      sourceBaselines: previous.sourceBaselines,
    })

    const previousInputs = new Map<string, JsonRecord>(previous.implementationInputs.map((entry: JsonRecord) => [entry.path, entry]))
    const currentInputs = new Map<string, JsonRecord>(current.implementationInputs.map((entry: JsonRecord) => [entry.path, entry]))
    const addedInputs = [...currentInputs.keys()].filter(path => !previousInputs.has(path)).sort()
    const removedInputs = [...previousInputs.keys()].filter(path => !currentInputs.has(path)).sort()
    const changedInputs = [...currentInputs.keys()].filter(path => {
      const before = previousInputs.get(path)
      const after = currentInputs.get(path)!
      return before && (before.gitBlob !== after.gitBlob || before.sha256 !== after.sha256)
    }).sort()
    expect(previousInputs.size).toBe(205)
    expect(currentInputs.size).toBe(209)
    expect(addedInputs).toEqual([
      "contracts/components/families/switch.json",
      "contracts/components/interfaces/radix.switch.root.json",
      "node_modules/@radix-ui/react-switch/dist/index.d.ts",
      "src/components/ui/switch.tsx",
    ])
    expect(removedInputs).toEqual([])
    expect(changedInputs).toEqual([
      "contracts/components/component-contract-set.json",
      "contracts/components/families/dropdown-menu.json",
      "contracts/components/families/sheet.json",
      "contracts/components/families/tooltip.json",
      "contracts/components/index.json",
      "package-lock.json",
      "package.json",
      "provenance/component-contract-source.json",
      "provenance/seed-components.json",
      "scripts/release-inputs.ts",
      "src/components/ui/dropdown-menu.tsx",
      "src/components/ui/sheet.tsx",
      "src/components/ui/tooltip.tsx",
      "src/contracts/components/canonical-interface-member-authority.ts",
      "src/contracts/components/canonical-loader.ts",
      "src/package/index.ts",
      "src/validator/canonical-release.ts",
      "src/validator/release.ts",
    ])

    const projection = structuredClone(current.projection)
    const portalTargets: [string, number][] = [
      ["dropdown-menu\0DropdownMenuContent", 0],
      ["sheet\0SheetContent", 2],
      ["tooltip\0TooltipContent", 0],
    ]
    for (const [key, conditionalBranchCount] of portalTargets) {
      const component = projection.exports[key].component
      expect(component.conditionalApi).toHaveLength(conditionalBranchCount)
      for (const [shape, origin] of [[component, "local"], ...component.conditionalApi.map((branch: JsonRecord) => [branch.shape, "conditional"])] as [JsonRecord, string][]) {
        expect(shape.props.filter((prop: JsonRecord) => prop.name === "portalContainer")).toEqual([{
          name: "portalContainer",
          availability: "available",
          required: false,
          type: portalContainerType,
          origin,
        }])
        shape.props = shape.props.filter((prop: JsonRecord) => prop.name !== "portalContainer")
      }
    }

    expect(Object.keys(projection.exports)).toHaveLength(108)
    expect(projection.exports["switch\0Switch"]).toEqual({
      familyId: "switch",
      name: "Switch",
      kind: "component",
      authorableJsx: true,
      component: {
        props: [
          { name: "size", availability: "available", required: false, type: { kind: "enum", values: ["sm", "default"] }, origin: "local", default: "default" },
          { name: "checked", availability: "available", required: false, type: { kind: "boolean" }, origin: "inherited" },
          { name: "defaultChecked", availability: "available", required: false, type: { kind: "boolean" }, origin: "inherited" },
          { name: "required", availability: "available", required: false, type: { kind: "boolean" }, origin: "inherited" },
        ],
        events: [{ propName: "onCheckedChange", required: false, payload: { kind: "boolean" }, origin: "inherited" }],
        stateChannels: [{
          name: "checked",
          controlledProp: "checked",
          defaultProp: "defaultChecked",
          changeEventProp: "onCheckedChange",
          evidenceRefs: ["source", "declaration"],
        }],
        conditionalApi: [],
        slots: [],
        composition: { requires: [], provides: [], hardConstraints: [] },
        tokenDependencies: [
          { tokenId: "color.ring", evidenceRefs: ["source", "tokens"] },
          { tokenId: "color.primary", evidenceRefs: ["source", "tokens"] },
          { tokenId: "color.input", evidenceRefs: ["source", "tokens"] },
          { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 8 }, evidenceRefs: ["source", "tokens"] },
          { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 3.5 }, evidenceRefs: ["source", "tokens"] },
          { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 6 }, evidenceRefs: ["source", "tokens"] },
          { tokenId: "color.background", evidenceRefs: ["source", "tokens"] },
          { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 3 }, evidenceRefs: ["source", "tokens"] },
          { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 4 }, evidenceRefs: ["source", "tokens"] },
        ],
        unresolved: [],
      },
      unresolved: [],
    })
    delete projection.exports["switch\0Switch"]
    expect(projection).toEqual(previous.projection)
  })
})
