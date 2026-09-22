import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import command from "../contracts/components/families/command.json"
import drawer from "../contracts/components/families/drawer.json"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import type { ComponentFamilyContract, RenderingFact } from "../src/contracts/components/types"
import { analyzeJsxRenderTree, compareJsxRenderTree } from "./helpers/component-source-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))

function component(family: ComponentFamilyContract, exportName: string) {
  return family.exports.find((entry) => entry.name === exportName)!.component!
}

function reconcile(familyId: "command" | "drawer", family: ComponentFamilyContract, exportName: string, rendering: RenderingFact) {
  return compareJsxRenderTree(
    rendering,
    analyzeJsxRenderTree(join(root, `src/components/ui/${familyId}.tsx`), exportName),
    canonicalRenderSourceAnalysisConventions,
  )
}

describe("canonical inherited-interface namespace mapping", () => {
  test.each([
    { familyId: "command", family: command, exportName: "Command" },
    { familyId: "command", family: command, exportName: "CommandInput" },
    { familyId: "command", family: command, exportName: "CommandList" },
    { familyId: "command", family: command, exportName: "CommandEmpty" },
    { familyId: "command", family: command, exportName: "CommandGroup" },
    { familyId: "command", family: command, exportName: "CommandSeparator" },
    { familyId: "command", family: command, exportName: "CommandItem" },
    { familyId: "drawer", family: drawer, exportName: "Drawer" },
    { familyId: "drawer", family: drawer, exportName: "DrawerTrigger" },
    { familyId: "drawer", family: drawer, exportName: "DrawerPortal" },
    { familyId: "drawer", family: drawer, exportName: "DrawerClose" },
    { familyId: "drawer", family: drawer, exportName: "DrawerOverlay" },
    { familyId: "drawer", family: drawer, exportName: "DrawerContent" },
    { familyId: "drawer", family: drawer, exportName: "DrawerTitle" },
    { familyId: "drawer", family: drawer, exportName: "DrawerDescription" },
  ] as Array<{ familyId: "command" | "drawer"; family: ComponentFamilyContract; exportName: string }>) (
    "accepts exact $familyId.$exportName inherited hosts",
    ({ familyId, family, exportName }) => {
      const definition = component(family, exportName)
      expect(reconcile(familyId, family, exportName, definition.rendering)).toEqual([])
    },
  )

  test.each([
    { familyId: "command", family: command, exportName: "Command", wrongInterfaceId: "cmdk.command.item" },
    { familyId: "command", family: command, exportName: "CommandInput", wrongInterfaceId: "radix.command.input" },
    { familyId: "drawer", family: drawer, exportName: "Drawer", wrongInterfaceId: "cmdk.drawer.root" },
    { familyId: "drawer", family: drawer, exportName: "DrawerTrigger", wrongInterfaceId: "radix.dialog.title" },
  ] as Array<{
    familyId: "command" | "drawer"
    family: ComponentFamilyContract
    exportName: string
    wrongInterfaceId: string
  }>) (
    "rejects wrong namespace or symbol for $familyId.$exportName",
    ({ familyId, family, exportName, wrongInterfaceId }) => {
      const rendering = structuredClone(component(family, exportName).rendering)
      if (!("nodes" in rendering)) throw new Error("expected a single rendering tree")
      const inheritedHost = rendering.nodes.find((node) => node.host.kind === "inherited-interface")
      if (!inheritedHost || inheritedHost.host.kind !== "inherited-interface") throw new Error("expected an inherited host")
      inheritedHost.host.interfaceId = wrongInterfaceId

      expect(reconcile(familyId, family, exportName, rendering)).toContainEqual(expect.stringContaining("Render host mismatch"))
    },
  )
})
