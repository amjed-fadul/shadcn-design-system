import { readFileSync } from "node:fs"

import ts from "typescript"

import { findDelegatedSourceFunction } from "./delegated-host-source-analysis"
import { extractFunctionPropDefaults } from "./render-source-analysis"

/** Extracts the canonical delegated-host source facts used by the pinned Button contract. */
export function extractButtonRenderingEvidence(sourcePath: string, exportName: string): { asChildDefault: string | number | boolean | null | undefined; conditionProp: string; whenTrue: string; whenFalse: string; replacementHost: string; defaultHost: string; dataAttributes: Array<{ name: string; value?: string; sourceProp?: string }>; forwardsProps: boolean; portals: boolean } {
  const file = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const functionDeclaration = findDelegatedSourceFunction(file, exportName)
  let conditionProp = "", replacementHost = "", defaultHost = "", forwardsProps = false, portals = false
  const dataAttributes: Array<{ name: string; value?: string; sourceProp?: string }> = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "Comp" && node.initializer && ts.isConditionalExpression(node.initializer)) {
      const { condition, whenTrue, whenFalse } = node.initializer
      if (ts.isIdentifier(condition)) conditionProp = condition.text
      if (ts.isPropertyAccessExpression(whenTrue)) replacementHost = `${whenTrue.expression.getText(file)}.${whenTrue.name.text}`
      if (ts.isStringLiteral(whenFalse)) defaultHost = whenFalse.text
    }
    if (ts.isJsxSpreadAttribute(node) && ts.isIdentifier(node.expression) && node.expression.text === "props") forwardsProps = true
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text.startsWith("data-") && ts.isJsxOpeningElement(node.parent.parent) && node.parent.parent.tagName.getText(file) === "Comp") {
      if (node.initializer && ts.isStringLiteral(node.initializer)) dataAttributes.push({ name: node.name.text, value: node.initializer.text })
      else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isIdentifier(node.initializer.expression)) dataAttributes.push({ name: node.name.text, sourceProp: node.initializer.expression.text })
    }
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(file).endsWith("Portal")) portals = true
    ts.forEachChild(node, visit)
  }
  if (functionDeclaration) visit(functionDeclaration)
  return { asChildDefault: extractFunctionPropDefaults(sourcePath, exportName).get("asChild"), conditionProp, whenTrue: replacementHost, whenFalse: defaultHost, replacementHost, defaultHost, dataAttributes, forwardsProps, portals }
}
