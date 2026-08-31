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

export type JsxRenderNode = { tag: string; kind: "intrinsic" | "component" | "member" | "fragment" | "unresolved"; portal: boolean; receivesPublicProps: boolean; dataAttributes: Array<{ name: string; value?: string; prop?: string }>; children: JsxRenderNode[] }
export type JsxRenderTree = { root?: JsxRenderNode; unresolved: string[] }

function jsxTagName(tagName: ts.JsxTagNameExpression, file: ts.SourceFile): { tag: string; kind: JsxRenderNode["kind"] } {
  const tag = tagName.getText(file)
  if (ts.isIdentifier(tagName)) return { tag, kind: /^[a-z]/.test(tag) ? "intrinsic" : "component" }
  if (ts.isPropertyAccessExpression(tagName)) return { tag, kind: "member" }
  return { tag, kind: "unresolved" }
}

function publicPropBindings(functionDeclaration: ts.FunctionDeclaration) {
  const bindings = new Set<string>()
  const parameter = functionDeclaration.parameters[0]
  if (!parameter) return bindings
  if (ts.isIdentifier(parameter.name)) bindings.add(parameter.name.text)
  if (ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (element.dotDotDotToken && ts.isIdentifier(element.name)) bindings.add(element.name.text)
  return bindings
}

function jsxAttributes(attributes: ts.JsxAttributes, file: ts.SourceFile, publicBindings: Set<string>, unresolved: string[]) {
  let receivesPublicProps = false
  const dataAttributes: JsxRenderNode["dataAttributes"] = []
  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      if (ts.isIdentifier(property.expression) && publicBindings.has(property.expression.text)) receivesPublicProps = true
      else unresolved.push(`Unsupported spread provenance: ${property.expression.getText(file)}`)
    }
    if (ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text.startsWith("data-")) {
      const value = property.initializer && ts.isStringLiteral(property.initializer) ? property.initializer.text : undefined
      const expression = property.initializer && ts.isJsxExpression(property.initializer) ? property.initializer.expression : undefined
      const prop = expression && ts.isIdentifier(expression) ? expression.text : undefined
      if (expression && !prop) unresolved.push(`Dynamic data attribute ${property.name.text}: ${expression.getText(file)}`)
      dataAttributes.push({ name: property.name.text, ...(value === undefined ? {} : { value }), ...(prop === undefined ? {} : { prop }) })
    }
  }
  return { receivesPublicProps, dataAttributes }
}

function jsxExpressionChildren(expression: ts.Expression | undefined, file: ts.SourceFile, unresolved: string[], publicBindings: Set<string>): JsxRenderNode[] {
  if (!expression || ts.isIdentifier(expression) && expression.text === "children") return []
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return jsxExpressionChildren(expression.expression, file, unresolved, publicBindings)
  if (ts.isConditionalExpression(expression)) { unresolved.push(`Conditional JSX child cannot establish unconditional automatic structure: ${expression.condition.getText(file)}`); return [...jsxExpressionChildren(expression.whenTrue, file, unresolved, publicBindings), ...jsxExpressionChildren(expression.whenFalse, file, unresolved, publicBindings)] }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { unresolved.push(`Conditional JSX child cannot establish unconditional automatic structure: ${expression.left.getText(file)}`); return jsxExpressionChildren(expression.right, file, unresolved, publicBindings) }
  if (ts.isJsxElement(expression)) return [jsxNode(expression, file, unresolved, publicBindings)]
  if (ts.isJsxSelfClosingElement(expression)) return [jsxNode(expression, file, unresolved, publicBindings)]
  if (ts.isJsxFragment(expression)) return [jsxNode(expression, file, unresolved, publicBindings)]
  unresolved.push(`Unsupported JSX child expression: ${expression.getText(file)}`)
  return []
}

function jsxChildren(children: readonly ts.JsxChild[], file: ts.SourceFile, unresolved: string[], publicBindings: Set<string>): JsxRenderNode[] {
  return children.flatMap((child) => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) return [jsxNode(child, file, unresolved, publicBindings)]
    if (ts.isJsxExpression(child)) return jsxExpressionChildren(child.expression, file, unresolved, publicBindings)
    return []
  })
}

function jsxNode(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, file: ts.SourceFile, unresolved: string[], publicBindings: Set<string>): JsxRenderNode {
  if (ts.isJsxFragment(node)) return { tag: "Fragment", kind: "fragment", portal: false, receivesPublicProps: false, dataAttributes: [], children: jsxChildren(node.children, file, unresolved, publicBindings) }
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  const name = jsxTagName(opening.tagName, file)
  if (name.kind === "unresolved") unresolved.push(`Unsupported JSX tag: ${name.tag}`)
  return { ...name, portal: name.tag === "Portal" || name.tag.endsWith(".Portal"), ...jsxAttributes(opening.attributes, file, publicBindings, unresolved), children: ts.isJsxElement(node) ? jsxChildren(node.children, file, unresolved, publicBindings) : [] }
}

function returnedJsx(functionDeclaration: ts.FunctionDeclaration): ts.Expression[] {
  const results: ts.Expression[] = []
  const visit = (node: ts.Node) => { if (ts.isReturnStatement(node) && node.expression) results.push(node.expression); else if (!ts.isFunctionLike(node) || node === functionDeclaration) ts.forEachChild(node, visit) }
  if (functionDeclaration.body) ts.forEachChild(functionDeclaration.body, visit)
  return results
}

export function analyzeJsxRenderTree(sourcePath: string, exportName: string): JsxRenderTree {
  const file = sourceFile(sourcePath)
  const declaration = file.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === exportName)
  const expressions = declaration ? returnedJsx(declaration) : []
  const unresolved: string[] = []
  if (!expressions.length) return { unresolved: [`No returned JSX found for ${exportName}`] }
  const roots = expressions.flatMap((expression) => jsxExpressionChildren(expression, file, unresolved, publicPropBindings(declaration!)))
  if (roots.length !== 1) {
    if (!roots.length) unresolved.push(`No JSX root found for ${exportName}`)
    else unresolved.push(`Multiple returned JSX roots found for ${exportName}`)
  }
  return { ...(roots.length ? { root: roots[0] } : {}), unresolved }
}

type ContractRenderNode = { id: string; host: { kind: string; tag?: string; interfaceId?: string; exportName?: string }; receivesPublicProps: boolean; dataAttributes: Array<{ name: string; value?: string; prop?: string }>; children: Array<{ nodeId: string }> }
type ContractRendering = { rootNodeId: string; publicPropsTargetNodeId: string; nodes: ContractRenderNode[]; portalBoundaries: Array<{ nodeId: string }> }

function normalizedRenderName(name: string) { return name.replace(/primitive/gi, "").replace(/[^a-z0-9]/gi, "").replace(/^radix/i, "").toLowerCase() }

function renderHostMatches(host: ContractRenderNode["host"], source: JsxRenderNode) {
  if (host.kind === "intrinsic") return source.kind === "intrinsic" && source.tag === host.tag
  if (host.kind === "fragment") return source.kind === "fragment"
  if (host.kind === "component-export") return normalizedRenderName(source.tag) === normalizedRenderName(host.exportName ?? "")
  if (host.kind === "inherited-interface") return normalizedRenderName(source.tag).endsWith(normalizedRenderName(host.interfaceId ?? ""))
  return host.kind === "unresolved" && (source.kind === "component" || source.kind === "member" || source.kind === "unresolved")
}

function sameDataAttributes(expected: ContractRenderNode["dataAttributes"], actual: JsxRenderNode["dataAttributes"]) {
  return expected.length === actual.length && expected.every((attribute, index) => attribute.name === actual[index]?.name && attribute.value === actual[index]?.value && attribute.prop === actual[index]?.prop)
}

/** Compares contract rendering facts with a source-derived JSX tree without assigning semantics to unresolved expressions. */
export function compareJsxRenderTree(rendering: ContractRendering, source: JsxRenderTree): string[] {
  const errors = [...source.unresolved]
  if (!source.root) return [...errors, "Source has no render root."]
  const nodes = new Map(rendering.nodes.map((node) => [node.id, node]))
  const portalNodes = new Set(rendering.portalBoundaries.map((boundary) => boundary.nodeId))
  const seen = new Set<string>()
  const compare = (id: string, actual: JsxRenderNode, path: string) => {
    const expected = nodes.get(id)
    if (!expected) { errors.push(`Contract is missing source render node at ${path}.`); return }
    if (seen.has(id)) { errors.push(`Contract reuses render node ${id}.`); return }
    seen.add(id)
    if (!renderHostMatches(expected.host, actual)) errors.push(`Render host mismatch at ${path}: ${actual.tag}.`)
    if (expected.receivesPublicProps !== actual.receivesPublicProps) errors.push(`Public-props target mismatch at ${path}.`)
    if (!sameDataAttributes(expected.dataAttributes, actual.dataAttributes)) errors.push(`Data attributes mismatch at ${path}.`)
    if (portalNodes.has(id) !== actual.portal) errors.push(`Portal boundary mismatch at ${path}.`)
    if (expected.children.length !== actual.children.length) errors.push(`Automatic child count mismatch at ${path}.`)
    for (let index = 0; index < Math.min(expected.children.length, actual.children.length); index++) compare(expected.children[index].nodeId, actual.children[index], `${path}>${actual.children[index].tag}`)
  }
  compare(rendering.rootNodeId, source.root, source.root.tag)
  if (rendering.publicPropsTargetNodeId && !seen.has(rendering.publicPropsTargetNodeId)) errors.push("Public-props target is not source-reachable.")
  if (seen.size !== rendering.nodes.length) errors.push("Contract has render nodes absent from source.")
  return errors
}
