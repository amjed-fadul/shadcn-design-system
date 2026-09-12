import ts from "typescript"

import type { RenderSourceAnalysisConventions } from "./render-source-analysis"

function canonicalRenderName(name: string) {
  return name.replace(/primitive/gi, "").replace(/[^a-z0-9]/gi, "").replace(/^radix/i, "").toLowerCase()
}

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
  matchesInheritedInterface(sourceTag, interfaceId, normalizeRenderName) {
    const sourceName = normalizeRenderName(sourceTag)
    const interfaceName = normalizeRenderName(interfaceId)
    return sourceName.endsWith(interfaceName) || (sourceTag.startsWith("SheetPrimitive.") && sourceName.replace(/^sheet/, "dialog") === interfaceName)
  },
}
