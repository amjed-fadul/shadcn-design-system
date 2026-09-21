import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, test } from "vitest"

import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import * as tokenAnalysis from "./helpers/component-token-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))
const radixPath = join(root, "node_modules/@radix-ui/react-popover/dist/index.d.ts")
const radixHash = createHash("sha256").update(readFileSync(radixPath)).digest("hex")
const reactPath = join(root, "node_modules/@types/react/index.d.ts")
const reactHash = createHash("sha256").update(readFileSync(reactPath)).digest("hex")
const sourcePath = join(root, "src/components/ui/popover.tsx")

const radixSource = (symbol: string) => ({
  kind: "package-declaration" as const,
  package: "@radix-ui/react-popover",
  version: "1.1.23",
  declarationPath: "node_modules/@radix-ui/react-popover/dist/index.d.ts",
  declarationSha256: radixHash,
  symbol,
})

const fullRadix = (id: string, symbol: string, events: string[] = []) => {
  const full = analyzePackageComponentInterface(radixSource(symbol))
  const eventFacts = events.length
    ? analyzePackageComponentInterface(radixSource(symbol), { props: [], events }).events
    : []
  return {
    schemaVersion: 1,
    id,
    source: radixSource(symbol),
    evidence: {
      declaration: {
        kind: "inherited-interface",
        source: `node_modules/@radix-ui/react-popover/dist/index.d.ts@${radixHash}`,
      },
    },
    props: full.props,
    events: eventFacts,
    conditionalApi: full.conditionalApi,
    unresolved: [],
  }
}

const fullIntrinsic = (id: string, tag: "h2" | "p") => {
  const symbol = `React.JSX.IntrinsicElements["${tag}"]`
  const source = {
    kind: "react-intrinsic" as const,
    package: "@types/react",
    version: "18.3.3",
    declarationPath: "node_modules/@types/react/index.d.ts",
    declarationSha256: reactHash,
    symbol,
  }
  const full = analyzePackageComponentInterface({ declarationPath: reactPath, symbol })
  return {
    schemaVersion: 1,
    id,
    source,
    evidence: {
      declaration: {
        kind: "inherited-interface",
        source: `node_modules/@types/react/index.d.ts@${reactHash}`,
      },
    },
    props: full.props,
    unresolved: [],
  }
}

describe("temporary popover contract analysis", () => {
  test("prints authoritative generated interfaces and source analysis", () => {
    const generated = {
      "radix.popover.root": fullRadix("radix.popover.root", "Root", ["onOpenChange"]),
      "radix.popover.trigger": fullRadix("radix.popover.trigger", "Trigger"),
      "radix.popover.anchor": fullRadix("radix.popover.anchor", "Anchor"),
      "radix.popover.portal": fullRadix("radix.popover.portal", "Portal"),
      "radix.popover.content": fullRadix("radix.popover.content", "Content"),
      "html.h2": fullIntrinsic("html.h2", "h2"),
      "html.p": fullIntrinsic("html.p", "p"),
    }

    for (const [id, value] of Object.entries(generated)) {
      console.log(`GENERATED_INTERFACE|${id}|${Buffer.from(JSON.stringify(value, null, 2) + "\n").toString("base64")}`)
    }

    console.log("POPOVER_FACTS|" + Buffer.from(JSON.stringify({
      radixHash,
      reactHash,
      tokens: tokenAnalysis.analyzeComponentTokenDependencies(sourcePath),
      tokenAudit: tokenAnalysis.auditComponentTokenCoverage(sourcePath),
      renders: Object.fromEntries(
        ["Popover", "PopoverTrigger", "PopoverContent", "PopoverAnchor", "PopoverHeader", "PopoverTitle", "PopoverDescription"]
          .map((name) => [name, sourceAnalysis.analyzeJsxRenderTree(sourcePath, name)])
      ),
      exports: sourceAnalysis.listModuleExports(sourcePath),
      defaults: Object.fromEntries(sourceAnalysis.extractFunctionPropDefaults(sourcePath, "PopoverContent")),
    }, null, 2)).toString("base64"))
  })
})
