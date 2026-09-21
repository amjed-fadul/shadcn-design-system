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

function portable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, current) => {
    if (typeof current !== "string") return current
    return current.replace(
      /import\("[^"]*\/node_modules\/([^"]+)"\)/g,
      'import("$1")'
    )
  }) as T
}

function writeInterface(id: string, source: SourceDescriptor, eventNames: string[] = []) {
  const full = analyzePackageComponentInterface(source)
  const events = eventNames.length
    ? analyzePackageComponentInterface(source, { props: [], events: eventNames }).events
    : []

  const contract = portable({
    schemaVersion: 1,
    id,
    source,
    evidence: {
      declaration: {
        kind: "inherited-interface",
        source: `${source.declarationPath}@${source.declarationSha256}`,
      },
    },
    props: full.props.filter((prop) => !eventNames.includes(prop.name)),
    events,
    conditionalApi: full.conditionalApi,
    unresolved: [],
  })

  const path = `contracts/components/interfaces/${id}.json`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(contract, null, 2) + "\n")
}

describe("generate Alert Dialog inherited interfaces", () => {
  test("writes exact pinned interface artifacts", () => {
    const declarationPath = "node_modules/@radix-ui/react-alert-dialog/dist/index.d.ts"
    const declaration = readFileSync(declarationPath)
    const declarationSha256 = createHash("sha256").update(declaration).digest("hex")
    const version = JSON.parse(
      readFileSync("node_modules/@radix-ui/react-alert-dialog/package.json", "utf8")
    ).version as string

    const descriptor = (symbol: string): SourceDescriptor => ({
      kind: "package-declaration",
      package: "@radix-ui/react-alert-dialog",
      version,
      declarationPath,
      declarationSha256,
      symbol,
    })

    writeInterface("radix.alert-dialog.root", descriptor("Root"), ["onOpenChange"])
    writeInterface("radix.alert-dialog.trigger", descriptor("Trigger"))
    writeInterface("radix.alert-dialog.portal", descriptor("Portal"))
    writeInterface("radix.alert-dialog.overlay", descriptor("Overlay"))
    writeInterface("radix.alert-dialog.content", descriptor("Content"))
    writeInterface("radix.alert-dialog.action", descriptor("Action"))
    writeInterface("radix.alert-dialog.cancel", descriptor("Cancel"))
    writeInterface("radix.alert-dialog.title", descriptor("Title"))
    writeInterface("radix.alert-dialog.description", descriptor("Description"))

    expect(version).toBe("1.1.23")
    console.log("ALERT_DIALOG_DECLARATION_SHA=" + declarationSha256)
  })
})
