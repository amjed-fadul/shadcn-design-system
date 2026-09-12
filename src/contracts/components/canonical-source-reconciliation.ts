import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { canonicalInterfaceMemberAuthority } from "./canonical-interface-member-authority"
import { canonicalRenderSourceAnalysisConventions } from "./canonical-render-source-conventions"
import { analyzeCanonicalDelegatedHostFacts, canonicalDelegatedHostEvidencePaths, canonicalSourceOwnedSlotPropNames } from "./canonical-slot-source-analysis"
import { analyzePackageComponentInterface } from "./inherited-interface-source-analysis"
import type { ComponentContractSourceReconciliationContext } from "./loader"
import { compareJsxRenderTree, analyzeJsxRenderTree, extractCvaVariantLiterals, extractFunctionPropDefaults, listModuleExports, type JsxRenderCondition, type JsxRenderNode, type JsxRenderTree } from "./render-source-analysis"
import { reconcileSourceEvidenceCompleteness, reconcileSourceOwnedSlotCardinality } from "./source-reconciliation"
import { analyzeComponentTokenSourceForExport, compareComponentTokenDependenciesForExport } from "./canonical-token-source-analysis"
import type { ComponentFamilyContract, ConditionalApiCase, InheritedInterfaceContract } from "./types"

const analyzedInterfaceFacts = new Map<string, ReturnType<typeof analyzePackageComponentInterface>>()
const canonicalReconciliationCache = new Map<string, readonly string[]>()

const canonicalComponentConditionalAuthority: Readonly<Record<string, readonly ConditionalApiCase[]>> = {
  "accordion\u0000Accordion": [
    { when: { propName: "type", equals: "single" }, propRefinements: [], eventRefinements: [], stateChannels: [{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["declaration"] }], evidenceRefs: ["declaration"] },
    { when: { propName: "type", equals: "multiple" }, propRefinements: [], eventRefinements: [], stateChannels: [{ name: "value", controlledProp: "value", defaultProp: "defaultValue", changeEventProp: "onValueChange", evidenceRefs: ["declaration"] }], evidenceRefs: ["declaration"] },
  ],
  "dialog\u0000DialogContent": [
    { when: { propName: "showCloseButton", equals: true }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
    { when: { propName: "showCloseButton", equals: false }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
  ],
  "dialog\u0000DialogFooter": [
    { when: { propName: "showCloseButton", equals: true }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
    { when: { propName: "showCloseButton", equals: false }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
  ],
  "sheet\u0000SheetContent": [
    { when: { propName: "showCloseButton", equals: true }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
    { when: { propName: "showCloseButton", equals: false }, propRefinements: [], eventRefinements: [], stateChannels: [], evidenceRefs: ["source"] },
  ],
}

const noCapabilities = { requires: [], provides: [], hardConstraints: [] }

/**
 * Composition capability assignment is owned by the canonical component
 * boundary. Generic contracts merely model capability relationships; this
 * source-derived authority prevents a known capability from being reassigned
 * to an unrelated export.
 */
const canonicalComponentCompositionAuthority: Readonly<Record<string, { requires: string[]; provides: string[]; hardConstraints: string[] }>> = {
  "dialog\u0000Dialog": { requires: [], provides: ["dialog.context"], hardConstraints: [] },
  "dialog\u0000DialogClose": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogContent": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogDescription": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogOverlay": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogPortal": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogTitle": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dialog\u0000DialogTrigger": { requires: ["dialog.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenu": { requires: [], provides: ["dropdown-menu.context"], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuCheckboxItem": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuContent": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuGroup": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuItem": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuLabel": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuPortal": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuRadioGroup": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuRadioItem": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuSeparator": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuSub": { requires: ["dropdown-menu.context"], provides: ["dropdown-menu.subcontext"], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuSubContent": { requires: ["dropdown-menu.subcontext"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuSubTrigger": { requires: ["dropdown-menu.subcontext"], provides: [], hardConstraints: [] },
  "dropdown-menu\u0000DropdownMenuTrigger": { requires: ["dropdown-menu.context"], provides: [], hardConstraints: [] },
  "select\u0000Select": { requires: [], provides: ["select.context"], hardConstraints: [] },
  "select\u0000SelectContent": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectGroup": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectItem": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectLabel": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectScrollDownButton": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectScrollUpButton": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectSeparator": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectTrigger": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "select\u0000SelectValue": { requires: ["select.context"], provides: [], hardConstraints: [] },
  "sheet\u0000Sheet": { requires: [], provides: ["sheet.context"], hardConstraints: [] },
  "sheet\u0000SheetClose": { requires: ["sheet.context"], provides: [], hardConstraints: [] },
  "sheet\u0000SheetContent": { requires: ["sheet.context"], provides: [], hardConstraints: [] },
  "sheet\u0000SheetDescription": { requires: ["sheet.context"], provides: [], hardConstraints: [] },
  "sheet\u0000SheetTitle": { requires: ["sheet.context"], provides: [], hardConstraints: [] },
  "sheet\u0000SheetTrigger": { requires: ["sheet.context"], provides: [], hardConstraints: [] },
  "sidebar\u0000SidebarProvider": { requires: [], provides: ["sidebar.context"], hardConstraints: [] },
  "sidebar\u0000Sidebar": { requires: ["sidebar.context"], provides: [], hardConstraints: [] },
  "sidebar\u0000SidebarTrigger": { requires: ["sidebar.context"], provides: [], hardConstraints: [] },
  "sidebar\u0000SidebarRail": { requires: ["sidebar.context"], provides: [], hardConstraints: [] },
  "sidebar\u0000SidebarMenuButton": { requires: ["sidebar.context"], provides: [], hardConstraints: [] },
}

function sourceClassification(path: string) {
  return listModuleExports(path).map(({ name }) => {
    const kind = /^use[A-Z]/.test(name) ? "hook" : /^[A-Z]/.test(name) ? "component" : "helper"
    return { name, kind, authorableJsx: kind === "component", hasComponent: kind === "component" }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

function artifactClassification(family: ComponentFamilyContract) {
  return family.exports.map((entry) => ({ name: entry.name, kind: entry.kind, authorableJsx: entry.authorableJsx, hasComponent: Boolean(entry.component) })).sort((left, right) => left.name.localeCompare(right.name))
}

function localDefaults(path: string, exportName: string, localPropNames: readonly string[]) {
  const defaults = new Map(extractFunctionPropDefaults(path, exportName))
  for (const evidence of listModuleExports(path)) {
    if (evidence.declarationKind !== "VariableDeclaration") continue
    const variants = extractCvaVariantLiterals(path, evidence.name)
    for (const [name, value] of Object.entries(variants.defaults)) if (localPropNames.includes(name) && !defaults.has(name)) defaults.set(name, value)
  }
  return [...defaults].filter(([name]) => localPropNames.includes(name)).map(([name, value]) => ({ name, default: value })).sort((left, right) => left.name.localeCompare(right.name))
}

function localConditionalWhens(tree: JsxRenderTree) {
  const values = new Map<string, Set<string | number | boolean>>()
  const add = (condition: JsxRenderCondition | undefined) => {
    if (!condition || !("propName" in condition)) return
    const candidates = "equals" in condition ? typeof condition.equals === "boolean" ? [condition.equals, !condition.equals] : [condition.equals] : [true, false]
    const set = values.get(condition.propName) ?? new Set<string | number | boolean>()
    for (const candidate of candidates) set.add(candidate)
    values.set(condition.propName, set)
  }
  const visit = (node: JsxRenderNode) => { add(node.when); for (const child of node.children) visit(child) }
  if (tree.root) visit(tree.root)
  for (const alternative of tree.alternatives ?? []) { if ("when" in alternative) add(alternative.when); visit(alternative.root) }
  return [...values].flatMap(([propName, equals]) => [...equals].map((value) => ({ propName, equals: value })))
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Cache only evidence whose key includes both loaded contract data and every
 * canonical file read during reconciliation. A changed artifact, component
 * source, or declaration therefore always takes the fail-closed path again.
 */
function reconciliationCacheKey(repositoryRoot: string, context: ComponentContractSourceReconciliationContext) {
  const evidencePaths = new Set([
    ...context.families.map((family) => family.source.canonicalPath),
    ...context.interfaces.map((contract) => contract.source.declarationPath),
  ])
  const hash = createHash("sha256")
  hash.update(JSON.stringify(context))
  for (const path of [...evidencePaths, ...canonicalDelegatedHostEvidencePaths()].sort()) {
    hash.update(path)
    try { hash.update(readFileSync(path.startsWith("/") ? path : join(repositoryRoot, path))) }
    catch (error) { hash.update(`unreadable:${String(error)}`) }
  }
  return hash.digest("hex")
}

function canonicalInterfaceMembers(contract: InheritedInterfaceContract) {
  if (contract.source.kind === "react-intrinsic" || contract.source.symbol.endsWith("Props")) return undefined
  return canonicalInterfaceMemberAuthority[contract.id]
}

function analyzeCanonicalInterfaceFacts(contract: InheritedInterfaceContract, members: { props: readonly string[]; events: readonly string[] } | undefined) {
  const key = JSON.stringify({ source: contract.source, members })
  const cached = analyzedInterfaceFacts.get(key)
  if (cached) return cached
  const facts = analyzePackageComponentInterface(contract.source, members)
  analyzedInterfaceFacts.set(key, facts)
  return facts
}

function interfaceFactsMatch(contract: InheritedInterfaceContract, sourceFacts: ReturnType<typeof analyzePackageComponentInterface>) {
  if (contract.source.kind !== "react-intrinsic" && !contract.source.symbol.endsWith("Props")) {
    return sameValue({ props: contract.props, events: contract.events ?? [], conditionalApi: contract.conditionalApi ?? [] }, sourceFacts)
  }
  return sameValue(
    {
      props: contract.props.map(({ name, required }) => ({ name, required })),
      events: (contract.events ?? []).map(({ propName, required }) => ({ propName, required })),
      conditionalApi: contract.conditionalApi ?? [],
    },
    {
      props: sourceFacts.props.map(({ name, required }) => ({ name, required })),
      events: sourceFacts.events.map(({ propName, required }) => ({ propName, required })),
      conditionalApi: sourceFacts.conditionalApi,
    },
  )
}

/**
 * Canonical source ownership is deliberately isolated from generic component
 * schemas, invariants, loaders, and queries. Each public export is reconciled
 * against the source that owns it before canonical artifacts are exposed.
 */
export function reconcileCanonicalComponentSources(repositoryRoot: string, context: ComponentContractSourceReconciliationContext): string[] {
  const cacheKey = reconciliationCacheKey(repositoryRoot, context)
  const cached = canonicalReconciliationCache.get(cacheKey)
  if (cached) return [...cached]
  const errors: string[] = []
  const sourceConditionalWhens = new Map<string, Array<{ propName: string; equals: string | number | boolean }>>()
  for (const family of context.families) {
    const path = join(repositoryRoot, family.source.canonicalPath)
    let source: string
    try { source = readFileSync(path, "utf8") } catch (error) { errors.push(`Family ${family.id} canonical source cannot be read: ${String(error)}`); continue }
    if (execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim() !== family.source.canonicalBlobSha) errors.push(`Family ${family.id} canonical source hash does not match source evidence.`)
    const artifactExports = artifactClassification(family)
    const sourceExports = sourceClassification(path)
    if (!sameValue(artifactExports.map((entry) => entry.name), sourceExports.map((entry) => entry.name))) errors.push(`Family ${family.id} public exports do not match source evidence.`)
    if (!sameValue(artifactExports, sourceExports)) errors.push(`Family ${family.id} export classification does not match source evidence.`)

    const unresolved = [] as Array<{ topic: string; scope: string; unresolved: Array<{ sourcePath: string; start: number; end: number; expressionKind: string; sourceText: string; reason: string }> }>
    for (const entry of family.exports) {
      if (!entry.component) continue
      const tokenAnalysis = analyzeComponentTokenSourceForExport(path, entry.name)
      const tokenErrors = compareComponentTokenDependenciesForExport(path, entry.name, entry.component.tokenDependencies, false, tokenAnalysis)
      if (tokenErrors.length > 0) {
        errors.push(`Family ${family.id} token dependencies do not match source evidence.`)
        errors.push(`Component ${entry.name} token dependencies do not match source evidence.`)
      }

      const sourceRendering = analyzeJsxRenderTree(path, entry.name, canonicalRenderSourceAnalysisConventions)
      unresolved.push({
        topic: "jsx-rendering",
        scope: entry.name,
        unresolved: sourceRendering.unresolvedFindings.map((finding) => ({ ...finding, sourcePath: family.source.canonicalPath })),
      })
      unresolved.push({
        topic: "token-class-resolution",
        scope: entry.name,
        unresolved: tokenAnalysis.unresolved.map((finding) => ({ ...finding, sourcePath: family.source.canonicalPath })),
      })
      sourceConditionalWhens.set(`${family.id}\u0000${entry.name}`, localConditionalWhens(sourceRendering))
      const delegatedHostAnalysis = analyzeCanonicalDelegatedHostFacts(path, entry.name)
      errors.push(...delegatedHostAnalysis.errors)
      errors.push(...reconcileSourceOwnedSlotCardinality(family, entry.name, delegatedHostAnalysis.facts, canonicalSourceOwnedSlotPropNames(path, entry.name)))
      const renderErrors = compareJsxRenderTree(entry.component.rendering, sourceRendering, canonicalRenderSourceAnalysisConventions)
      if (renderErrors.length > 0) {
        if (renderErrors.some((error) => error.startsWith("Data attributes mismatch"))) errors.push(`Family ${family.id} render data-slot facts do not match source evidence.`)
        errors.push(`Component ${entry.name} rendering does not match source evidence.`)
      }
      const contractedDefaults = entry.component.localProps.filter((prop) => Object.hasOwn(prop, "default")).map((prop) => ({ name: prop.name, default: prop.default })).sort((left, right) => left.name.localeCompare(right.name))
      if (!sameValue(contractedDefaults, localDefaults(path, entry.name, entry.component.localProps.map((prop) => prop.name)))) errors.push(`Component ${entry.name} local prop defaults do not match source evidence.`)
    }
    errors.push(...reconcileSourceEvidenceCompleteness(family, unresolved))
  }

  for (const contract of context.interfaces) {
    try {
      const declaration = readFileSync(join(repositoryRoot, contract.source.declarationPath), "utf8")
      if (createHash("sha256").update(declaration).digest("hex") !== contract.source.declarationSha256) errors.push(`Inherited interface ${contract.id} declaration hash does not match source evidence.`)
      const members = canonicalInterfaceMembers(contract)
      if (contract.source.kind !== "react-intrinsic" && !contract.source.symbol.endsWith("Props") && !members) { errors.push(`Inherited interface ${contract.id} has no canonical source-member authority.`); continue }
      const sourceFacts = analyzeCanonicalInterfaceFacts(contract, members)
      sourceConditionalWhens.set(contract.id, sourceFacts.conditionalApi.map((conditional) => conditional.when))
      if (!interfaceFactsMatch(contract, sourceFacts)) errors.push(`Inherited interface ${contract.id} does not match source evidence.`)
    } catch (error) {
      errors.push(`Inherited interface ${contract.id} declaration cannot be reconciled: ${String(error)}`)
    }
  }

  for (const family of context.families) for (const entry of family.exports) {
    const component = entry.component
    if (!component) continue
    const expectedComposition = canonicalComponentCompositionAuthority[`${family.id}\u0000${entry.name}`] ?? noCapabilities
    if (!sameValue(component.composition, expectedComposition)) errors.push(`Component ${entry.name} composition does not match source evidence.`)
    const expectedConditionalApi = canonicalComponentConditionalAuthority[`${family.id}\u0000${entry.name}`] ?? []
    if (!sameValue(component.conditionalApi, expectedConditionalApi)) {
      errors.push(`Component ${entry.name} conditional API does not match source evidence.`)
    }
    const supported = [
      ...(sourceConditionalWhens.get(`${family.id}\u0000${entry.name}`) ?? []),
      ...component.inherits.flatMap((interfaceId) => sourceConditionalWhens.get(interfaceId) ?? []),
    ]
    for (const conditional of expectedConditionalApi) {
      if (!supported.some((candidate) => candidate.propName === conditional.when.propName && candidate.equals === conditional.when.equals)) {
        errors.push(`Component ${entry.name} conditional API lacks source evidence for ${conditional.when.propName}.`)
      }
    }
  }
  canonicalReconciliationCache.set(cacheKey, Object.freeze([...errors]))
  return errors
}
