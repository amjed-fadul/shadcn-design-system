import type { RenderSourceAnalysisConventions } from "./render-source-analysis"
import seedComponents from "../../../provenance/seed-components.json"

function canonicalRenderName(name: string) {
  return name.replace(/primitive/gi, "").replace(/[^a-z0-9]/gi, "").replace(/^radix/i, "").toLowerCase()
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
  normalizeRenderName: canonicalRenderName,
  matchesCrossFamilySource(moduleSpecifier, familyId) {
    const canonicalModuleSpecifier = canonicalModuleSpecifiers.get(familyId)
    return canonicalModuleSpecifier !== undefined && extensionless(moduleSpecifier) === canonicalModuleSpecifier
  },
  matchesInheritedInterface(sourceTag, interfaceId, normalizeRenderName) {
    if (interfaceId.startsWith("html.")) return sourceTag === interfaceId.slice("html.".length)
    const sourceName = normalizeRenderName(sourceTag)
    const interfaceName = normalizeRenderName(interfaceId)
    return sourceName.endsWith(interfaceName) || (sourceTag.startsWith("SheetPrimitive.") && sourceName.replace(/^sheet/, "dialog") === interfaceName)
  },
}
