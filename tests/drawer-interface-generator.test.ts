import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { describe, expect, test } from "vitest"

import { analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis"

type SourceDescriptor = {
  kind: "package-declaration"
  package: string
  version: string
  declarationPath: string
  declarationSha256: string
  symbol: string
}

function writeInterface(id: string, source: SourceDescriptor, eventNames: string[] = []) {
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

describe("generate drawer inherited interfaces", () => {
  test("writes exact Vaul interface artifacts", () => {
    const declarationPath = "node_modules/vaul/dist/index.d.ts"
    const declaration = readFileSync(declarationPath)
    const sha = createHash("sha256").update(declaration).digest("hex")
    const version = JSON.parse(readFileSync("node_modules/vaul/package.json", "utf8")).version as string

    const source = (symbol: string): SourceDescriptor => ({
      kind: "package-declaration",
      package: "vaul",
      version,
      declarationPath,
      declarationSha256: sha,
      symbol,
    })

    writeInterface("vaul.drawer.root", source("Root"), ["onOpenChange"])
    writeInterface("vaul.drawer.overlay", source("Overlay"))
    writeInterface("vaul.drawer.content", source("Content"))
    writeInterface("vaul.drawer.portal", source("Portal"))

    expect(version).toBe("1.1.2")
  }, 60_000)
})
