import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import contractSetJson from "../contracts/components/component-contract-set.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import { canonicalInterfaceMemberAuthority } from "../src/contracts/components/canonical-interface-member-authority"
import { resolveConditionalApiShape, validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import type { ComponentContractSet, ComponentFamilyContract, ComponentInvariantAuthority, ComponentDefinition, InheritedInterfaceContract, RenderingFact, RenderingTree } from "../src/contracts/components/types"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = fileURLToPath(new URL("../", import.meta.url))
const contractSet = contractSetJson as ComponentContractSet
const expectedFamilyIds = canonicalFamilyIds

type SeedComponent = {
  canonicalPath: string
  canonicalBlobSha: string
  upstreamPath: string
  upstreamBlobSha: string
  implementationKind: string
}

type SeedSource = { components: Record<string, SeedComponent> }

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function loadFamily(file: string): ComponentFamilyContract {
  return loadJson<ComponentFamilyContract>(join(root, file))
}

function loadInterface(file: string): InheritedInterfaceContract {
  return loadJson<InheritedInterfaceContract>(join(root, file))
}

const families = contractSet.familyFiles.map(loadFamily)
const interfaces = contractSet.interfaceFiles.map(loadInterface)
const interfacesById = new Map(interfaces.map((item) => [item.id, item]))
const familyById = new Map(families.map((item) => [item.id, item]))
const seed = loadJson<SeedSource>(join(root, "provenance/seed-components.json"))

function sourcePath(familyId: string) {
  return join(root, "src/components/ui", `${familyId}.tsx`)
}

function authority(): ComponentInvariantAuthority {
  return {
    interfaceIds: new Set(interfaces.map((item) => item.id)),
    interfacePropNames: new Map(interfaces.map((item) => [item.id, new Set(item.props.map((prop) => prop.name))])),
    interfaceContracts: interfacesById,
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
    capabilityIds: new Set(families.flatMap((family) => family.exports.flatMap((entry) => entry.component?.composition.provides ?? []))),
    componentExportIds: new Set(families.flatMap((family) => family.exports
      .filter((entry) => entry.kind === "component" && entry.authorableJsx)
      .map((entry) => `${family.id}.${entry.name}`))),
  }
}

function renderingTrees(rendering: RenderingFact): RenderingTree[] {
  return "nodes" in rendering ? [rendering] : rendering.alternatives.map((alternative) => alternative.rendering)
}

function collectEvidenceRefs(value: unknown, path = "$", output: Array<{ path: string; ref: string }> = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEvidenceRefs(item, `${path}[${index}]`, output))
    return output
  }
  if (!value || typeof value !== "object") return output
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidenceRefs") {
      if (Array.isArray(child)) for (const [index, ref] of child.entries()) if (typeof ref === "string") output.push({ path: `${path}.${key}[${index}]`, ref })
      continue
    }
    collectEvidenceRefs(child, `${path}.${key}`, output)
  }
  return output
}

function compositionErrors(input: ComponentFamilyContract[]) {
  const providers = new Set<string>()
  const exports = new Set<string>()
  const errors: string[] = []

  for (const family of input) for (const entry of family.exports) {
    exports.add(entry.name)
    exports.add(`${family.id}.${entry.name}`)
    for (const provided of entry.component?.composition.provides ?? []) {
      if (!provided) errors.push(`${family.id}.${entry.name} provides an empty capability.`)
      providers.add(provided)
    }
  }

  for (const family of input) for (const entry of family.exports) {
    for (const required of entry.component?.composition.requires ?? []) if (!providers.has(required)) errors.push(`${family.id}.${entry.name} requires an unavailable capability: ${required}.`)
    for (const constraint of entry.component?.composition.hardConstraints ?? []) {
      if (!constraint) errors.push(`${family.id}.${entry.name} has an empty hard constraint.`)
      else if (!providers.has(constraint) && !exports.has(constraint)) errors.push(`${family.id}.${entry.name} has an unknown hard-constraint fact: ${constraint}.`)
    }
  }

  return errors
}

function stateShapeErrors(componentName: string, state: ComponentDefinition["stateChannels"][number], props: Map<string, { availability: string }>, events: Set<string>) {
  const errors: string[] = []
  for (const propName of [state.controlledProp, state.defaultProp].filter((name): name is string => Boolean(name))) {
    if (!props.has(propName) || props.get(propName)?.availability !== "available") errors.push(`${componentName}.${state.name} references unavailable prop ${propName}.`)
  }
  if (state.changeEventProp && !events.has(state.changeEventProp)) errors.push(`${componentName}.${state.name} references unavailable event ${state.changeEventProp}.`)
  return errors
}

function baseStateShape(component: ComponentDefinition) {
  const props = new Map<string, { availability: string }>()
  const events = new Set<string>()
  for (const prop of component.localProps) props.set(prop.name, { availability: "available" })
  for (const interfaceId of component.inherits) for (const prop of interfacesById.get(interfaceId)?.props ?? []) if (!props.has(prop.name)) props.set(prop.name, { availability: "available" })
  for (const event of component.events) events.add(event.propName)
  for (const interfaceId of component.inherits) for (const event of interfacesById.get(interfaceId)?.events ?? []) events.add(event.propName)
  return { props, events }
}

function sourceEvidencePath(source: string) {
  const hash = source.match(/^(.*)@([0-9a-f]{40}|[0-9a-f]{64})$/)
  if (hash) return hash[1]
  return source.replace(/@[0-9]+\.[0-9]+\.[0-9]+$/, "")
}

describe("Phase 3 Task 7 cross-family runtime and evidence closure", { timeout: 60000 }, () => {
  test("registers exactly the independently approved seed families and no extra family artifact", () => {
    const actualFamilyFiles = readdirSync(join(root, "contracts/components/families"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => `contracts/components/families/${file}`)
      .sort()
    const registeredFamilyIds = families.map((family) => family.id).sort()
    const seedFamilyIds = Object.keys(seed.components).sort()

    expect(contractSet.familyCount).toBe(expectedFamilyIds.length)
    expect(contractSet.familyFiles).toHaveLength(expectedFamilyIds.length)
    expect(new Set(contractSet.familyFiles).size).toBe(expectedFamilyIds.length)
    expect(actualFamilyFiles).toEqual(contractSet.familyFiles.slice().sort())
    expect(registeredFamilyIds).toEqual(expectedFamilyIds.slice().sort())
    expect(registeredFamilyIds).toEqual(seedFamilyIds)
    expect(families).toHaveLength(expectedFamilyIds.length)
  })

  test("reconciles every public export classification with canonical source", () => {
    for (const family of families) {
      const source = sourcePath(family.id)
      const sourceExports = sourceAnalysis.listModuleExports(source)
      const expected = sourceExports.map((sourceExport) => {
        const render = sourceAnalysis.analyzeJsxRenderTree(source, sourceExport.name)
        const component = render.unresolved.length === 0
        const kind = component ? "component" : sourceExport.declarationKind === "FunctionDeclaration" && sourceExport.name.startsWith("use") ? "hook" : "helper"
        return [sourceExport.name, kind, component]
      })

      expect(family.exports.map(({ name, kind, authorableJsx }) => [name, kind, authorableJsx]).sort()).toEqual(expected.sort())
      expect(family.source.canonicalPath).toBe(seed.components[family.id].canonicalPath)
      expect(family.source.canonicalBlobSha).toBe(sourceAnalysis.readCanonicalSourceBlobSha(source))
      expect(family.source.canonicalBlobSha).toBe(seed.components[family.id].canonicalBlobSha)
    }
  })

  test("closes the shared inherited-interface registry with pins, hashes, and checker output", () => {
    const referencedInterfaceIds = new Set<string>()
    for (const family of families) for (const entry of family.exports) {
      for (const interfaceId of entry.component?.inherits ?? []) referencedInterfaceIds.add(interfaceId)
      for (const rendering of entry.component ? renderingTrees(entry.component.rendering) : []) for (const node of rendering.nodes) {
        if (node.host.kind === "inherited-interface" && node.host.interfaceId) referencedInterfaceIds.add(node.host.interfaceId)
      }
    }

    const actualInterfaceFiles = readdirSync(join(root, "contracts/components/interfaces"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => `contracts/components/interfaces/${file}`)
      .sort()
    expect(contractSet.interfaceFiles).toHaveLength(referencedInterfaceIds.size)
    expect(new Set(contractSet.interfaceFiles).size).toBe(contractSet.interfaceFiles.length)
    expect(actualInterfaceFiles).toEqual(contractSet.interfaceFiles.slice().sort())
    expect(new Set(interfaces.map((item) => item.id)).size).toBe(interfaces.length)
    expect([...referencedInterfaceIds].sort()).toEqual(interfaces.map((item) => item.id).sort())

    for (const contract of interfaces) {
      const declarationPath = join(root, contract.source.declarationPath)
      expect(existsSync(declarationPath)).toBe(true)
      expect(createHash("sha256").update(readFileSync(declarationPath)).digest("hex")).toBe(contract.source.declarationSha256)
      expect(JSON.parse(readFileSync(join(root, "node_modules", contract.source.package, "package.json"), "utf8")).version).toBe(contract.source.version)
      expect(validateInheritedInterfaceInvariants(contract)).toEqual([])

      const analyzed = analyzePackageComponentInterface(contract.source, canonicalInterfaceMemberAuthority[contract.id])
      expect({ props: contract.props, events: contract.events ?? [], conditionalApi: contract.conditionalApi ?? [] }, contract.id).toEqual(analyzed)
    }
  }, 60000)

  test("reconciles every render tree, conditional branch, portal boundary, props target, and derived attribute", () => {
    for (const family of families) {
      for (const entry of family.exports) {
        if (entry.kind !== "component") continue
        expect(entry.authorableJsx).toBe(true)
        expect(entry.component).toBeDefined()
        const rendering = entry.component!.rendering
        const sourceRender = sourceAnalysis.analyzeJsxRenderTree(sourcePath(family.id), entry.name)
        expect(sourceRender.unresolved, `${family.id}.${entry.name} render analysis`).toEqual([])
        expect(sourceAnalysis.compareJsxRenderTree(rendering, sourceRender), `${family.id}.${entry.name} render comparison`).toEqual([])

        for (const tree of renderingTrees(rendering)) {
          expect(tree.nodes.find((node) => node.id === tree.publicPropsTargetNodeId)?.receivesPublicProps).toBe(true)
          expect(tree.nodes.filter((node) => node.receivesPublicProps)).toHaveLength(1)
          for (const node of tree.nodes) {
            const renderHost = node.host
            if (renderHost.kind !== "component-export" && renderHost.kind !== "cross-family-export") continue
            const hostFamily = renderHost.kind === "cross-family-export" ? familyById.get(renderHost.familyId) : family
            const host = hostFamily?.exports.find((candidate) => candidate.name === renderHost.exportName)
            expect(host, `${family.id}.${entry.name} host ${renderHost.exportName}`).toMatchObject({ kind: "component", authorableJsx: true })
          }
        }
      }
      expect(validateComponentFamilyInvariants(family, authority())).toEqual([])
    }
  })

  test("resolves every base and conditional state channel against public props and events", () => {
    for (const family of families) for (const entry of family.exports) {
      if (!entry.component) continue
      const component = entry.component
      const base = baseStateShape(component)
      for (const state of component.stateChannels) expect(stateShapeErrors(`${family.id}.${entry.name}`, state, base.props, base.events)).toEqual([])

      const cases = new Map<string, ComponentDefinition["conditionalApi"][number]>()
      for (const conditional of component.conditionalApi) cases.set(JSON.stringify(conditional.when), conditional)
      for (const interfaceId of component.inherits) for (const conditional of interfacesById.get(interfaceId)?.conditionalApi ?? []) cases.set(JSON.stringify(conditional.when), conditional as ComponentDefinition["conditionalApi"][number])

      for (const conditional of cases.values()) {
        const shape = resolveConditionalApiShape(component, conditional.when, authority())
        const props = new Map(shape.props.map((prop) => [prop.name, prop]))
        const events = new Map(shape.events.map((event) => [event.propName, event]))
        for (const refinement of conditional.propRefinements) {
          const resolved = props.get(refinement.propName)
          expect(resolved, `${family.id}.${entry.name} ${JSON.stringify(conditional.when)} prop ${refinement.propName}`).toBeDefined()
          if (refinement.availability === "unavailable") expect(resolved).toEqual({ name: refinement.propName, availability: "unavailable" })
          else expect(resolved).toEqual({ name: refinement.propName, availability: "available", required: refinement.required, type: refinement.type })
        }
        for (const refinement of conditional.eventRefinements) expect(events.get(refinement.eventPropName)?.payload).toEqual(refinement.payload)
        for (const state of conditional.stateChannels) expect(stateShapeErrors(`${family.id}.${entry.name}`, state, new Map(shape.props.map((prop) => [prop.name, prop])), new Set(shape.events.map((event) => event.propName)))).toEqual([])
      }
    }
  })

  test("closes capabilities without imposing an example hierarchy", () => {
    expect(compositionErrors(families)).toEqual([])
    expect(families.flatMap((family) => family.exports.flatMap((entry) => entry.component?.composition.hardConstraints ?? []))).toEqual([])

    const missingRequirement = structuredClone(families)
    missingRequirement.find((family) => family.id === "dialog")!.exports.find((entry) => entry.name === "DialogContent")!.component!.composition.requires.push("missing.context")
    expect(compositionErrors(missingRequirement)).toContain("dialog.DialogContent requires an unavailable capability: missing.context.")

    const unknownConstraint = structuredClone(families)
    unknownConstraint.find((family) => family.id === "dialog")!.exports.find((entry) => entry.name === "DialogContent")!.component!.composition.hardConstraints.push("missing.relationship")
    expect(compositionErrors(unknownConstraint)).toContain("dialog.DialogContent has an unknown hard-constraint fact: missing.relationship.")
  })

  test("closes evidence references and excludes Phase 4 guidance from contracts", () => {
    const forbiddenKeys = /whenToUse|whenNotToUse|usageGuidance|designGuidance|patternIntent|recommendation|guidance|selectionAdvice/i
    const expectedModelLimits: Record<string, string[]> = {}
    for (const artifact of [...families, ...interfaces]) {
      for (const { path, ref } of collectEvidenceRefs(artifact)) expect(Object.hasOwn(artifact.evidence, ref), `${artifact.id} ${path}`).toBe(true)
      expect(artifact.unresolved.map((fact) => fact.topic), artifact.id).toEqual(expectedModelLimits[artifact.id] ?? [])
      expect(JSON.stringify(artifact)).not.toMatch(forbiddenKeys)

      for (const [key, evidence] of Object.entries(artifact.evidence)) {
        expect(evidence.source).toBeTypeOf("string")
        if (evidence.kind === "canonical-source") {
          const path = sourceEvidencePath(evidence.source)
          expect(existsSync(join(root, path))).toBe(true)
          if (artifact.id in familyById) expect(evidence.source).toBe(`src/components/ui/${artifact.id}.tsx@${familyById.get(artifact.id)!.source.canonicalBlobSha}`)
        }
        if (evidence.kind === "token-contract") expect(evidence.source).toBe(tokenContract.id)
        if (evidence.kind === "runtime-test") {
          const [testPath, testName] = evidence.source.split("#")
          expect(existsSync(join(root, testPath))).toBe(true)
          if (testName) expect(readFileSync(join(root, testPath), "utf8")).toContain(testName)
        }
        if (evidence.kind === "inherited-interface") {
          if (familyById.has(artifact.id)) {
            const referenced = families.find((family) => family.id === artifact.id)!.exports.flatMap((entry) => entry.component?.inherits ?? [])
            expect(referenced.some((id) => evidence.source.includes(id) || id.startsWith(evidence.source) || evidence.source.includes("react-intrinsic")), `${artifact.id}.${key}`).toBe(true)
          } else {
            expect(existsSync(join(root, sourceEvidencePath(evidence.source)))).toBe(true)
          }
        }
      }
    }
  })
})
