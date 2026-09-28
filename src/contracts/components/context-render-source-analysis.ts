import { readFileSync } from "node:fs"
import ts from "typescript"

import type { ContextFact, RenderAttributeValue } from "./types"

export type SourceContextFact = Omit<ContextFact, "evidenceRefs" | "provider"> & {
  provider?: { nodeTag: string; fields: Array<{ name: string; value: RenderAttributeValue }> }
}
export type ContextRenderSource = {
  context: SourceContextFact[]
  values: Map<string, RenderAttributeValue>
  bindings: Map<string, string>
  unresolved: string[]
}

type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
type ContextDeclaration = { id: string; defaultFields: SourceContextFact["defaultFields"] }

function nameOf(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined
}
function scalar(node: ts.Expression): string | number | boolean | null | undefined {
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  return undefined
}
function functions(file: ts.SourceFile): Map<string, SourceFunction> {
  const result = new Map<string, SourceFunction>()
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) result.set(statement.name.text, statement)
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
      if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) result.set(declaration.name.text, declaration.initializer)
    }
  }
  return result
}
function reactCalls(file: ts.SourceFile) {
  const namespaces = new Set<string>(), named = new Map<string, string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "react") continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) named.set(item.name.text, item.propertyName?.text ?? item.name.text)
  }
  return (call: ts.CallExpression, method: "createContext" | "useContext") =>
    ts.isIdentifier(call.expression) && named.get(call.expression.text) === method ||
    ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && namespaces.has(call.expression.expression.text) && call.expression.name.text === method
}
function contextDeclarations(file: ts.SourceFile, isReactCall: ReturnType<typeof reactCalls>, declarationErrors: Map<string, string[]>) {
  const result = new Map<string, ContextDeclaration>()
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer) || !isReactCall(declaration.initializer, "createContext")) continue
      const errors: string[] = []
      declarationErrors.set(declaration.name.text, errors)
      const argument = declaration.initializer.arguments[0]
      if (!argument || !ts.isObjectLiteralExpression(argument)) {
        errors.push(`Unsupported context defaults: ${declaration.name.text}`)
        result.set(declaration.name.text, { id: declaration.name.text, defaultFields: [] })
        continue
      }
      const defaultFields: ContextDeclaration["defaultFields"] = []
      for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property) || !nameOf(property.name)) { errors.push(`Unsupported context default field: ${declaration.name.text}`); continue }
        const value = scalar(property.initializer)
        if (value === undefined) { errors.push(`Unsupported context default value: ${declaration.name.text}.${nameOf(property.name)}`); continue }
        defaultFields.push({ name: nameOf(property.name)!, value })
      }
      result.set(declaration.name.text, { id: declaration.name.text, defaultFields })
    }
  }
  return result
}
function jsxTag(node: ts.JsxTagNameExpression): string { return node.getText() }

/** Resolves only literal, prop, context-field, and nullish-coalesced values. */
export function analyzeContextRenderSource(sourcePath: string, exportName: string): ContextRenderSource {
  const file = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const unresolved: string[] = []
  const isReactCall = reactCalls(file)
  const declarationErrors = new Map<string, string[]>()
  const declarations = contextDeclarations(file, isReactCall, declarationErrors)
  const sourceFunctions = functions(file)
  const fn = sourceFunctions.get(exportName)
  if (!fn) return { context: [], values: new Map(), bindings: new Map(), unresolved: [] }
  const props = new Set<string>(), values = new Map<string, RenderAttributeValue>(), contextBindings = new Map<string, string>(), initializers = new Map<string, ts.Expression>()
  const parameter = fn.parameters[0]
  if (parameter && ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (ts.isIdentifier(element.name)) props.add(element.name.text)
  if (fn.body) {
    const gather = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        initializers.set(node.name.text, node.initializer)
        if (ts.isCallExpression(node.initializer) && isReactCall(node.initializer, "useContext")) {
          const argument = node.initializer.arguments[0]
          if (argument && ts.isIdentifier(argument) && declarationErrors.has(argument.text)) contextBindings.set(node.name.text, argument.text)
          else unresolved.push(`Unsupported useContext binding in ${exportName}: ${node.name.text}`)
        }
      }
      if (!ts.isFunctionLike(node) || node === fn) ts.forEachChild(node, gather)
    }
    ts.forEachChild(fn.body, gather)
  }
  const resolve = (expression: ts.Expression, seen = new Set<string>()): RenderAttributeValue | undefined => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return resolve(expression.expression, seen)
    const value = scalar(expression)
    if (value !== undefined) return { source: "literal", value }
    if (ts.isIdentifier(expression)) {
      if (props.has(expression.text)) return { source: "prop", name: expression.text }
      if (seen.has(expression.text)) return undefined
      const initializer = initializers.get(expression.text)
      return initializer ? resolve(initializer, new Set([...seen, expression.text])) : undefined
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      const contextId = contextBindings.get(expression.expression.text)
      if (contextId) return { source: "context-field", contextId, field: expression.name.text }
    }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const first = resolve(expression.left, seen), fallback = resolve(expression.right, seen)
      return first && fallback ? { source: "nullish-coalesce", first, fallback } : undefined
    }
    return undefined
  }
  for (const [name, initializer] of initializers) {
    const value = resolve(initializer, new Set([name]))
    if (value) values.set(name, value)
  }
  const context: SourceContextFact[] = []
  const providers = new Map<string, SourceContextFact["provider"]>()
  const visitProvider = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName
      if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && tag.name.text === "Provider" && declarations.has(tag.expression.text)) {
        const attribute = node.attributes.properties.find((candidate): candidate is ts.JsxAttribute => ts.isJsxAttribute(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === "value")
        const expression = attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined
        if (!expression || !ts.isObjectLiteralExpression(expression)) unresolved.push(`Unsupported provider value: ${jsxTag(tag)}`)
        else {
          const fields: NonNullable<SourceContextFact["provider"]>["fields"] = []
          for (const property of expression.properties) {
            const name = ts.isShorthandPropertyAssignment(property) ? property.name.text : ts.isPropertyAssignment(property) ? nameOf(property.name) : undefined
            const fieldExpression = ts.isShorthandPropertyAssignment(property) ? property.name : ts.isPropertyAssignment(property) ? property.initializer : undefined
            const value = fieldExpression && resolve(fieldExpression)
            if (!name || !value) unresolved.push(`Unsupported provider field: ${jsxTag(tag)}.${name ?? "unknown"}`)
            else fields.push({ name, value })
          }
          if (providers.has(tag.expression.text)) unresolved.push(`Multiple provider values in ${exportName}: ${jsxTag(tag)}`)
          providers.set(tag.expression.text, { nodeTag: jsxTag(tag), fields })
        }
      }
    }
    if (!ts.isFunctionLike(node) || node === fn) ts.forEachChild(node, visitProvider)
  }
  if (fn.body) ts.forEachChild(fn.body, visitProvider)
  for (const [id, declaration] of declarations) {
    const provider = providers.get(id)
    const consumed = [...contextBindings.values()].includes(id)
    if (!provider && !consumed) continue
    const providerExportName = consumed ? [...sourceFunctions].find(([name, candidate]) => name !== exportName && functionHasProvider(candidate, id))?.[0] : undefined
    if (consumed && !providerExportName) unresolved.push(`No provider export found for context ${id} in ${exportName}`)
    context.push({ id, defaultFields: declaration.defaultFields, ...(provider ? { provider } : { providerExportName }) })
    unresolved.push(...(declarationErrors.get(id) ?? []))
  }
  return { context, values, bindings: contextBindings, unresolved: context.length ? unresolved : [] }
}

function functionHasProvider(fn: SourceFunction, id: string): boolean {
  let found = false
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isPropertyAccessExpression(node.tagName) && ts.isIdentifier(node.tagName.expression) && node.tagName.expression.text === id && node.tagName.name.text === "Provider") found = true
    if (!ts.isFunctionLike(node) || node === fn) ts.forEachChild(node, visit)
  }
  if (fn.body) ts.forEachChild(fn.body, visit)
  return found
}
