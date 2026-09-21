import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, test } from "vitest"

import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import * as tokenAnalysis from "./helpers/component-token-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))
const declarationPath = join(root, "node_modules/@radix-ui/react-popover/dist/index.d.ts")
const declarationSha256 = createHash("sha256").update(readFileSync(declarationPath)).digest("hex")
const sourcePath = join(root, "src/components/ui/popover.tsx")

const source = (symbol: string) => ({
  kind: "package-declaration" as const,
  package: "@radix-ui/react-popover",
  version: "1.1.23",
  declarationPath: "node_modules/@radix-ui/react-popover/dist/index.d.ts",
  declarationSha256,
  symbol,
})

describe("temporary popover contract analysis", () => {
  test("prints authoritative inherited-interface and source analysis", () => {
    const interfaces = {
      root: analyzePackageComponentInterface(source("Root"), {
        props: ["children", "open", "defaultOpen", "modal"],
        events: ["onOpenChange"],
      }),
      trigger: analyzePackageComponentInterface(source("Trigger"), { props: [], events: [] }),
      anchor: analyzePackageComponentInterface(source("Anchor"), { props: [], events: [] }),
      portal: analyzePackageComponentInterface(source("Portal"), {
        props: ["children", "container", "forceMount"],
        events: [],
      }),
      content: analyzePackageComponentInterface(source("Content"), {
        props: ["forceMount", "sideOffset", "side", "align", "avoidCollisions", "collisionPadding", "sticky", "hideWhenDetached"],
        events: [],
      }),
    }

    const renders = Object.fromEntries(
      ["Popover", "PopoverTrigger", "PopoverContent", "PopoverAnchor", "PopoverHeader", "PopoverTitle", "PopoverDescription"]
        .map((name) => [name, sourceAnalysis.analyzeJsxRenderTree(sourcePath, name)])
    )

    console.log("POPOVER_ANALYSIS_START")
    console.log(JSON.stringify({
      declarationSha256,
      interfaces,
      tokens: tokenAnalysis.analyzeComponentTokenDependencies(sourcePath),
      tokenAudit: tokenAnalysis.auditComponentTokenCoverage(sourcePath),
      renders,
      exports: sourceAnalysis.listModuleExports(sourcePath),
      defaults: {
        content: Object.fromEntries(sourceAnalysis.extractFunctionPropDefaults(sourcePath, "PopoverContent")),
      },
    }, null, 2))
    console.log("POPOVER_ANALYSIS_END")
  })
})
