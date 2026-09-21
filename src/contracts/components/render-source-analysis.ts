import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import ts from "typescript"

import type { SourceExpressionIdentity } from "./types"

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

type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction

function findSourceFunction(sourcePath: string, exportName: string): SourceFunction | undefined {
  const file = sourceFile(sourcePath)
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName) return statement
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName || !declaration.initializer) continue
      if (ts.isArrowFunction(declaration.initializer)) return declaration.initializer
      let result: ts.ArrowFunction | undefined
      const visit = (node: ts.Node) => { if (result) return; if (ts.isArrowFunction(node)) result = node; else ts.forEachChild(node, visit) }
      visit(declaration.initializer)
      if (result) return result
    }
  }
  return undefined
}

export function extractFunctionPropDefaults(sourcePath: string, exportName: string): Map<string, string | number | boolean | null> {
  const functionDeclaration = findSourceFunction(sourcePath, exportName)
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

export type JsxRenderCondition =
  | { propName: string; equals: string | number | boolean }
  | { propName: string; truthiness: "truthy" | "falsy" }
  | { source: "state"; name: string; equals: string | number | boolean }
  | { source: "state"; name: string; truthiness: "truthy" | "falsy" }
export type JsxRenderValue = { source: "literal"; value: string | number | boolean } | { source: "prop" | "state"; name: string }
type JsxDataAttribute = { name: string; value?: string; prop?: string; condition?: JsxRenderCondition; whenTrue?: JsxRenderValue; whenFalse?: JsxRenderValue; expression?: string } & (
  | { source: "literal" | "primitive-state" }
  | { source: "prop"; prop: string }
  | { source: "derived-condition"; condition: JsxRenderCondition }
  | { source: "conditional-value"; condition: JsxRenderCondition; whenTrue: JsxRenderValue; whenFalse: JsxRenderValue }
  | { source: "unresolved" }
)
export type JsxDerivedSpread = { source: "prop" | "state"; name: string }
export type JsxImportBinding = { importedName: string; localName: string; moduleSpecifier: string }
export type JsxRenderNode = { tag: string; kind: "intrinsic" | "component" | "member" | "fragment" | "unresolved"; importBinding?: JsxImportBinding; resolvedHost?: { tag: string; kind: "intrinsic" | "component" | "member" | "unresolved"; importBinding?: JsxImportBinding }; portal: boolean; receivesPublicProps: boolean; dataAttributes: JsxDataAttribute[]; derivedSpreads: JsxDerivedSpread[]; children: Array<JsxRenderNode & { when?: JsxRenderCondition }>; when?: JsxRenderCondition }
export type JsxRenderAlternative = ({ when: JsxRenderCondition; otherwise?: never } | { otherwise: true; when?: never }) & { root: JsxRenderNode }
export type JsxSourceUnresolvedFinding = SourceExpressionIdentity & { reason: string }
export type JsxRenderTree = { root?: JsxRenderNode; alternatives?: JsxRenderAlternative[]; unresolved: string[]; unresolvedFindings: JsxSourceUnresolvedFinding[] }
type JsxHost = { tag: string; kind: Exclude<JsxRenderNode["kind"], "fragment">; importBinding?: JsxImportBinding }
type JsxScope = { aliases: Map<string, JsxRenderNode>; hostAliases: Map<string, JsxHost>; derivedSpreads: Map<string, JsxDerivedSpread>; importBindings: Map<string, JsxImportBinding> }
type JsxUnresolved = { messages: string[]; findings: JsxSourceUnresolvedFinding[] }

function recordUnresolved(unresolved: JsxUnresolved, node: ts.Node, file: ts.SourceFile, reason: string) {
  unresolved.messages.push(reason)
  unresolved.findings.push({ sourcePath: file.fileName, start: node.getStart(file), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(file), reason })
}

function jsxTagName(tagName: ts.JsxTagNameExpression, file: ts.SourceFile): { tag: string; kind: JsxRenderNode["kind"] } {
  const tag = tagName.getText(file)
  if (ts.isIdentifier(tagName)) return { tag, kind: /^[a-z]/.test(tag) ? "intrinsic" : "component" }
  if (ts.isPropertyAccessExpression(tagName)) return { tag, kind: "member" }
  return { tag, kind: "unresolved" }
}

function publicPropBindings(functionDeclaration: SourceFunction) {
  const bindings = new Set<string>()
  const parameter = functionDeclaration.parameters[0]
  if (!parameter) return bindings
  if (ts.isIdentifier(parameter.name)) bindings.add(parameter.name.text)
  if (ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (ts.isIdentifier(element.name)) bindings.add(element.name.text)
  return bindings
}

function referenceCondition(name: string, publicBindings: Set<string>, condition: { equals: string | number | boolean } | { truthiness: "truthy" | "falsy" }): JsxRenderCondition {
  return publicBindings.has(name) ? { propName: name, ...condition } : { source: "state", name, ...condition }
}

function derivedCondition(expression: ts.Expression, publicBindings: Set<string>): JsxRenderCondition | undefined {
  if (!ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) return undefined
  const left = ts.isIdentifier(expression.left) ? expression.left.text : undefined
  const right = ts.isIdentifier(expression.right) ? expression.right.text : undefined
  const leftLiteral = literal(expression.left)
  const rightLiteral = literal(expression.right)
  if (left && rightLiteral !== undefined && rightLiteral !== null) return referenceCondition(left, publicBindings, { equals: rightLiteral })
  if (right && leftLiteral !== undefined && leftLiteral !== null) return referenceCondition(right, publicBindings, { equals: leftLiteral })
  return undefined
}

function truthinessCondition(expression: ts.Expression, publicBindings: Set<string>): JsxRenderCondition | undefined {
  if (ts.isIdentifier(expression)) return referenceCondition(expression.text, publicBindings, { truthiness: "truthy" })
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(expression.operand)) return referenceCondition(expression.operand.text, publicBindings, { truthiness: "falsy" })
  return undefined
}

function renderValue(expression: ts.Expression, publicBindings: Set<string>): JsxRenderValue | undefined {
  const value = literal(expression)
  if (value !== undefined && value !== null) return { source: "literal", value }
  if (ts.isIdentifier(expression)) return publicBindings.has(expression.text) ? { source: "prop", name: expression.text } : { source: "state", name: expression.text }
  return undefined
}

function conditionalValue(expression: ts.Expression, publicBindings: Set<string>) {
  if (!ts.isConditionalExpression(expression)) return undefined
  const condition = derivedCondition(expression.condition, publicBindings)
  const whenTrue = renderValue(expression.whenTrue, publicBindings)
  const whenFalse = renderValue(expression.whenFalse, publicBindings)
  return condition && whenTrue && whenFalse ? { condition, whenTrue, whenFalse } : undefined
}

function tracedPropSpread(expression: ts.Expression, publicBindings: Set<string>): JsxDerivedSpread | undefined {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return tracedPropSpread(expression.expression, publicBindings)
  if (ts.isIdentifier(expression) && publicBindings.has(expression.text)) return { source: "prop", name: expression.text }
  if (ts.isConditionalExpression(expression)) {
    const whenTrue = tracedPropSpread(expression.whenTrue, publicBindings)
    const whenFalse = tracedPropSpread(expression.whenFalse, publicBindings)
    return whenTrue && whenFalse && whenTrue.name === whenFalse.name ? whenTrue : undefined
  }
  if (!ts.isObjectLiteralExpression(expression)) return undefined
  const values: JsxDerivedSpread[] = []
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined
    const value = tracedPropSpread(property.initializer, publicBindings)
    if (!value) return undefined
    values.push(value)
  }
  return values.length > 0 && values.every((value) => value.name === values[0].name) ? values[0] : undefined
}

function jsxAttributes(attributes: ts.JsxAttributes, file: ts.SourceFile, publicBindings: Set<string>, unresolved: JsxUnresolved, scope: JsxScope) {
  let receivesPublicProps = false
  const dataAttributes: JsxRenderNode["dataAttributes"] = []
  const derivedSpreads: JsxDerivedSpread[] = []
  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      if (ts.isIdentifier(property.expression) && publicBindings.has(property.expression.text)) receivesPublicProps = true
      else if (ts.isIdentifier(property.expression) && scope.derivedSpreads.has(property.expression.text)) derivedSpreads.push(scope.derivedSpreads.get(property.expression.text)!)
      else recordUnresolved(unresolved, property.expression, file, `Unsupported spread provenance: ${property.expression.getText(file)}`)
    }
    if (ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text.startsWith("data-")) {
      if (property.initializer && ts.isStringLiteral(property.initializer)) {
        dataAttributes.push({ name: property.name.text, source: "literal", value: property.initializer.text })
        continue
      }
      const expression = property.initializer && ts.isJsxExpression(property.initializer) ? property.initializer.expression : undefined
      if (expression && ts.isIdentifier(expression)) {
        dataAttributes.push(publicBindings.has(expression.text) ? { name: property.name.text, source: "prop", prop: expression.text } : { name: property.name.text, source: "primitive-state", prop: expression.text })
        continue
      }
      const values = expression && conditionalValue(expression, publicBindings)
      if (values) {
        dataAttributes.push({ name: property.name.text, source: "conditional-value", ...values })
        continue
      }
      const condition = expression && derivedCondition(expression, publicBindings)
      if (condition) {
        dataAttributes.push({ name: property.name.text, source: "derived-condition", condition })
        continue
      }
      const expressionText = expression?.getText(file)
      recordUnresolved(unresolved, expression ?? property, file, `Dynamic data attribute ${property.name.text}: ${expressionText ?? "true"}`)
      dataAttributes.push({ name: property.name.text, source: "unresolved", ...(expressionText ? { expression: expressionText } : {}) })
    }
  }
  return { receivesPublicProps, dataAttributes, derivedSpreads }
}

function jsxExpressionChildren(expression: ts.Expression | undefined, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxRenderNode[] {
  if (!expression || ts.isIdentifier(expression) && expression.text === "children") return []
  if (ts.isIdentifier(expression) && scope.aliases.has(expression.text)) return [structuredClone(scope.aliases.get(expression.text)!)]
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return jsxExpressionChildren(expression.expression, file, unresolved, publicBindings, scope)
  if (ts.isConditionalExpression(expression)) { recordUnresolved(unresolved, expression.condition, file, `Conditional JSX child cannot establish unconditional automatic structure: ${expression.condition.getText(file)}`); return [...jsxExpressionChildren(expression.whenTrue, file, unresolved, publicBindings, scope), ...jsxExpressionChildren(expression.whenFalse, file, unresolved, publicBindings, scope)] }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    if (ts.isIdentifier(expression.left)) {
      const propName = expression.left.text
      return jsxExpressionChildren(expression.right, file, unresolved, publicBindings, scope).map((node) => ({ ...node, when: publicBindings.has(propName) ? { propName, equals: true } : { source: "state", name: propName, truthiness: "truthy" } }))
    }
    recordUnresolved(unresolved, expression.left, file, `Conditional JSX child cannot establish automatic structure: ${expression.left.getText(file)}`)
    return jsxExpressionChildren(expression.right, file, unresolved, publicBindings, scope)
  }
  if (ts.isJsxElement(expression)) return [jsxNode(expression, file, unresolved, publicBindings, scope)]
  if (ts.isJsxSelfClosingElement(expression)) return [jsxNode(expression, file, unresolved, publicBindings, scope)]
  if (ts.isJsxFragment(expression)) return [jsxNode(expression, file, unresolved, publicBindings, scope)]
  recordUnresolved(unresolved, expression, file, `Unsupported JSX child expression: ${expression.getText(file)}`)
  return []
}

function jsxChildren(children: readonly ts.JsxChild[], file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxRenderNode[] {
  return children.flatMap((child) => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) return [jsxNode(child, file, unresolved, publicBindings, scope)]
    if (ts.isJsxExpression(child)) return jsxExpressionChildren(child.expression, file, unresolved, publicBindings, scope)
    return []
  })
}

function aliasHost(expression: ts.Expression, file: ts.SourceFile): JsxHost | undefined {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return aliasHost(expression.expression, file)
  if (ts.isConditionalExpression(expression)) return aliasHost(expression.whenFalse, file)
  if (ts.isStringLiteral(expression)) return { tag: expression.text, kind: "intrinsic" }
  if (ts.isIdentifier(expression)) return { tag: expression.text, kind: /^[a-z]/.test(expression.text) ? "intrinsic" : "component" }
  if (ts.isPropertyAccessExpression(expression)) return { tag: expression.getText(file), kind: "member" }
  return undefined
}

function jsxNode(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxRenderNode {
  if (ts.isJsxFragment(node)) return { tag: "Fragment", kind: "fragment", portal: false, receivesPublicProps: false, dataAttributes: [], derivedSpreads: [], children: jsxChildren(node.children, file, unresolved, publicBindings, scope) }
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  const name = jsxTagName(opening.tagName, file)
  if (name.kind === "unresolved") recordUnresolved(unresolved, opening.tagName, file, `Unsupported JSX tag: ${name.tag}`)
  const resolvedHost = ts.isIdentifier(opening.tagName) ? scope.hostAliases.get(opening.tagName.text) : undefined
  const importBinding = ts.isIdentifier(opening.tagName) ? scope.importBindings.get(opening.tagName.text) : undefined
  return { ...name, ...(importBinding ? { importBinding } : {}), ...(resolvedHost ? { resolvedHost } : {}), portal: name.tag === "Portal" || name.tag.endsWith(".Portal") || name.tag.endsWith("Portal"), ...jsxAttributes(opening.attributes, file, publicBindings, unresolved, scope), children: ts.isJsxElement(node) ? jsxChildren(node.children, file, unresolved, publicBindings, scope) : [] }
}

type ReturnedJsx = { expression: ts.Expression; when?: JsxRenderCondition; otherwise?: true }

function directReturns(statement: ts.Statement, condition: JsxRenderCondition | undefined, results: ReturnedJsx[]) {
  if (ts.isReturnStatement(statement) && statement.expression) results.push({ expression: statement.expression, ...(condition ? { when: condition } : {}) })
  else if (ts.isBlock(statement)) for (const child of statement.statements) directReturns(child, condition, results)
}

function returnedJsx(functionDeclaration: SourceFunction, file: ts.SourceFile, publicBindings: Set<string>, unresolved: JsxUnresolved): ReturnedJsx[] {
  const results: ReturnedJsx[] = []
  let hasUnsupportedReturnCondition = false
  if (ts.isArrowFunction(functionDeclaration) && !ts.isBlock(functionDeclaration.body)) return [{ expression: functionDeclaration.body }]
  if (!functionDeclaration.body || !ts.isBlock(functionDeclaration.body)) return results
  for (const statement of functionDeclaration.body.statements) {
    if (ts.isIfStatement(statement)) {
      const condition = truthinessCondition(statement.expression, publicBindings) ?? derivedCondition(statement.expression, publicBindings)
      if (!condition) {
        recordUnresolved(unresolved, statement.expression, file, `Unsupported return condition: ${statement.expression.getText(file)}`)
        hasUnsupportedReturnCondition = true
        continue
      }
      directReturns(statement.thenStatement, condition, results)
      if (statement.elseStatement && condition && "truthiness" in condition) directReturns(statement.elseStatement, { ...condition, truthiness: condition.truthiness === "truthy" ? "falsy" : "truthy" }, results)
      else if (statement.elseStatement) directReturns(statement.elseStatement, undefined, results)
    } else directReturns(statement, undefined, results)
  }
  if (hasUnsupportedReturnCondition) return results.filter((result) => result.when)
  if (results.length === 2 && results[0].when && "truthiness" in results[0].when && !results[1].when) results[1].when = { ...results[0].when, truthiness: results[0].when.truthiness === "truthy" ? "falsy" : "truthy" }
  if (results.length > 1) for (const result of results) if (!result.when) result.otherwise = true
  return results
}

function aliases(functionDeclaration: SourceFunction, file: ts.SourceFile, publicBindings: Set<string>, unresolved: JsxUnresolved) {
  const importBindings = new Map<string, JsxImportBinding>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const moduleSpecifier = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (clause?.name) importBindings.set(clause.name.text, { importedName: "default", localName: clause.name.text, moduleSpecifier })
    const bindings = clause?.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) importBindings.set(bindings.name.text, { importedName: "*", localName: bindings.name.text, moduleSpecifier })
    if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) importBindings.set(element.name.text, { importedName: element.propertyName?.text ?? element.name.text, localName: element.name.text, moduleSpecifier })
  }
  const scope: JsxScope = { aliases: new Map(), hostAliases: new Map(), derivedSpreads: new Map(), importBindings }
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isJsxElement(node.initializer) || ts.isJsxSelfClosingElement(node.initializer) || ts.isJsxFragment(node.initializer)) {
        const nodes = jsxExpressionChildren(node.initializer, file, unresolved, publicBindings, scope)
        if (nodes.length === 1) scope.aliases.set(node.name.text, nodes[0])
      } else {
        const host = aliasHost(node.initializer, file)
        if (host) scope.hostAliases.set(node.name.text, host)
        const spread = tracedPropSpread(node.initializer, publicBindings)
        if (spread) scope.derivedSpreads.set(node.name.text, spread)
      }
    }
    if (!ts.isFunctionLike(node) || node === functionDeclaration) ts.forEachChild(node, visit)
  }
  if (functionDeclaration.body) ts.forEachChild(functionDeclaration.body, visit)
  return scope
}

export function analyzeJsxRenderTree(sourcePath: string, exportName: string): JsxRenderTree {
  const file = sourceFile(sourcePath)
  const declaration = findSourceFunction(sourcePath, exportName)
  const unresolved: JsxUnresolved = { messages: [], findings: [] }
  if (!declaration) {
    recordUnresolved(unresolved, file, file, `No returned JSX found for ${exportName}`)
    return { unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  }
  const bindings = publicPropBindings(declaration)
  const scope = aliases(declaration, file, bindings, unresolved)
  const expressions = returnedJsx(declaration, file, bindings, unresolved)
  if (!expressions.length) {
    recordUnresolved(unresolved, declaration, file, `No returned JSX found for ${exportName}`)
    return { unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  }
  const roots = expressions.flatMap((expression) => jsxExpressionChildren(expression.expression, file, unresolved, bindings, scope).map((root) => ({ ...expression, root })))
  if (roots.length !== expressions.length || !roots.length) recordUnresolved(unresolved, declaration, file, `No JSX root found for ${exportName}`)
  if (roots.length === 1 && !roots[0].when && !roots[0].otherwise) return { root: roots[0].root, unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  return { alternatives: roots.map(({ when, otherwise, root }) => when ? { when, root } : { otherwise: otherwise ?? true, root }), unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
}

type ContractRenderNode = { id: string; host: { kind: string; tag?: string; interfaceId?: string; familyId?: string; exportName?: string }; receivesPublicProps: boolean; dataAttributes: Array<{ name: string; source: string; value?: string; prop?: string; condition?: JsxRenderCondition; whenTrue?: unknown; whenFalse?: unknown }>; derivedSpreads?: Array<{ source: string; name: string }>; children: Array<{ nodeId: string; when?: JsxRenderCondition }> }
type ContractRenderingTree = { rootNodeId: string; publicPropsTargetNodeId: string; nodes: ContractRenderNode[]; portalBoundaries: Array<{ nodeId: string }> }
type ContractRendering = ContractRenderingTree | { alternatives: Array<({ when: JsxRenderCondition; otherwise?: never } | { otherwise: true; when?: never }) & { rendering: ContractRenderingTree }> }

export type RenderSourceAnalysisConventions = Readonly<{
  normalizeRenderName?: (name: string) => string
  matchesInheritedInterface?: (sourceTag: string, interfaceId: string, normalizeRenderName: (name: string) => string) => boolean
  matchesCrossFamilySource?: (moduleSpecifier: string, familyId: string) => boolean
  includeUnresolved?: boolean
}>

function normalizedRenderName(name: string) { return name.replace(/[^a-z0-9]/gi, "").toLowerCase() }

function renderHostMatches(host: ContractRenderNode["host"], source: JsxRenderNode, conventions: RenderSourceAnalysisConventions) {
  const resolved = source.resolvedHost ?? source
  const normalizeRenderName = conventions.normalizeRenderName ?? normalizedRenderName
  if (host.kind === "intrinsic") return resolved.kind === "intrinsic" && resolved.tag === host.tag
  if (host.kind === "fragment") return resolved.kind === "fragment"
  if (host.kind === "component-export") return normalizeRenderName(resolved.tag) === normalizeRenderName(host.exportName ?? "")
  if (host.kind === "cross-family-export") {
    const binding = resolved.importBinding ?? source.importBinding
    if (!binding) return false
    return binding.importedName === host.exportName
      && Boolean(conventions.matchesCrossFamilySource?.(binding.moduleSpecifier, host.familyId ?? ""))
  }
  if (host.kind === "inherited-interface") {
    const interfaceId = host.interfaceId ?? ""
    return conventions.matchesInheritedInterface?.(resolved.tag, interfaceId, normalizeRenderName) ?? normalizeRenderName(resolved.tag).endsWith(normalizeRenderName(interfaceId))
  }
  return host.kind === "unresolved" && (source.kind === "component" || source.kind === "member" || source.kind === "unresolved" || Boolean(source.resolvedHost))
}

function sameDataAttributes(expected: ContractRenderNode["dataAttributes"], actual: JsxRenderNode["dataAttributes"]) {
  return expected.length === actual.length && expected.every((attribute, index) => {
    const candidate = actual[index]
    return attribute.name === candidate?.name && attribute.source === candidate?.source && attribute.value === candidate?.value && attribute.prop === candidate?.prop && JSON.stringify(attribute.condition ?? null) === JSON.stringify(candidate?.condition ?? null) && JSON.stringify(attribute.source === "conditional-value" ? attribute.whenTrue : null) === JSON.stringify(candidate?.source === "conditional-value" ? candidate.whenTrue : null) && JSON.stringify(attribute.source === "conditional-value" ? attribute.whenFalse : null) === JSON.stringify(candidate?.source === "conditional-value" ? candidate.whenFalse : null)
  })
}

function sameDerivedSpreads(expected: ContractRenderNode["derivedSpreads"], actual: JsxRenderNode["derivedSpreads"]) {
  return JSON.stringify((expected ?? []).map(({ source, name }) => ({ source, name }))) === JSON.stringify(actual)
}

/** Compares contract rendering facts with a source-derived JSX tree without assigning semantics to unresolved expressions. */
export function compareJsxRenderTree(rendering: ContractRendering, source: JsxRenderTree, conventions: RenderSourceAnalysisConventions = {}): string[] {
  const errors = conventions.includeUnresolved === false ? [] : [...source.unresolved]
  const compareTree = (expectedRendering: ContractRenderingTree, root: JsxRenderNode) => {
  const nodes = new Map(expectedRendering.nodes.map((node) => [node.id, node]))
  const portalNodes = new Set(expectedRendering.portalBoundaries.map((boundary) => boundary.nodeId))
  const seen = new Set<string>()
  const compare = (id: string, actual: JsxRenderNode, path: string) => {
    const expected = nodes.get(id)
    if (!expected) { errors.push(`Contract is missing source render node at ${path}.`); return }
    if (seen.has(id)) { errors.push(`Contract reuses render node ${id}.`); return }
    seen.add(id)
    if (!renderHostMatches(expected.host, actual, conventions)) errors.push(`Render host mismatch at ${path}: ${actual.tag}.`)
    if (expected.receivesPublicProps !== actual.receivesPublicProps) errors.push(`Public-props target mismatch at ${path}.`)
    if (!sameDataAttributes(expected.dataAttributes, actual.dataAttributes)) errors.push(`Data attributes mismatch at ${path}.`)
    if (!sameDerivedSpreads(expected.derivedSpreads, actual.derivedSpreads)) errors.push(`Derived spreads mismatch at ${path}.`)
    if (portalNodes.has(id) !== actual.portal) errors.push(`Portal boundary mismatch at ${path}.`)
    if (expected.children.length !== actual.children.length) errors.push(`Automatic child count mismatch at ${path}.`)
    for (let index = 0; index < Math.min(expected.children.length, actual.children.length); index++) {
      const expectedChild = expected.children[index]
      const actualChild = actual.children[index]
      if (JSON.stringify(expectedChild.when ?? null) !== JSON.stringify(actualChild.when ?? null)) errors.push(`Conditional render edge mismatch at ${path}>${actualChild.tag}.`)
      compare(expectedChild.nodeId, actualChild, `${path}>${actualChild.tag}`)
    }
  }
  compare(expectedRendering.rootNodeId, root, root.tag)
  if (expectedRendering.publicPropsTargetNodeId && !seen.has(expectedRendering.publicPropsTargetNodeId)) errors.push("Public-props target is not source-reachable.")
  if (seen.size !== expectedRendering.nodes.length) errors.push("Contract has render nodes absent from source.")
  }
  if ("alternatives" in rendering) {
    if (!source.alternatives) return [...errors, "Source has no render alternatives."]
    if (rendering.alternatives.length !== source.alternatives.length) errors.push("Render alternative count mismatch.")
    for (let index = 0; index < Math.min(rendering.alternatives.length, source.alternatives.length); index++) {
      const expected = rendering.alternatives[index]
      const actual = source.alternatives[index]
      if (JSON.stringify("when" in expected ? expected.when : { otherwise: true }) !== JSON.stringify("when" in actual ? actual.when : { otherwise: true })) errors.push(`Render alternative condition mismatch at ${index}.`)
      compareTree(expected.rendering, actual.root)
    }
    return errors
  }
  if (!source.root) return [...errors, "Source has no render root."]
  compareTree(rendering, source.root)
  return errors
}
