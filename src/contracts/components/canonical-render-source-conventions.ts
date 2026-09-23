import ts from "typescript"

import type { RenderSourceAnalysisConventions } from "./render-source-analysis"
import seedComponents from "../../../provenance/seed-components.json"

function canonicalRenderName(name: string) {
  return name.replace(/primitive/gi, "").replace(/[^a-z0-9]/gi, "").replace(/^radix/i, "").toLowerCase()
}

function matchesCanonicalPrimitiveInterface(sourceTag: string, interfaceId: string): boolean | undefined {
  const source = /^([A-Za-z][A-Za-z0-9]*)Primitive(?:\.([A-Za-z][A-Za-z0-9]*))?$/.exec(sourceTag)
  const [provider, interfaceDomain, interfaceMember, ...extra] = interfaceId.split(".")
  if (!source || !provider || !interfaceDomain || !interfaceMember || extra.length > 0) return undefined

  const sourceDomain = canonicalRenderName(source[1])
  const sourceMember = canonicalRenderName(source[2] ?? "root")
  const expectedDomain = canonicalRenderName(interfaceDomain)
  const expectedMember = canonicalRenderName(interfaceMember)

  if (sourceDomain === "command") {
    return provider === "cmdk" && expectedDomain === "command" && sourceMember === expectedMember
  }
  if (sourceDomain === "drawer") {
    const providerMatches = (provider === "vaul" && expectedDomain === "drawer") || (provider === "radix" && expectedDomain === "dialog")
    return providerMatches && sourceMember === expectedMember
  }
  return undefined
}

function extensionless(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.[cm]?[jt]sx?$/, "")
}

const canonicalModuleSpecifiers = new Map(Object.entries(seedComponents.components).map(([familyId, source]) => {
  const canonicalPath = extensionless(source.canonicalPath)
  return [familyId, canonicalPath.startsWith("src/") ? `@/${canonicalPath.slice("src/".length)}` : canonicalPath]
}))

/** Canonical source aliases are supplied at the design-system boundary, not by the generic analyzer. */
export const canonicalRenderSourceAnalysisConventions: RenderSourceAnalysisConventions = {
  includeUnresolved: false,
  isStateBinding(initializer) {
    if (!ts.isCallExpression(initializer)) return false
    if (ts.isIdentifier(initializer.expression) && initializer.expression.text === "useSidebar") return true
    return ts.isPropertyAccessExpression(initializer.expression)
      && initializer.expression.expression.getText() === "React"
      && initializer.expression.name.text === "useContext"
      && initializer.arguments.length === 1
      && ts.isIdentifier(initializer.arguments[0])
      && initializer.arguments[0].text === "SidebarRenderContext"
  },
  normalizeRenderName: canonicalRenderName,
  matchesCrossFamilySource(moduleSpecifier, familyId) {
    const canonicalModuleSpecifier = canonicalModuleSpecifiers.get(familyId)
    return canonicalModuleSpecifier !== undefined && extensionless(moduleSpecifier) === canonicalModuleSpecifier
  },
  matchesInheritedInterface(sourceTag, interfaceId, normalizeRenderName, importBinding) {
    if (sourceTag === "Loader2" && interfaceId === "html.svg") {
      return importBinding?.moduleSpecifier === "lucide-react" && importBinding.importedName === "Loader2"
    }
    if (interfaceId.startsWith("html.")) return sourceTag === interfaceId.slice("html.".length)
    const primitiveInterfaceMatch = matchesCanonicalPrimitiveInterface(sourceTag, interfaceId)
    if (primitiveInterfaceMatch !== undefined) return primitiveInterfaceMatch
    const sourceName = normalizeRenderName(sourceTag)
    const interfaceName = normalizeRenderName(interfaceId)
    return sourceName.endsWith(interfaceName) || (sourceTag.startsWith("SheetPrimitive.") && sourceName.replace(/^sheet/, "dialog") === interfaceName)
  },
}
