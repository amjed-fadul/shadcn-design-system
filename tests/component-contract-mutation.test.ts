import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { tmpdir } from "node:os"

import Ajv2020 from "ajv/dist/2020.js"
import { describe, expect, test, vi } from "vitest"

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>()
  const gitHashCache = new Map<string, string>()
  const execFileSync: typeof actual.execFileSync = ((file: unknown, args?: unknown, options?: unknown) => {
    if (file === "git" && Array.isArray(args) && args[0] === "hash-object" && typeof args[1] === "string") {
      const path = args[1]
      const cached = gitHashCache.get(path)
      if (cached) return cached
      const value = actual.execFileSync(file, args as never, options as never)
      const text = String(value)
      gitHashCache.set(path, text)
      return text
    }
    return actual.execFileSync(file as never, args as never, options as never)
  }) as typeof actual.execFileSync
  return { ...actual, execFileSync }
})

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import seedComponents from "../provenance/seed-components.json"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import { ComponentContractLoadError, type ComponentContractArtifactSource, type ComponentContractIndex } from "../src/contracts/components/loader"
import { loadComponentContracts } from "../src/contracts/components/canonical-loader"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import { analyzeCanonicalDelegatedHostFacts, canonicalSourceOwnedSlotPropNames } from "../src/contracts/components/canonical-slot-source-analysis"
import { analyzePackageComponentInterface } from "../src/contracts/components/inherited-interface-source-analysis"
import { analyzeJsxRenderTree, compareJsxRenderTree, extractCvaVariantLiterals, extractFunctionPropDefaults, listModuleExports, readCanonicalSourceBlobSha } from "../src/contracts/components/render-source-analysis"
import { reconcileSourceAnalyzerErrors, reconcileSourceEvidenceCompleteness, reconcileSourceFacts, reconcileSourceOwnedSlotCardinality } from "../src/contracts/components/source-reconciliation"
import { analyzeComponentTokenDependencies } from "../src/contracts/components/canonical-token-source-analysis"
import { getComponentFamily, getInheritedInterface, listComponentFamilies, lookupComponentExport, queryComponentCapabilities, queryComponentTokenDependencies } from "../src/contracts/components"
import type { ComponentContractSet, ComponentFamilyContract, ComponentInvariantAuthority, InheritedInterfaceContract } from "../src/contracts/components/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const manifestPath = "contracts/components/component-contract-set.json"
const indexPath = "contracts/components/index.json"
const manifest = JSON.parse(readFileSync(join(root, manifestPath), "utf8")) as ComponentContractSet
const loaded = loadComponentContracts()

function authority(): ComponentInvariantAuthority {
  return {
    interfaceIds: new Set(loaded.interfaces.map((contract) => contract.id)),
    interfacePropNames: new Map(loaded.interfaces.map((contract) => [contract.id, new Set([...contract.props.map((prop) => prop.name), ...(contract.events ?? []).map((event) => event.propName)])])),
    interfaceContracts: new Map(loaded.interfaces.map((contract) => [contract.id, contract as InheritedInterfaceContract])),
    tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
    derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
    capabilityIds: new Set(loaded.families.flatMap((family) => family.exports.flatMap((entry) => entry.component?.composition.provides ?? []))),
  }
}

function clonedFamily(id: string): ComponentFamilyContract {
  return structuredClone(loaded.families.find((family) => family.id === id)!) as ComponentFamilyContract
}

function component(family: ComponentFamilyContract, name: string) {
  const definition = family.exports.find((entry) => entry.name === name)?.component
  if (!definition) throw new Error(`Missing fixture component: ${family.id}.${name}`)
  return definition
}

function firstRenderingTree(family: ComponentFamilyContract, name: string) {
  const rendering = component(family, name).rendering as any
  return "alternatives" in rendering ? rendering.alternatives[0].rendering : rendering
}

function expectInvariantRejection(family: ComponentFamilyContract, text: string) {
  expect(validateComponentFamilyInvariants(family, authority())).toContain(text)
}

function diskSource(): ComponentContractArtifactSource {
  return { readJson: (path) => JSON.parse(readFileSync(join(root, path), "utf8")) }
}

const canonicalArtifactPaths = [manifestPath, indexPath, ...manifest.familyFiles, ...manifest.interfaceFiles]
const canonicalArtifactCache = new Map(canonicalArtifactPaths.map((path) => [path, diskSource().readJson(path)]))

function memorySource(mutate?: (artifacts: Map<string, unknown>) => void): ComponentContractArtifactSource {
  const artifacts = new Map([...canonicalArtifactCache].map(([path, artifact]) => [path, structuredClone(artifact)]))
  mutate?.(artifacts)
  return { readJson(path) { if (!artifacts.has(path)) throw new Error(`missing fixture: ${path}`); return artifacts.get(path) } }
}

function slotSourceFixture(name: string, source: string) {
  const directory = mkdtempSync(join(tmpdir(), "canonical-slot-source-"))
  const path = join(directory, name)
  writeFileSync(path, source)
  return { path, cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}

describe("component contract adversarial mutations", { timeout: 60000 }, () => {
  test.each([
    ["component made non-authorable", (family: ComponentFamilyContract) => { family.exports.find((entry) => entry.name === "Button")!.authorableJsx = false }, "Component export Button must be JSX-authorable."],
    ["hook made JSX-authorable", (family: ComponentFamilyContract) => { family.exports.find((entry) => entry.name === "useSidebar")!.authorableJsx = true }, "Hook export useSidebar must not be JSX-authorable."],
    ["helper made JSX-authorable", (family: ComponentFamilyContract) => { family.exports.find((entry) => entry.name === "buttonVariants")!.authorableJsx = true }, "Helper export buttonVariants must not be JSX-authorable."],
    ["missing export evidence", (family: ComponentFamilyContract) => { family.exports.find((entry) => entry.name === "Button")!.evidenceRefs = ["missing"] }, "Export Button references missing evidence: missing."],
    ["missing inherited interface", (family: ComponentFamilyContract) => { component(family, "Button").inherits = ["fabric.unknown"] }, "Component Button inherits unknown interface: fabric.unknown."],
    ["invented token dependency", (family: ComponentFamilyContract) => { component(family, "Button").tokenDependencies.push({ tokenId: "color.canvas", evidenceRefs: ["source"] }) }, "Component Button references unknown token: color.canvas."],
    ["primitive token dependency", (family: ComponentFamilyContract) => { component(family, "Button").tokenDependencies.push({ tokenId: "color", evidenceRefs: ["source"] }) }, "Component Button references unknown token: color."],
    ["unexpanded spacing token dependency", (family: ComponentFamilyContract) => { component(family, "Button").tokenDependencies.push({ tokenId: "spacing.17", evidenceRefs: ["source"] }) }, "Component Button references unknown token: spacing.17."],
    ["duplicate local prop", (family: ComponentFamilyContract) => { const item = component(family, "Button").localProps[0]; component(family, "Button").localProps.push(structuredClone(item)) }, "Component Button has duplicate local prop: variant."],
    ["local inherited collision", (family: ComponentFamilyContract) => { component(family, "Button").localProps.push({ name: "onClick", required: false, type: { kind: "typescript", typeText: "() => void" }, evidenceRefs: ["source"] }) }, "Component Button local prop collides with inherited prop: onClick."],
    ["state channel unknown value", (family: ComponentFamilyContract) => { component(family, "Checkbox").stateChannels[0].controlledProp = "missingChecked" }, "State channel Checkbox.checked references unknown controlled prop: missingChecked."],
    ["state channel unknown callback", (family: ComponentFamilyContract) => { component(family, "Checkbox").stateChannels[0].changeEventProp = "onMissing" }, "State channel Checkbox.checked references unknown change event: onMissing."],
    ["state channel incompatible callback payload", (family: ComponentFamilyContract) => { component(family, "Select").stateChannels.find((channel) => channel.name === "value")!.changeEventProp = "onOpenChange" }, "State channel Select.value has incompatible change event payload."],
    ["duplicate token dependency", (family: ComponentFamilyContract) => { const dependency = component(family, "Button").tokenDependencies[0]; component(family, "Button").tokenDependencies.push(structuredClone(dependency)) }, "Component Button has duplicate token dependency: radius.md."],
    ["conditional unknown discriminator", (family: ComponentFamilyContract) => { component(family, "Accordion").conditionalApi[0].when.propName = "mode" }, "Conditional API Accordion references unknown discriminant prop: mode."],
    ["event unknown public prop", (family: ComponentFamilyContract) => { component(family, "Button").events.push({ propName: "onGhost", evidenceRefs: ["source"] }) }, "Component Button event references unknown prop: onGhost."],
    ["illegal helper render host", (family: ComponentFamilyContract) => { component(family, "Button").rendering = { rootNodeId: "host", publicPropsTargetNodeId: "host", portalBoundaries: [], nodes: [{ id: "host", host: { kind: "component-export", exportName: "buttonVariants" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }] } }, "Component Button render host references non-JSX-authorable export: buttonVariants."],
    ["invented render export", (family: ComponentFamilyContract) => { component(family, "Button").rendering = { rootNodeId: "host", publicPropsTargetNodeId: "host", portalBoundaries: [], nodes: [{ id: "host", host: { kind: "component-export", exportName: "GhostButton" }, receivesPublicProps: true, dataAttributes: [], children: [], evidenceRefs: ["source"] }] } }, "Component Button render host references unknown export: GhostButton."],
    ["missing render root", (family: ComponentFamilyContract) => { firstRenderingTree(family, "Button").rootNodeId = "ghost-root" }, "Component Button alternative 0 rendering root node is missing: ghost-root."],
    ["wrong props target", (family: ComponentFamilyContract) => { firstRenderingTree(family, "Button").publicPropsTargetNodeId = "ghost-target" }, "Component Button alternative 0 rendering public-props target node is missing: ghost-target."],
    ["invalid derived attribute prop", (family: ComponentFamilyContract) => { firstRenderingTree(family, "Button").nodes[0].dataAttributes.push({ name: "data-ghost", source: "prop", prop: "ghost", evidenceRefs: ["source"] }) }, "Component Button alternative 0 render attribute host.data-ghost references unknown prop: ghost."],
    ["unknown portal boundary", (family: ComponentFamilyContract) => { firstRenderingTree(family, "Button").portalBoundaries.push({ nodeId: "ghost", evidenceRefs: ["source"] }) }, "Component Button alternative 0 portal boundary references unknown render node: ghost."],
  ])("rejects %s", (_name, mutate, expected) => {
    const family = clonedFamily(_name.includes("hook") ? "sidebar" : _name.includes("incompatible callback") ? "select" : _name.includes("state") ? "checkbox" : _name.includes("conditional") ? "accordion" : "button")
    mutate(family)
    expectInvariantRejection(family, expected)
  })

  test("requires a resolved authoritative inherited-interface contract, not only an identifier", () => {
    const family = clonedFamily("button")
    const incompleteAuthority = { ...authority(), interfaceContracts: new Map() }

    expect(validateComponentFamilyInvariants(family, incompleteAuthority)).toContain("Component Button inherits interface without a resolved authoritative contract: html.button.")
  })

  test("rejects interface declaration member drift through the actual declaration analyzer", () => {
    const contract = structuredClone(loaded.interfaces.find((item) => item.id === "radix.accordion.root")!) as InheritedInterfaceContract
    const declaration = join(root, contract.source.declarationPath)
    const before = createHash("sha256").update(readFileSync(declaration)).digest("hex")
    contract.props[0].name = "forgedMember"

    expect(before).toBe(contract.source.declarationSha256)
    const derived = analyzePackageComponentInterface(contract.source, { props: ["type", "value", "defaultValue", "collapsible"], events: ["onValueChange"] })
    expect(reconcileSourceFacts("Inherited interface radix.accordion.root", { props: contract.props, events: contract.events ?? [], conditionalApi: contract.conditionalApi ?? [] }, derived))
      .toContain("Inherited interface radix.accordion.root does not match source evidence.")
  })

  test("production source reconciliation rejects falsely-complete artifacts with unresolved source evidence", () => {
    const unresolved = analyzeJsxRenderTree(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"), "RenderCompletenessFixture")
    const family = clonedFamily("button")

    expect(reconcileSourceEvidenceCompleteness(family, [{ topic: "jsx-rendering", scope: "RenderCompletenessFixture", unresolved: unresolved.unresolvedFindings }]))
      .toContain("Family button omits unresolved source evidence for RenderCompletenessFixture.")
  })

  test("source comparisons reject removed and invented token dependencies", () => {
    const source = join(root, "src/components/ui/checkbox.tsx")
    const dependencies = structuredClone(component(clonedFamily("checkbox"), "Checkbox").tokenDependencies)
    dependencies.pop()

    const sourceDependencies = analyzeComponentTokenDependencies(source).map(({ tokenId, when, viaDerivedRule }) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) }))
    const normalize = (items: Array<{ tokenId: string; when?: unknown; viaDerivedRule?: unknown }>) => items.map(({ tokenId, when, viaDerivedRule }) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) }))
    expect(reconcileSourceFacts("Checkbox token dependencies", normalize(dependencies), sourceDependencies)).toContain("Checkbox token dependencies does not match source evidence.")
    expect(reconcileSourceFacts("Checkbox token dependencies", normalize([...dependencies, { tokenId: "color.canvas", evidenceRefs: ["source"] }]), sourceDependencies)).toContain("Checkbox token dependencies does not match source evidence.")

  })

  test("source comparisons reject wrong render roots, branches, props targets, attributes, and portal boundaries", () => {
    const family = clonedFamily("dialog")
    const definition = component(family, "DialogContent")
    const source = analyzeJsxRenderTree(join(root, "src/components/ui/dialog.tsx"), "DialogContent")
    const rendering = definition.rendering as any
    rendering.rootNodeId = "content"
    rendering.publicPropsTargetNodeId = "portal"
    rendering.portalBoundaries = []
    rendering.nodes.find((node: { id: string }) => node.id === "content").dataAttributes.push({ name: "data-forged", source: "literal", value: "yes", evidenceRefs: ["source"] })

    expect(reconcileSourceAnalyzerErrors("DialogContent rendering", compareJsxRenderTree(rendering, source, canonicalRenderSourceAnalysisConventions))).toEqual([expect.stringContaining("DialogContent rendering source reconciliation failed:")])
  })

  test("source-specific extractors catch literal/default/export/source identity drift", () => {
    const button = clonedFamily("button")
    const buttonSource = join(root, "src/components/ui/button.tsx")
    component(button, "Button").localProps.find((prop) => prop.name === "variant")!.type = { kind: "enum", values: ["forged"] }
    expect(reconcileSourceFacts("Button variant literals", component(button, "Button").localProps.find((prop) => prop.name === "variant")!.type, { kind: "enum", values: extractCvaVariantLiterals(buttonSource, "buttonVariants").variants.variant })).toContain("Button variant literals does not match source evidence.")
    component(button, "Button").localProps.find((prop) => prop.name === "variant")!.default = "forged"
    expect(reconcileSourceFacts("Button variant default", component(button, "Button").localProps.find((prop) => prop.name === "variant")!.default, extractCvaVariantLiterals(buttonSource, "buttonVariants").defaults.variant)).toContain("Button variant default does not match source evidence.")

    const dialog = clonedFamily("dialog")
    component(dialog, "DialogContent").localProps.find((prop) => prop.name === "showCloseButton")!.default = false
    expect(reconcileSourceFacts("DialogContent showCloseButton default", component(dialog, "DialogContent").localProps.find((prop) => prop.name === "showCloseButton")!.default, extractFunctionPropDefaults(join(root, "src/components/ui/dialog.tsx"), "DialogContent").get("showCloseButton"))).toContain("DialogContent showCloseButton default does not match source evidence.")

    const select = clonedFamily("select")
    select.exports.pop()
    expect(reconcileSourceFacts("Select public exports", select.exports.map((entry) => entry.name).sort(), listModuleExports(join(root, "src/components/ui/select.tsx")).map((entry) => entry.name))).toContain("Select public exports does not match source evidence.")

    const sidebar = clonedFamily("sidebar")
    sidebar.source.canonicalBlobSha = "0".repeat(40)
    expect(reconcileSourceFacts("Sidebar canonical source hash", sidebar.source.canonicalBlobSha, readCanonicalSourceBlobSha(join(root, "src/components/ui/sidebar.tsx")))).toContain("Sidebar canonical source hash does not match source evidence.")
    sidebar.source.upstreamBlobSha = "0".repeat(40)
    expect(reconcileSourceFacts("Sidebar upstream source hash", sidebar.source.upstreamBlobSha, seedComponents.components.sidebar.upstreamBlobSha)).toContain("Sidebar upstream source hash does not match source evidence.")

    const checkbox = structuredClone(loaded.interfaces.find((item) => item.id === "radix.checkbox.root")!) as InheritedInterfaceContract
    checkbox.props.find((prop) => prop.name === "checked")!.name = "forgedChecked"
    expect(reconcileSourceFacts("Inherited interface radix.checkbox.root", { props: checkbox.props, events: checkbox.events ?? [], conditionalApi: checkbox.conditionalApi ?? [] }, analyzePackageComponentInterface(checkbox.source, { props: ["checked", "defaultChecked"], events: ["onCheckedChange"] }))).toContain("Inherited interface radix.checkbox.root does not match source evidence.")

    const accordion = clonedFamily("accordion")
    component(accordion, "Accordion").conditionalApi[0].stateChannels.push({ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onForgedValueChange", evidenceRefs: ["source", "declaration"] })
    expect(validateComponentFamilyInvariants(accordion, authority())).toContain("State channel Accordion.value references unknown change event: onForgedValueChange.")
  })

  test("loader rejects missing, invented, replaced, and misassigned derived index artifacts", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => artifacts.delete(manifest.familyFiles[0])))).toThrow(ComponentContractLoadError)
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const set = artifacts.get(manifestPath) as ComponentContractSet
      set.familyFiles[1] = set.familyFiles[0]
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const index = artifacts.get(indexPath) as { families: unknown[] }
      index.families.pop()
    }))).toThrow("COMPONENT_CONTRACT_INDEX_DRIFT")
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const index = artifacts.get(indexPath) as { families: Array<{ familyId: string; components: string[]; hooks: string[] }> }
      index.families.push({ familyId: "invented-family", components: [], hooks: [] })
    }))).toThrow("COMPONENT_CONTRACT_INDEX_DRIFT")
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const index = artifacts.get(indexPath) as { families: Array<{ familyId: string; components: string[]; hooks: string[] }> }
      const sidebar = index.families.find((family) => family.familyId === "sidebar")!
      sidebar.components.push("useSidebar")
      sidebar.hooks = sidebar.hooks.filter((name) => name !== "useSidebar")
    }))).toThrow("COMPONENT_CONTRACT_INDEX_DRIFT")
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const set = artifacts.get(manifestPath) as ComponentContractSet
      set.familyFiles[0] = "contracts/components/families/forged.json"
      artifacts.set("contracts/components/families/forged.json", artifacts.get(manifest.familyFiles[0]))
    }))).toThrow("COMPONENT_CONTRACT_ARTIFACT_INVALID")
  })

  test("canonical production loading rejects a forged family count larger than its manifest", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      ;(artifacts.get(manifestPath) as ComponentContractSet).familyCount += 1
    }))).toThrow("Contract set familyCount must equal familyFiles length.")
  })

  test.each([
    ["token dependency", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/checkbox.json") as ComponentFamilyContract
      family.exports[0].component!.tokenDependencies.pop()
    }, "Family checkbox token dependencies do not match source evidence."],
    ["public export with adjusted index", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/select.json") as ComponentFamilyContract
      family.exports.pop()
      const index = artifacts.get(indexPath) as ComponentContractIndex
      index.families.find((item) => item.familyId === "select")!.components.pop()
    }, "Family select public exports do not match source evidence."],
    ["render data-slot", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      const content = component(family, "DialogContent")
      const rendering = content.rendering as { nodes: Array<{ id: string; dataAttributes: Array<{ name: string; source: string; value?: string }> }> }
      rendering.nodes.find((node) => node.id === "content")!.dataAttributes.find((attribute) => attribute.name === "data-slot")!.value = "forged-dialog-content"
    }, "Family dialog render data-slot facts do not match source evidence."],
  ])("canonical production loading rejects source %s drift even when the derived index is adjusted", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test.each([
    ["moved dependency", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      const content = component(family, "DialogContent")
      const footer = component(family, "DialogFooter")
      const dependency = content.tokenDependencies.find((item) => item.tokenId === "shadow.md")!
      content.tokenDependencies = content.tokenDependencies.filter((item) => item !== dependency)
      footer.tokenDependencies.push(dependency)
    }],
    ["invented dependency", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      component(family, "DialogContent").tokenDependencies.push({ tokenId: "color.primary", evidenceRefs: ["source"] })
    }],
  ])("canonical production loading binds %s token dependency to its exact public export", (_name, mutate) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow("Component DialogContent token dependencies do not match source evidence.")
  })

  test.each([
    ["inherited declaration", (artifacts: Map<string, unknown>) => {
      const interfaceContract = artifacts.get(manifest.interfaceFiles.find((path) => path.includes("radix.accordion.root"))!) as InheritedInterfaceContract
      interfaceContract.props[0].typeText = "forgedMember"
    }, "Inherited interface radix.accordion.root does not match source evidence."],
    ["render evidence", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      const rendering = component(family, "DialogContent").rendering as any
      rendering.nodes.find((node: { id: string }) => node.id === rendering.rootNodeId).host = { kind: "component-export", exportName: "DialogOverlay" }
    }, "Component DialogContent rendering does not match source evidence."],
  ])("canonical production loading rejects %s drift from source", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test.each([
    ["conditional branch", (artifacts: Map<string, unknown>) => {
      const rendering = component(artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract, "DialogContent").rendering as any
      rendering.nodes.find((node: { id: string }) => node.id === "content").children[0].when.equals = false
    }, "Component DialogContent rendering does not match source evidence."],
    ["props target", (artifacts: Map<string, unknown>) => {
      const rendering = component(artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract, "DialogContent").rendering as any
      rendering.publicPropsTargetNodeId = "portal"
      rendering.nodes.find((node: { id: string }) => node.id === "portal").receivesPublicProps = true
      rendering.nodes.find((node: { id: string }) => node.id === "content").receivesPublicProps = false
    }, "Component DialogContent rendering does not match source evidence."],
    ["derived attribute", (artifacts: Map<string, unknown>) => {
      const rendering = firstRenderingTree(artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract, "Button")
      rendering.nodes[0].dataAttributes.find((attribute: { name: string }) => attribute.name === "data-variant").prop = "size"
    }, "Component Button rendering does not match source evidence."],
    ["portal boundary", (artifacts: Map<string, unknown>) => {
      const rendering = component(artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract, "DialogContent").rendering as any
      rendering.portalBoundaries = []
    }, "Component DialogContent rendering does not match source evidence."],
  ])("canonical production loading binds %s render fact to source", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test("canonical production loading rejects source-component reclassification even when the index agrees", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/progress.json") as ComponentFamilyContract
      const progress = family.exports.find((entry) => entry.name === "Progress")!
      progress.kind = "helper"
      progress.authorableJsx = false
      delete progress.component
      const index = artifacts.get(indexPath) as ComponentContractIndex
      const progressIndex = index.families.find((item) => item.familyId === "progress")!
      progressIndex.components = progressIndex.components.filter((name) => name !== "Progress")
      progressIndex.helpers.push("Progress")
      progressIndex.helpers.sort()
    }))).toThrow("Family progress export classification does not match source evidence.")
  })

  test.each([
    ["package", (artifacts: Map<string, unknown>) => {
      const contract = artifacts.get(manifest.interfaceFiles.find((path) => path.includes("radix.dialog.root"))!) as InheritedInterfaceContract
      contract.props = contract.props.filter((prop) => prop.name !== "modal")
    }, "Inherited interface radix.dialog.root does not match source evidence."],
    ["React intrinsic", (artifacts: Map<string, unknown>) => {
      const contract = artifacts.get(manifest.interfaceFiles.find((path) => path.includes("html.button"))!) as InheritedInterfaceContract
      contract.props = contract.props.filter((prop) => prop.name !== "disabled")
    }, "Inherited interface html.button does not match source evidence."],
  ])("canonical production loading rejects removed %s source interface members", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test.each([
    ["local defaults", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract
      component(family, "Button").localProps.find((prop) => prop.name === "variant")!.default = "ghost"
    }, "Component Button local prop defaults do not match source evidence."],
    ["conditional API facts", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/accordion.json") as ComponentFamilyContract
      component(family, "Accordion").conditionalApi[0].stateChannels.push({
        name: "selection",
        controlledProp: "value",
        defaultProp: "defaultValue",
        changeEventProp: "onValueChange",
        evidenceRefs: ["declaration"],
      })
    }, "Component Accordion conditional API does not match source evidence."],
  ])("canonical production loading rejects source-false %s", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test.each([
    ["inherited interface members", (artifacts: Map<string, unknown>) => {
      const root = artifacts.get(manifest.interfaceFiles.find((path) => path.includes("radix.accordion.root"))!) as InheritedInterfaceContract
      root.props = root.props.filter((prop) => prop.name !== "collapsible")
      root.conditionalApi = []
      const family = artifacts.get("contracts/components/families/accordion.json") as ComponentFamilyContract
      component(family, "Accordion").conditionalApi = []
    }, "Inherited interface radix.accordion.root does not match source evidence."],
    ["conditional refinements", (artifacts: Map<string, unknown>) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      component(family, "DialogContent").conditionalApi = []
    }, "Component DialogContent conditional API does not match source evidence."],
  ])("canonical production loading does not let component artifacts co-authorize %s", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource(mutate))).toThrow(expected)
  })

  test("canonical loading does not let artifacts self-authorize capabilities", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract
      component(family, "Button").composition.provides.push("forged.capability")
    }))).toThrow("Component Button provides unknown capability: forged.capability.")
  })

  test("canonical production loading rejects invalid state bindings, duplicate token facts, and misassigned known capabilities", () => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/select.json") as ComponentFamilyContract
      component(family, "Select").stateChannels.find((channel) => channel.name === "value")!.changeEventProp = "onOpenChange"
    }))).toThrow("State channel Select.value has incompatible change event payload.")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract
      const dependency = component(family, "Button").tokenDependencies[0]
      component(family, "Button").tokenDependencies.push(structuredClone(dependency))
    }))).toThrow("Component Button has duplicate token dependency: radius.md.")

    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract
      component(family, "Button").composition.requires.push("dialog.context")
    }))).toThrow("Component Button composition does not match source evidence.")
  })

  test("public queries reject unknown exact identifiers and never expose mutable state", () => {
    expect(() => getComponentFamily("fabric.button")).toThrow("COMPONENT_FAMILY_NOT_CONTRACTED")
    expect(() => lookupComponentExport("button", "GhostButton")).toThrow("COMPONENT_EXPORT_NOT_CONTRACTED")
    expect(() => getInheritedInterface("fabric.surface")).toThrow("INHERITED_INTERFACE_NOT_CONTRACTED")
    expect(() => queryComponentCapabilities("fabric.context")).toThrow("COMPONENT_CAPABILITY_NOT_CONTRACTED")
    expect(() => queryComponentTokenDependencies("color.canvas")).toThrow("COMPONENT_TOKEN_NOT_CONTRACTED")

    const families = listComponentFamilies()
    const capability = queryComponentCapabilities("dialog.context")
    const dependency = queryComponentTokenDependencies("radius.md")
    expect(Object.isFrozen(families)).toBe(true)
    expect(Object.isFrozen(capability)).toBe(true)
    expect(Object.isFrozen(capability[0])).toBe(true)
    expect(Object.isFrozen(dependency)).toBe(true)
    expect(Object.isFrozen(dependency[0].dependency)).toBe(true)
    expect(() => (families as unknown as Array<unknown>).pop()).toThrow(TypeError)
    expect(() => (capability as unknown as Array<unknown>).pop()).toThrow(TypeError)
  })

  test("schema rejects malformed classification and component-definition combinations", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(familySchema)
    const hook = clonedFamily("sidebar")
    const entry = hook.exports.find((candidate) => candidate.name === "useSidebar")!
    entry.component = component(hook, "Sidebar")

    expect(validate(hook)).toBe(true)
    expectInvariantRejection(hook, "Hook export useSidebar must not carry a component definition.")
    const inherited = structuredClone(loaded.interfaces[0]) as InheritedInterfaceContract
    ;(inherited as any).source.declarationSha256 = "not-a-hash"
    expect(new Ajv2020({ allErrors: true, strict: true }).compile(interfaceSchema)(inherited)).toBe(false)
  })

  test("requires capability references to resolve through production authority", () => {
    const family = clonedFamily("button")
    const definition = component(family, "Button")
    definition.composition.hardConstraints.push("fabric.missing-capability")

    const errors = validateComponentFamilyInvariants(family, authority())
    expect(errors).toContain("Component Button hard constraint references unknown capability: fabric.missing-capability.")
  })

  test("production source-owned slot reconciliation derives Radix Slot's ordinary-child cardinality", () => {
    for (const [familyId, exportName] of [["button", "Button"], ["badge", "Badge"]] as const) {
      const family = clonedFamily(familyId)
      const sourceAnalysis = analyzeCanonicalDelegatedHostFacts(join(root, `src/components/ui/${familyId}.tsx`), exportName)
      expect(sourceAnalysis).toEqual({ facts: [{ propName: "asChild", replacesHost: true, forwardsProps: true, childCardinality: { min: 0, max: 1 }, childRequires: ["multiple children require a Radix Slottable that resolves to one React element"] }], errors: [] })
      expect(reconcileSourceOwnedSlotCardinality(family, exportName, sourceAnalysis.facts)).toEqual([])
    }
  })

  test("resolves a package primitive's delegated-child runtime facts", () => {
    const family = clonedFamily("dialog")
    const analysis = analyzeCanonicalDelegatedHostFacts(join(root, "src/components/ui/dialog.tsx"), "DialogClose")

    expect(analysis).toEqual({
      facts: [{
        propName: "asChild",
        replacesHost: true,
        forwardsProps: true,
        childCardinality: { min: 0, max: 1 },
        childRequires: ["multiple children require a Radix Slottable that resolves to one React element"],
      }],
      errors: [],
    })
    expect(reconcileSourceOwnedSlotCardinality(family, "DialogClose", analysis.facts)).toEqual([])
  })

  test("rejects a configured package member that does not resolve to delegated primitive behavior", () => {
    const fixture = slotSourceFixture("dialog.tsx", `
      import { Dialog as DialogPrimitive } from "radix-ui"
      export function DialogClose({ ...props }: Record<string, unknown>) {
        return <DialogPrimitive.Impostor {...props} />
      }
    `)
    try {
      expect(analyzeCanonicalDelegatedHostFacts(fixture.path, "DialogClose")).toEqual({
        facts: [],
        errors: ["Unable to resolve delegated primitive behavior for DialogPrimitive.Impostor."],
      })
    } finally {
      fixture.cleanup()
    }
  })

  test("fails closed when configured local Slot source evidence disappears", () => {
    const fixture = slotSourceFixture("button.tsx", `
      export function Button({ asChild = false, ...props }: Record<string, unknown> & { asChild?: boolean }) {
        return <button data-as-child={asChild} {...props} />
      }
    `)
    try {
      const family = clonedFamily("button")
      const facts = analyzeCanonicalDelegatedHostFacts(fixture.path, "Button")
      expect(reconcileSourceOwnedSlotCardinality(family, "Button", facts.facts, canonicalSourceOwnedSlotPropNames(fixture.path, "Button"))).toContain("Component Button source-owned slot is not present in source: asChild.")
    } finally {
      fixture.cleanup()
    }
  })

  test("derives local Slot cardinality from the resolved runtime rather than inventing one", () => {
    const runtime = slotSourceFixture("slot-runtime.tsx", `
      export function Root({ children }: { children?: unknown }) { return <>{children}</> }
    `)
    try {
      const analysis = analyzeCanonicalDelegatedHostFacts(join(root, "src/components/ui/button.tsx"), "Button", { localSlotRuntimePath: runtime.path })
      expect(analysis.facts).toEqual([{
        propName: "asChild",
        replacesHost: true,
        forwardsProps: true,
        childCardinality: { min: 0, max: Number.MAX_SAFE_INTEGER },
      }])
      expect(reconcileSourceOwnedSlotCardinality(clonedFamily("button"), "Button", analysis.facts)).toContain(`Slot Button.asChild must retain source-owned child cardinality 0..${Number.MAX_SAFE_INTEGER}.`)
    } finally {
      runtime.cleanup()
    }
  })

  test("canonical production loading accepts Radix Slot's factual ordinary-child cardinality", () => {
    expect(() => loadComponentContracts(memorySource())).not.toThrow()
  })

  test("production source-owned slot reconciliation rejects a falsely widened Radix Slot cardinality outside generic invariants", () => {
    const family = clonedFamily("button")
    const definition = component(family, "Button")
    definition.slots[0].childCardinality = { min: 0, max: Number.MAX_SAFE_INTEGER }

    const sourceAnalysis = analyzeCanonicalDelegatedHostFacts(join(root, "src/components/ui/button.tsx"), "Button")
    expect(reconcileSourceOwnedSlotCardinality(family, "Button", sourceAnalysis.facts)).toContain("Slot Button.asChild must retain source-owned child cardinality 0..1.")
  })

  test.each([
    ["missing", (definition: ReturnType<typeof component>) => { definition.slots = [] }, "Component Button is missing source-owned slot: asChild."],
    ["widened", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 0, max: Number.MAX_SAFE_INTEGER } }, "Slot Button.asChild must retain source-owned child cardinality 0..1."],
    ["narrowed", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 1, max: 1 } }, "Slot Button.asChild must retain source-owned child cardinality 0..1."],
    ["invented exact count", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 2, max: 2 } }, "Slot Button.asChild must retain source-owned child cardinality 0..1."],
    ["missing Slottable exception", (definition: ReturnType<typeof component>) => { definition.slots[0].childRequires = [] }, "Slot Button.asChild must retain source-owned child requirements."],
  ])("canonical production loading rejects %s delegated slot cardinality facts", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/button.json") as ComponentFamilyContract
      mutate(component(family, "Button"))
    }))).toThrow(expected)
  })

  test.each([
    ["missing", (definition: ReturnType<typeof component>) => { definition.slots = [] }, "Component DialogClose is missing source-owned slot: asChild."],
    ["widened", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 0, max: Number.MAX_SAFE_INTEGER } }, "Slot DialogClose.asChild must retain source-owned child cardinality 0..1."],
    ["narrowed", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 1, max: 1 } }, "Slot DialogClose.asChild must retain source-owned child cardinality 0..1."],
    ["forged", (definition: ReturnType<typeof component>) => { definition.slots[0].childCardinality = { min: 17, max: 17 } }, "Slot DialogClose.asChild must retain source-owned child cardinality 0..1."],
  ])("canonical production loading rejects %s external primitive delegated-slot facts", (_name, mutate, expected) => {
    expect(() => loadComponentContracts(memorySource((artifacts) => {
      const family = artifacts.get("contracts/components/families/dialog.json") as ComponentFamilyContract
      mutate(component(family, "DialogClose"))
    }))).toThrow(expected)
  }, 60_000)
})
