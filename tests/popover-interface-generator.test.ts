import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { describe, expect, test } from "vitest"

import { analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis"

type SourceDescriptor = {
  kind: "package-declaration" | "react-intrinsic"
  package: string
  version: string
  declarationPath: string
  declarationSha256: string
  symbol: string
}

function writeInterface(
  id: string,
  source: SourceDescriptor,
  eventNames: string[] = []
) {
  const all = analyzePackageComponentInterface(source)
  const events = eventNames.length
    ? analyzePackageComponentInterface(source, { props: [], events: eventNames }).events
    : []

  const contract = {
    schemaVersion: 1,
    id,
    source,
    evidence: {
      declaration: {
        kind: "inherited-interface",
        source: `${source.declarationPath}@${source.declarationSha256}`,
      },
    },
    props: all.props.filter((prop) => !eventNames.includes(prop.name)),
    events,
    conditionalApi: all.conditionalApi,
    unresolved: [],
  }

  const path = `contracts/components/interfaces/${id}.json`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(contract, null, 2) + "\n")
}

describe("generate popover inherited interfaces", () => {
  test("writes exact pinned interface artifacts", () => {
    const popoverDeclarationPath = "node_modules/@radix-ui/react-popover/dist/index.d.ts"
    const popoverDeclaration = readFileSync(popoverDeclarationPath)
    const popoverSha = createHash("sha256").update(popoverDeclaration).digest("hex")
    const popoverVersion = JSON.parse(
      readFileSync("node_modules/@radix-ui/react-popover/package.json", "utf8")
    ).version as string

    const popover = (symbol: string): SourceDescriptor => ({
      kind: "package-declaration",
      package: "@radix-ui/react-popover",
      version: popoverVersion,
      declarationPath: popoverDeclarationPath,
      declarationSha256: popoverSha,
      symbol,
    })

    writeInterface("radix.popover.root", popover("Root"), ["onOpenChange"])
    writeInterface("radix.popover.trigger", popover("Trigger"))
    writeInterface("radix.popover.anchor", popover("Anchor"))
    writeInterface("radix.popover.portal", popover("Portal"))
    writeInterface("radix.popover.content", popover("Content"))

    const reactDeclarationPath = "node_modules/@types/react/index.d.ts"
    const reactDeclaration = readFileSync(reactDeclarationPath)
    const reactSha = createHash("sha256").update(reactDeclaration).digest("hex")
    const reactVersion = JSON.parse(
      readFileSync("node_modules/@types/react/package.json", "utf8")
    ).version as string

    const intrinsic = (tag: "h2" | "p"): SourceDescriptor => ({
      kind: "react-intrinsic",
      package: "@types/react",
      version: reactVersion,
      declarationPath: reactDeclarationPath,
      declarationSha256: reactSha,
      symbol: `React.JSX.IntrinsicElements["${tag}"]`,
    })

    writeInterface("html.h2", intrinsic("h2"))
    writeInterface("html.p", intrinsic("p"))

    expect(popoverSha).toBe("2535fc1a5fe64892783ff8f61321b181c24f824e688a4a05ae738da33466605b")
    expect(reactSha).toBe("8ca4709dbd22a34bcc1ebf93e1877645bdb02ebd3f3d9a211a299a8db2ee4ba1")
  })
})
