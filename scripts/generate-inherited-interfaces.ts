import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { canonicalInterfaceMemberAuthority } from "../src/contracts/components/canonical-interface-member-authority.ts"
import { analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis.ts"
import type { ComponentContractSet, InheritedInterfaceContract } from "../src/contracts/components/types.ts"

// Run with Node 22.18.0: node --experimental-strip-types scripts/generate-inherited-interfaces.ts [--check]
const read = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8"))
const manifest = read<ComponentContractSet>("contracts/components/component-contract-set.json")
const pending: Array<{ path: string; text: string }> = []

for (const path of manifest.interfaceFiles) {
  const contract = read<InheritedInterfaceContract>(path)
  const { source } = contract
  const actualVersion = read<{ version: string }>(join("node_modules", source.package, "package.json")).version
  const actualHash = createHash("sha256").update(readFileSync(source.declarationPath)).digest("hex")
  if (actualVersion !== source.version || actualHash !== source.declarationSha256) {
    throw new Error(`${contract.id}: installed declaration does not match its package/version/hash pin.`)
  }
  const members = canonicalInterfaceMemberAuthority[contract.id]
  if (source.kind !== "react-intrinsic" && !source.symbol.endsWith("Props") && !members) {
    throw new Error(`${contract.id}: no canonical source-member authority.`)
  }
  const analyzed = analyzePackageComponentInterface(source, members)
  const current = { props: contract.props, events: contract.events ?? [], conditionalApi: contract.conditionalApi ?? [] }
  if (JSON.stringify(current) === JSON.stringify(analyzed)) continue
  contract.props = analyzed.props
  if (contract.events || analyzed.events.length) contract.events = analyzed.events
  if (contract.conditionalApi || analyzed.conditionalApi.length) contract.conditionalApi = analyzed.conditionalApi
  const indentation = readFileSync(path, "utf8").trim().includes("\n") ? 2 : undefined
  pending.push({ path, text: `${JSON.stringify(contract, null, indentation)}\n` })
}

if (process.argv.includes("--check")) {
  for (const { path } of pending) console.error(`Stale inherited interface: ${path}`)
  process.exitCode = pending.length ? 1 : 0
} else {
  for (const { path, text } of pending) {
    writeFileSync(path, text)
    console.log(path)
  }
}
console.log(`${manifest.interfaceFiles.length} pinned interfaces checked; ${pending.length} ${process.argv.includes("--check") ? "stale" : "regenerated"}.`)
