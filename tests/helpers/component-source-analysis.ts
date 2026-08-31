import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import ts from "typescript"

export type ModuleExportEvidence = { name: string; declarationKind: string }

function sourceFile(sourcePath: string) { return ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS) }
function propertyName(name: ts.PropertyName): string | undefined { return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined }
function literal(node: ts.Expression): string | number | boolean | null | undefined { if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text; if (node.kind === ts.SyntaxKind.TrueKeyword) return true; if (node.kind === ts.SyntaxKind.FalseKeyword) return false; if (node.kind === ts.SyntaxKind.NullKeyword) return null; return undefined }
function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined { const prop = object.properties.find((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item) && propertyName(item.name) === name); return prop?.initializer }

export function listModuleExports(sourcePath: string): ModuleExportEvidence[] {
  const file = sourceFile(sourcePath); const declarations = new Map<string, string>(); const names = new Set<string>()
  for (const statement of file.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) declarations.set(statement.name.text, ts.SyntaxKind[statement.kind])
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, "VariableDeclaration")
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) names.add(element.name.text)
    if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && statement.name) names.add(statement.name.text)
  }
  return [...names].sort().map((name) => ({ name, declarationKind: declarations.get(name) ?? "Unknown" }))
}

export function readCanonicalSourceBlobSha(sourcePath: string): string { return execFileSync("git", ["hash-object", sourcePath], { encoding: "utf8" }).trim() }

export function extractFunctionPropDefaults(sourcePath: string, exportName: string): Map<string, string | number | boolean | null> {
  const functionDeclaration = sourceFile(sourcePath).statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === exportName)
  const result = new Map<string, string | number | boolean | null>(); const parameter = functionDeclaration?.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return result
  for (const element of parameter.name.elements) if (ts.isIdentifier(element.name) && element.initializer) { const value = literal(element.initializer); if (value !== undefined) result.set(element.name.text, value) }
  return result
}

export function extractCvaVariantLiterals(sourcePath: string, cvaIdentifier: string): { variants: Record<string, string[]>; defaults: Record<string, string>; classNames: Record<string, Record<string, string>>; baseClassName: string } {
  const file = sourceFile(sourcePath); let call: ts.CallExpression | undefined
  file.forEachChild((node) => { if (!ts.isVariableStatement(node)) return; for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === cvaIdentifier && declaration.initializer && ts.isCallExpression(declaration.initializer)) call = declaration.initializer })
  const config = call?.arguments[1]; if (!config || !ts.isObjectLiteralExpression(config)) return { variants: {}, defaults: {}, classNames: {}, baseClassName: "" }
  const variants: Record<string, string[]> = {}; const defaults: Record<string, string> = {}; const classNames: Record<string, Record<string, string>> = {}
  const variantObject = objectProperty(config, "variants"); if (variantObject && ts.isObjectLiteralExpression(variantObject)) for (const variant of variantObject.properties) if (ts.isPropertyAssignment(variant) && ts.isObjectLiteralExpression(variant.initializer)) { const name = propertyName(variant.name); if (name) { variants[name] = []; classNames[name] = {}; for (const value of variant.initializer.properties) if (ts.isPropertyAssignment(value)) { const valueName = propertyName(value.name); if (valueName) { variants[name].push(valueName); if (ts.isStringLiteral(value.initializer)) classNames[name][valueName] = value.initializer.text } } } }
  const defaultsObject = objectProperty(config, "defaultVariants"); if (defaultsObject && ts.isObjectLiteralExpression(defaultsObject)) for (const defaultProperty of defaultsObject.properties) if (ts.isPropertyAssignment(defaultProperty)) { const name = propertyName(defaultProperty.name); const value = literal(defaultProperty.initializer); if (name && typeof value === "string") defaults[name] = value }
  return { variants, defaults, classNames, baseClassName: call?.arguments[0] && ts.isStringLiteral(call.arguments[0]) ? call.arguments[0].text : "" }
}

export function extractDataSlotLiterals(sourcePath: string): string[] { const values: string[] = []; const visit = (node: ts.Node) => { if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "data-slot" && node.initializer && ts.isStringLiteral(node.initializer)) values.push(node.initializer.text); ts.forEachChild(node, visit) }; visit(sourceFile(sourcePath)); return values }

export function extractButtonRenderingEvidence(sourcePath: string, exportName: string): { asChildDefault: string | number | boolean | null | undefined; conditionProp: string; whenTrue: string; whenFalse: string; replacementHost: string; defaultHost: string; dataAttributes: Array<{ name: string; value?: string; sourceProp?: string }>; forwardsProps: boolean; portals: boolean } {
  const file = sourceFile(sourcePath); const functionDeclaration = file.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === exportName); let conditionProp = ""; let replacementHost = ""; let defaultHost = ""; const dataAttributes: Array<{ name: string; value?: string; sourceProp?: string }> = []; let forwardsProps = false; let portals = false
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "Comp" && node.initializer && ts.isConditionalExpression(node.initializer)) { const condition = node.initializer.condition; const whenTrue = node.initializer.whenTrue; const whenFalse = node.initializer.whenFalse; if (ts.isIdentifier(condition)) conditionProp = condition.text; if (ts.isPropertyAccessExpression(whenTrue)) replacementHost = `${whenTrue.expression.getText(file)}.${whenTrue.name.text}`; if (ts.isStringLiteral(whenFalse)) defaultHost = whenFalse.text } if (ts.isJsxSpreadAttribute(node) && ts.isIdentifier(node.expression) && node.expression.text === "props") forwardsProps = true; if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) { if (node.name.text.startsWith("data-")) { if (node.initializer && ts.isStringLiteral(node.initializer)) dataAttributes.push({ name: node.name.text, value: node.initializer.text }); else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isIdentifier(node.initializer.expression)) dataAttributes.push({ name: node.name.text, sourceProp: node.initializer.expression.text }) } } if (ts.isJsxOpeningElement(node) && node.tagName.getText(file).endsWith("Portal")) portals = true; ts.forEachChild(node, visit) }
  if (functionDeclaration) visit(functionDeclaration)
  return { asChildDefault: extractFunctionPropDefaults(sourcePath, exportName).get("asChild"), conditionProp, whenTrue: replacementHost, whenFalse: defaultHost, replacementHost, defaultHost, dataAttributes, forwardsProps, portals }
}
