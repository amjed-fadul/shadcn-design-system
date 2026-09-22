import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import { analyzeIntrinsicReactInterface, analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis"
import { reconcileCanonicalComponentSources } from "../src/contracts/components/canonical-source-reconciliation"
import type { ComponentContractSet, ComponentFamilyContract, InheritedInterfaceContract } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = <T,>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8"))
const contractSet = read<ComponentContractSet>("contracts/components/component-contract-set.json")
const interfaces = contractSet.interfaceFiles.map((path) => read<InheritedInterfaceContract>(path))
const contract = (id: string) => interfaces.find((item) => item.id === id)!

function evidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs)
  if (!value || typeof value !== "object") return []
  return Object.entries(value).flatMap(([key, child]) => key === "evidenceRefs" ? child as string[] : evidenceRefs(child))
}

describe("inherited-interface declaration authority", () => {
  test("resolves React intrinsic props without traversing a package export path", () => {
    const analyzed = analyzePackageComponentInterface(contract("html.div").source)
    expect(analyzed.props).toHaveLength(265)
    expect(analyzed.props.find(({ name }) => name === "hidden")).toEqual({
      name: "hidden", required: false, type: { kind: "boolean" }, typeText: "boolean", evidenceRefs: ["declaration"],
    })
    expect(analyzed.props.find(({ name }) => name === "onClick")?.typeText).toBe("MouseEventHandler<HTMLDivElement>")
  })

  test.each([
    ["radix.label.root", "htmlFor", "string"],
    ["radix.separator.root", "decorative", "boolean"],
  ])("resolves the exported type-only declaration for %s", (id, name, kind) => {
    const analyzed = analyzePackageComponentInterface(contract(id).source)
    expect(analyzed.props).toHaveLength(267)
    expect(analyzed.props.find((prop) => prop.name === name)?.type).toEqual({ kind })
    expect(analyzed.props.find((prop) => prop.name === "asChild")?.type).toEqual({ kind: "boolean" })
    expect(analyzed.props.some((prop) => prop.name === "ref")).toBe(false)
  })

  test("preserves Separator's declared orientation enum", () => {
    expect(analyzePackageComponentInterface(contract("radix.separator.root").source).props.find(({ name }) => name === "orientation")?.type)
      .toEqual({ kind: "enum", values: ["horizontal", "vertical"] })
  })

  test("keeps imported declaration types independent of the checkout path", () => {
    const source = contract("radix.popover.anchor").source
    const prop = analyzePackageComponentInterface(source).props.find(({ name }) => name === "virtualRef")!
    const typeText = 'React.RefObject<import("@radix-ui/rect/dist/index").Measurable>'
    expect(prop.typeText).toBe(typeText)
    expect(prop.type).toEqual({ kind: "typescript", typeText })
    expect(analyzePackageComponentInterface({ ...source, declarationPath: join(root, source.declarationPath) }))
      .toEqual(analyzePackageComponentInterface(source))
  })

  test.each([
    ["vaul.drawer.content", 274, "onEscapeKeyDown"],
    ["vaul.drawer.overlay", 267, "forceMount"],
    ["vaul.drawer.portal", 3, "container"],
  ] as const)("resolves React default-import declarations for %s", (id, count, propName) => {
    const analyzed = analyzePackageComponentInterface(contract(id).source)
    expect(analyzed.props).toHaveLength(count)
    expect(analyzed.props.some(({ name }) => name === propName)).toBe(true)
  })

  test("keeps every intrinsic artifact's complete prop array from its pinned declaration", () => {
    for (const item of interfaces.filter((item) => item.source.kind === "react-intrinsic")) {
      const tag = item.source.symbol.match(/\["([^"]+)"\]/)![1] as keyof React.JSX.IntrinsicElements
      expect(item.props.map(({ name, required, typeText }) => ({ name, required, typeText })), item.id)
        .toEqual(analyzeIntrinsicReactInterface(tag))
    }
  }, 60000)

  test("references every registered interface evidence record locally", () => {
    const orphans = interfaces.flatMap((item) => {
      const refs = new Set(evidenceRefs(item))
      return Object.keys(item.evidence).filter((key) => !refs.has(key)).map((key) => `${item.id}:${key}`)
    })
    expect(orphans).toEqual([])
  })

  test("closes referenced, registered, and physical interface sets exactly", () => {
    const referenced = new Set<string>()
    for (const path of contractSet.familyFiles) for (const entry of read<ComponentFamilyContract>(path).exports) {
      if (!entry.component) continue
      entry.component.inherits.forEach((id) => referenced.add(id))
      const rendering = entry.component.rendering
      const trees = "nodes" in rendering ? [rendering] : rendering.alternatives.map((alternative) => alternative.rendering)
      for (const tree of trees) for (const node of tree.nodes) if (node.host.kind === "inherited-interface") referenced.add(node.host.interfaceId)
    }
    const physical = readdirSync(join(root, "contracts/components/interfaces")).filter((file) => file.endsWith(".json")).map((file) => `contracts/components/interfaces/${file}`).sort()
    expect(contractSet.interfaceFiles).toEqual([...referenced].sort().map((id) => `contracts/components/interfaces/${id}.json`))
    expect(contractSet.interfaceFiles.slice().sort()).toEqual(physical)
    expect(new Set(interfaces.map(({ id }) => id)).size).toBe(interfaces.length)
  })

  test("reconciles all registered interfaces against source-owned member authority", () => {
    expect(reconcileCanonicalComponentSources(root, { contractSet, families: [], interfaces })).toEqual([])
  }, 60000)

  test("enumerates the complete prop array when only the event boundary is selected", () => {
    const analyzed = analyzePackageComponentInterface(contract("cmdk.command.root").source, { events: ["onValueChange"] })
    expect(analyzed.props).toHaveLength(273)
    expect(analyzed.props.some(({ name }) => name === "onValueChange")).toBe(false)
    expect(analyzed.events).toEqual([{
      propName: "onValueChange", required: false, payload: { kind: "string" }, payloadTypeText: "string", evidenceRefs: ["declaration"],
    }])
  })

  test.each([
    ["radix.avatar.root", []],
    ["radix.avatar.image", ["onLoadingStatusChange"]],
    ["radix.avatar.fallback", []],
  ] as const)("retains the complete newly registered Avatar declaration for %s", (id, events) => {
    const item = contract(id)
    expect({ props: item.props, events: item.events ?? [], conditionalApi: item.conditionalApi ?? [] })
      .toEqual(analyzePackageComponentInterface(item.source, { events }))
  })

  test.each(["html.div", "radix.label.root", "radix.separator.root"])("rejects structured prop type drift in %s", (id) => {
    const item = { ...structuredClone(contract(id)), ...analyzePackageComponentInterface(contract(id).source) }
    const reconcile = () => reconcileCanonicalComponentSources(root, { contractSet, families: [], interfaces: [item] })
    expect(reconcile()).toEqual([])
    item.props.find(({ name }) => name === "hidden")!.type = { kind: "number" }
    expect(reconcile()).toEqual([`Inherited interface ${id} does not match source evidence.`])
  })

  test("rejects intrinsic prop typeText drift", () => {
    const item = { ...structuredClone(contract("html.div")), ...analyzePackageComponentInterface(contract("html.div").source) }
    item.props.find(({ name }) => name === "hidden")!.typeText = "number"
    expect(reconcileCanonicalComponentSources(root, { contractSet, families: [], interfaces: [item] }))
      .toEqual(["Inherited interface html.div does not match source evidence."])
  })
})
