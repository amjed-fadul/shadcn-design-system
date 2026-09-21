import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, test } from "vitest"

import { analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis"
import { analyzeComponentTokenDependenciesForExport } from "../src/contracts/components/canonical-token-source-analysis"
import { analyzeJsxRenderTree } from "../src/contracts/components/render-source-analysis"

describe("popover declaration probe", () => {
  test("prints pinned declaration and source evidence", () => {
    const declarationPath = "node_modules/@radix-ui/react-popover/dist/index.d.ts"
    const source = readFileSync(declarationPath, "utf8")
    const descriptor = (symbol: string) => ({ declarationPath, symbol })
    const componentSource = "src/components/ui/popover.tsx"
    const exports = [
      "Popover",
      "PopoverTrigger",
      "PopoverContent",
      "PopoverAnchor",
      "PopoverHeader",
      "PopoverTitle",
      "PopoverDescription",
    ]

    const output = {
      sha256: createHash("sha256").update(source).digest("hex"),
      root: analyzePackageComponentInterface(descriptor("Root"), {
        props: ["children", "open", "defaultOpen", "modal"],
        events: ["onOpenChange"],
      }),
      trigger: analyzePackageComponentInterface(descriptor("Trigger"), {
        props: ["asChild"],
        events: [],
      }),
      anchor: analyzePackageComponentInterface(descriptor("Anchor"), {
        props: ["asChild", "virtualRef"],
        events: [],
      }),
      content: analyzePackageComponentInterface(descriptor("Content"), {
        props: ["forceMount", "asChild", "side", "sideOffset", "align", "alignOffset", "avoidCollisions", "collisionPadding", "sticky", "hideWhenDetached"],
        events: [],
      }),
      source: Object.fromEntries(
        exports.map((name) => [
          name,
          {
            tokens: analyzeComponentTokenDependenciesForExport(componentSource, name),
            render: analyzeJsxRenderTree(componentSource, name),
          },
        ])
      ),
    }

    console.log("POPOVER_PROBE=" + JSON.stringify(output))
  })
})
