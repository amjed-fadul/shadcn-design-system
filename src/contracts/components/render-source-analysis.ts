import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import ts from "typescript"

import { analyzeContextRenderSource, type ContextRenderSource } from "./context-render-source-analysis"
import type { RenderAttributeValue, RenderAttributeWrite, SourceExpressionIdentity } from "./types"

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

type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression

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

type JsxAtomicRenderCondition =
  | { propName: string; equals: string | number | boolean }
  | { propName: string; truthiness: "truthy" | "falsy" }
  | { propName: string; nullishness: "nullish" | "non-nullish" }
  | { source: "state"; name: string; equals: string | number | boolean }
  | { source: "state"; name: string; truthiness: "truthy" | "falsy" }
  | { source: "state"; name: string; nullishness: "nullish" | "non-nullish" }
export type JsxRenderCondition = JsxAtomicRenderCondition | { all: [JsxRenderCondition, JsxRenderCondition, ...JsxRenderCondition[]] }
export type JsxRenderValue = { source: "literal"; value: string | number | boolean } | { source: "prop" | "state"; name: string }
type JsxDataAttribute = { name: string; value?: string; prop?: string; condition?: JsxRenderCondition; whenTrue?: JsxRenderValue; whenFalse?: JsxRenderValue; expression?: string; writes?: RenderAttributeWrite[] } & (
  | { source: "literal" | "primitive-state" }
  | { source: "prop"; prop: string }
  | { source: "derived-condition"; condition: JsxRenderCondition }
  | { source: "conditional-value"; condition: JsxRenderCondition; whenTrue: JsxRenderValue; whenFalse: JsxRenderValue }
  | { source: "ordered-writes"; writes: RenderAttributeWrite[] }
  | { source: "unresolved" }
)
export type JsxDerivedSpread = { source: "prop" | "state"; name: string }
export type JsxImportBinding = { importedName: string; localName: string; moduleSpecifier: string }
export type JsxRenderRepetition = { kind: "map"; source: "prop" | "state"; name: string }
export type JsxRenderNode = { tag: string; kind: "intrinsic" | "component" | "member" | "fragment" | "unresolved"; importBinding?: JsxImportBinding; resolvedHost?: { tag: string; kind: "intrinsic" | "component" | "member" | "unresolved"; importBinding?: JsxImportBinding }; portal: boolean; receivesPublicProps: boolean; dataAttributes: JsxDataAttribute[]; derivedSpreads: JsxDerivedSpread[]; children: Array<JsxRenderNode & { when?: JsxRenderCondition }>; when?: JsxRenderCondition; repetition?: JsxRenderRepetition }
export type JsxRenderAlternative = ({ when: JsxRenderCondition; otherwise?: never } | { otherwise: true; when?: never }) & { root: JsxRenderNode }
export type JsxSourceUnresolvedFinding = SourceExpressionIdentity & { reason: string }
export type JsxRenderTree = { root?: JsxRenderNode; alternatives?: JsxRenderAlternative[]; absent?: true; unresolved: string[]; unresolvedFindings: JsxSourceUnresolvedFinding[] }
type JsxHost = { tag: string; kind: Exclude<JsxRenderNode["kind"], "fragment">; importBinding?: JsxImportBinding }
type JsxBranch<T> = { value: T; when?: JsxRenderCondition; otherwise?: true; otherwiseFor?: JsxRenderCondition }
type JsxScope = { aliases: Map<string, JsxBranch<JsxRenderNode[]>[]>; dynamicChildren: Set<string>; hostAliases: Map<string, JsxBranch<JsxHost>[]>; derivedSpreads: Map<string, JsxDerivedSpread>; importBindings: Map<string, JsxImportBinding>; stateBindings: Set<string>; contextValues: ContextRenderSource["values"]; contextBindings: ContextRenderSource["bindings"]; contextActive: boolean }
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

function referenceCondition(name: string, publicBindings: Set<string>, condition: { equals: string | number | boolean } | { truthiness: "truthy" | "falsy" } | { nullishness: "nullish" | "non-nullish" }): JsxRenderCondition {
  return publicBindings.has(name) ? { propName: name, ...condition } : { source: "state", name, ...condition }
}

function derivedCondition(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>): JsxRenderCondition | undefined {
  if (!ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) return undefined
  const left = ts.isIdentifier(expression.left) ? expression.left.text : undefined
  const right = ts.isIdentifier(expression.right) ? expression.right.text : undefined
  const leftLiteral = literal(expression.left)
  const rightLiteral = literal(expression.right)
  if (left && rightLiteral !== undefined && rightLiteral !== null) {
    const condition = referenceCondition(left, publicBindings, { equals: rightLiteral })
    return "propName" in condition || ("source" in condition && stateBindings.has(condition.name)) ? condition : undefined
  }
  if (right && leftLiteral !== undefined && leftLiteral !== null) {
    const condition = referenceCondition(right, publicBindings, { equals: leftLiteral })
    return "propName" in condition || ("source" in condition && stateBindings.has(condition.name)) ? condition : undefined
  }
  return undefined
}

function truthinessCondition(expression: ts.Expression, publicBindings: Set<string>): JsxRenderCondition | undefined {
  if (ts.isIdentifier(expression)) return referenceCondition(expression.text, publicBindings, { truthiness: "truthy" })
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return truthinessCondition(expression.expression, publicBindings)
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = truthinessCondition(expression.operand, publicBindings)
    if (operand && !("all" in operand) && "truthiness" in operand) return { ...operand, truthiness: operand.truthiness === "truthy" ? "falsy" : "truthy" }
  }
  return undefined
}

function nullishnessCondition(expression: ts.Expression, publicBindings: Set<string>, nullishness: "nullish" | "non-nullish"): JsxRenderCondition | undefined {
  return ts.isIdentifier(expression) ? referenceCondition(expression.text, publicBindings, { nullishness }) : undefined
}

function negateCondition(condition: JsxRenderCondition): JsxRenderCondition | undefined {
  if ("all" in condition) return undefined
  if ("truthiness" in condition) return { ...condition, truthiness: condition.truthiness === "truthy" ? "falsy" : "truthy" }
  if ("nullishness" in condition) return { ...condition, nullishness: condition.nullishness === "nullish" ? "non-nullish" : "nullish" }
  if (typeof condition.equals === "boolean") return { ...condition, equals: !condition.equals }
  return undefined
}

function conditionSubject(condition: JsxAtomicRenderCondition): string {
  return "propName" in condition ? `prop:${condition.propName}` : `state:${condition.name}`
}

function atomicConditionsContradict(left: JsxAtomicRenderCondition, right: JsxAtomicRenderCondition): boolean {
  if (conditionSubject(left) !== conditionSubject(right)) return false
  if ("equals" in left && "equals" in right) return left.equals !== right.equals
  if ("truthiness" in left && "truthiness" in right) return left.truthiness !== right.truthiness
  if ("nullishness" in left && "nullishness" in right) return left.nullishness !== right.nullishness
  if ("nullishness" in left || "nullishness" in right) {
    const nullish = "nullishness" in left ? left : right as Extract<JsxAtomicRenderCondition, { nullishness: string }>
    const other = nullish === left ? right : left
    if (nullish.nullishness === "non-nullish") return false
    return "equals" in other || "truthiness" in other && other.truthiness === "truthy"
  }
  const truthiness = "truthiness" in left ? left : right as Extract<JsxAtomicRenderCondition, { truthiness: string }>
  const equals = truthiness === left ? right : left
  return "equals" in equals && (Boolean(equals.equals) !== (truthiness.truthiness === "truthy"))
}

function conjunction(left: JsxRenderCondition, right: JsxRenderCondition): JsxRenderCondition | "impossible" {
  const members = [
    ...("all" in left ? left.all : [left]),
    ...("all" in right ? right.all : [right]),
  ]
  for (let leftIndex = 0; leftIndex < members.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < members.length; rightIndex++) {
      if (atomicConditionsContradict(members[leftIndex] as JsxAtomicRenderCondition, members[rightIndex] as JsxAtomicRenderCondition)) return "impossible"
    }
  }
  const unique = members
    .filter((condition, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(condition)) === index)
  return unique.length === 1 ? unique[0] : { all: unique as [JsxRenderCondition, JsxRenderCondition, ...JsxRenderCondition[]] }
}

function booleanBranchCondition(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>): JsxRenderCondition | undefined {
  if (ts.isIdentifier(expression)) return referenceCondition(expression.text, publicBindings, { equals: true })
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(expression.operand)) return referenceCondition(expression.operand.text, publicBindings, { equals: false })
  return derivedCondition(expression, publicBindings, stateBindings)
}

function renderValue(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>): JsxRenderValue | undefined {
  const value = literal(expression)
  if (value !== undefined && value !== null) return { source: "literal", value }
  if (ts.isIdentifier(expression)) {
    if (publicBindings.has(expression.text)) return { source: "prop", name: expression.text }
    if (stateBindings.has(expression.text)) return { source: "state", name: expression.text }
  }
  return undefined
}

function recognizedTruthinessCondition(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>) {
  const condition = truthinessCondition(expression, publicBindings)
  return condition && ("propName" in condition || ("source" in condition && stateBindings.has(condition.name))) ? condition : undefined
}

function conditionalValue(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>) {
  if (!ts.isConditionalExpression(expression)) return undefined
  const condition = recognizedTruthinessCondition(expression.condition, publicBindings, stateBindings) ?? derivedCondition(expression.condition, publicBindings, stateBindings)
  const whenTrue = renderValue(expression.whenTrue, publicBindings, stateBindings)
  const whenFalse = renderValue(expression.whenFalse, publicBindings, stateBindings)
  return condition && whenTrue && whenFalse ? { condition, whenTrue, whenFalse } : undefined
}

function conditionalAttributePresence(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>) {
  if (!ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return undefined
  if (!ts.isIdentifier(expression.right) || expression.right.text !== "undefined") return undefined
  return recognizedTruthinessCondition(expression.left, publicBindings, stateBindings)
}

function deterministicStateAlias(expression: ts.Expression, publicBindings: Set<string>, stateBindings: Set<string>): boolean {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return deterministicStateAlias(expression.expression, publicBindings, stateBindings)
  if (ts.isIdentifier(expression)) return stateBindings.has(expression.text)
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    const runtimeValue = (value: ts.Expression) => ts.isIdentifier(value) && (publicBindings.has(value.text) || stateBindings.has(value.text)) || ts.isPropertyAccessExpression(value)
    return runtimeValue(expression.left) && runtimeValue(expression.right) && [expression.left, expression.right].some((value) => ts.isIdentifier(value) && stateBindings.has(value.text) || ts.isPropertyAccessExpression(value))
  }
  if (!ts.isConditionalExpression(expression)) return false
  const condition = recognizedTruthinessCondition(expression.condition, publicBindings, stateBindings) ?? derivedCondition(expression.condition, publicBindings, stateBindings)
  const safeValue = (value: ts.Expression) => literal(value) !== undefined || ts.isIdentifier(value) && (publicBindings.has(value.text) || stateBindings.has(value.text))
  return Boolean(condition) && safeValue(expression.whenTrue) && safeValue(expression.whenFalse) && [expression.whenTrue, expression.whenFalse].some(value => ts.isIdentifier(value) && stateBindings.has(value.text))
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

function directDataAttributeReference(expression: ts.Expression, file: ts.SourceFile, publicBindings: Set<string>): JsxDataAttribute | undefined {
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  let root: ts.Expression = expression
  while (ts.isPropertyAccessExpression(root)) root = root.expression
  if (!ts.isIdentifier(root)) return undefined
  const prop = expression.getText(file)
  return publicBindings.has(root.text)
    ? { name: "", source: "prop", prop }
    : { name: "", source: "primitive-state", prop }
}

function contextualAttributeValue(expression: ts.Expression | undefined, publicBindings: Set<string>, scope: JsxScope): RenderAttributeValue | undefined {
  if (!expression) return undefined
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return contextualAttributeValue(expression.expression, publicBindings, scope)
  const scalarValue = literal(expression)
  if (scalarValue !== undefined) return { source: "literal", value: scalarValue }
  if (ts.isIdentifier(expression)) {
    if (publicBindings.has(expression.text)) return { source: "prop", name: expression.text }
    return scope.contextValues.get(expression.text)
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const contextId = scope.contextBindings.get(expression.expression.text)
    if (contextId) return { source: "context-field", contextId, field: expression.name.text }
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    const first = contextualAttributeValue(expression.left, publicBindings, scope)
    const fallback = contextualAttributeValue(expression.right, publicBindings, scope)
    return first && fallback ? { source: "nullish-coalesce", first, fallback } : undefined
  }
  return undefined
}

function isAriaAttributeBag(expression: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) {
    return isAriaAttributeBag(expression.expression)
  }
  if (ts.isConditionalExpression(expression)) return isAriaAttributeBag(expression.whenTrue) && isAriaAttributeBag(expression.whenFalse)
  if (!ts.isObjectLiteralExpression(expression)) return false
  return expression.properties.every((property) => {
    if (!ts.isPropertyAssignment(property)) return false
    const name = property.name
    const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined
    return text?.startsWith("aria-") === true
  })
}

function jsxAttributes(attributes: ts.JsxAttributes, file: ts.SourceFile, publicBindings: Set<string>, unresolved: JsxUnresolved, scope: JsxScope) {
  let receivesPublicProps = false
  const dataAttributes: JsxRenderNode["dataAttributes"] = []
  const derivedSpreads: JsxDerivedSpread[] = []
  if (scope.contextActive) {
    const names = [...new Set(attributes.properties.filter((property): property is ts.JsxAttribute & { name: ts.Identifier } => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text.startsWith("data-")).map((property) => property.name.text))]
    const writes = new Map(names.map((name) => [name, [] as RenderAttributeWrite[]]))
    for (const property of attributes.properties) {
      if (ts.isJsxSpreadAttribute(property)) {
        if (ts.isIdentifier(property.expression) && publicBindings.has(property.expression.text)) {
          receivesPublicProps = true
          for (const chain of writes.values()) chain.push({ kind: "public-props-spread" })
        } else if (ts.isIdentifier(property.expression) && scope.derivedSpreads.has(property.expression.text)) derivedSpreads.push(scope.derivedSpreads.get(property.expression.text)!)
        else if (!isAriaAttributeBag(property.expression)) recordUnresolved(unresolved, property.expression, file, `Unsupported spread provenance: ${property.expression.getText(file)}`)
        continue
      }
      if (!ts.isJsxAttribute(property) || !ts.isIdentifier(property.name) || !property.name.text.startsWith("data-")) continue
      const expression = property.initializer && ts.isJsxExpression(property.initializer) ? property.initializer.expression : undefined
      const value = property.initializer && ts.isStringLiteral(property.initializer)
        ? { source: "literal", value: property.initializer.text } as const
        : contextualAttributeValue(expression, publicBindings, scope)
      if (!value) recordUnresolved(unresolved, expression ?? property, file, `Unsupported contextual data attribute: ${property.name.text}`)
      else writes.get(property.name.text)!.push({ kind: "value", value })
    }
    for (const name of names) dataAttributes.push({ name, source: "ordered-writes", writes: writes.get(name)! })
    return { receivesPublicProps, dataAttributes, derivedSpreads }
  }
  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      if (ts.isIdentifier(property.expression) && publicBindings.has(property.expression.text)) receivesPublicProps = true
      else if (ts.isIdentifier(property.expression) && scope.derivedSpreads.has(property.expression.text)) derivedSpreads.push(scope.derivedSpreads.get(property.expression.text)!)
      else if (!isAriaAttributeBag(property.expression)) recordUnresolved(unresolved, property.expression, file, `Unsupported spread provenance: ${property.expression.getText(file)}`)
    }
    if (ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text.startsWith("data-")) {
      if (property.initializer && ts.isStringLiteral(property.initializer)) {
        dataAttributes.push({ name: property.name.text, source: "literal", value: property.initializer.text })
        continue
      }
      const expression = property.initializer && ts.isJsxExpression(property.initializer) ? property.initializer.expression : undefined
      if (expression && ts.isIdentifier(expression)) {
        if (publicBindings.has(expression.text)) dataAttributes.push({ name: property.name.text, source: "prop", prop: expression.text })
        else if (scope.stateBindings.has(expression.text)) dataAttributes.push({ name: property.name.text, source: "primitive-state", prop: expression.text })
        else {
          recordUnresolved(unresolved, expression, file, `Dynamic data attribute ${property.name.text}: ${expression.text}`)
          dataAttributes.push({ name: property.name.text, source: "unresolved", expression: expression.text })
        }
        continue
      }
      const propertyReference = expression && directDataAttributeReference(expression, file, publicBindings)
      if (propertyReference) {
        dataAttributes.push({ ...propertyReference, name: property.name.text })
        continue
      }
      const values = expression && conditionalValue(expression, publicBindings, scope.stateBindings)
      if (values) {
        dataAttributes.push({ name: property.name.text, source: "conditional-value", ...values })
        continue
      }
      const condition = expression && (derivedCondition(expression, publicBindings, scope.stateBindings) ?? truthinessCondition(expression, publicBindings))
      if (condition) {
        dataAttributes.push({ name: property.name.text, source: "derived-condition", condition })
        continue
      }
      const presenceCondition = property.name.text === "data-mobile" && expression && conditionalAttributePresence(expression, publicBindings, scope.stateBindings)
      if (presenceCondition) {
        dataAttributes.push({ name: property.name.text, source: "derived-condition", condition: presenceCondition })
        continue
      }
      const expressionText = expression?.getText(file)
      recordUnresolved(unresolved, expression ?? property, file, `Dynamic data attribute ${property.name.text}: ${expressionText ?? "true"}`)
      dataAttributes.push({ name: property.name.text, source: "unresolved", ...(expressionText ? { expression: expressionText } : {}) })
    }
  }
  return { receivesPublicProps, dataAttributes, derivedSpreads }
}

type JsxBranchMarker = { when?: JsxRenderCondition; otherwise?: true; otherwiseFor?: JsxRenderCondition }

function branchMarker<T>(branch: JsxBranch<T>): JsxBranchMarker {
  if (branch.when) return { when: branch.when }
  if (branch.otherwise) return { otherwise: true, ...(branch.otherwiseFor ? { otherwiseFor: branch.otherwiseFor } : {}) }
  return {}
}

function branch<T>(value: T, marker: JsxBranchMarker = {}): JsxBranch<T> {
  return { ...marker, value } as JsxBranch<T>
}

function mergeBranchMarkers(left: JsxBranchMarker, right: JsxBranchMarker): JsxBranchMarker | "impossible" | undefined {
  const leftKey = left.when ? `when:${JSON.stringify(left.when)}` : left.otherwise ? "otherwise" : ""
  const rightKey = right.when ? `when:${JSON.stringify(right.when)}` : right.otherwise ? "otherwise" : ""
  if (!leftKey) return right
  if (!rightKey) return left
  if (leftKey === rightKey && JSON.stringify(left.otherwiseFor ?? null) === JSON.stringify(right.otherwiseFor ?? null)) return left
  const leftCondition = left.when ?? (left.otherwiseFor ? negateCondition(left.otherwiseFor) : undefined)
  const rightCondition = right.when ?? (right.otherwiseFor ? negateCondition(right.otherwiseFor) : undefined)
  if (!leftCondition || !rightCondition) return undefined
  const condition = conjunction(leftCondition, rightCondition)
  return condition === "impossible" ? "impossible" : { when: condition }
}

function directAliasHost(expression: ts.Expression, file: ts.SourceFile, scope: JsxScope): JsxHost | undefined {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return directAliasHost(expression.expression, file, scope)
  if (ts.isStringLiteral(expression)) return { tag: expression.text, kind: "intrinsic" }
  if (ts.isIdentifier(expression)) {
    const importBinding = scope.importBindings.get(expression.text)
    return { tag: expression.text, kind: /^[a-z]/.test(expression.text) ? "intrinsic" : "component", ...(importBinding ? { importBinding } : {}) }
  }
  if (ts.isPropertyAccessExpression(expression)) {
    let root: ts.Expression = expression
    while (ts.isPropertyAccessExpression(root)) root = root.expression
    const importBinding = ts.isIdentifier(root) ? scope.importBindings.get(root.text) : undefined
    return { tag: expression.getText(file), kind: "member", ...(importBinding ? { importBinding } : {}) }
  }
  return undefined
}

function aliasHostBranches(expression: ts.Expression, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxBranch<JsxHost>[] | undefined {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return aliasHostBranches(expression.expression, file, unresolved, publicBindings, scope)
  if (ts.isConditionalExpression(expression)) {
    const condition = booleanBranchCondition(expression.condition, publicBindings, scope.stateBindings)
    const whenTrue = aliasHostBranches(expression.whenTrue, file, unresolved, publicBindings, scope)
    const whenFalse = aliasHostBranches(expression.whenFalse, file, unresolved, publicBindings, scope)
    if (!condition || !whenTrue?.length || !whenFalse?.length || whenTrue.some((item) => item.when || item.otherwise) || whenFalse.some((item) => item.when || item.otherwise)) {
      recordUnresolved(unresolved, expression, file, `Unsupported conditional JSX host alias: ${expression.getText(file)}`)
      return undefined
    }
    return [
      ...whenTrue.map((item) => branch(item.value, { when: condition })),
      ...whenFalse.map((item) => branch(item.value, { otherwise: true, otherwiseFor: condition })),
    ]
  }
  const host = directAliasHost(expression, file, scope)
  return host ? [branch(host)] : undefined
}

function mappedJsxChildren(expression: ts.CallExpression, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxRenderNode[] | undefined {
  if (!ts.isPropertyAccessExpression(expression.expression) || expression.expression.name.text !== "map") return undefined
  const callback = expression.arguments[0]
  if (!callback || !ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
    recordUnresolved(unresolved, expression, file, `Mapped JSX requires an inline callback: ${expression.getText(file)}`)
    return []
  }
  const collection = expression.expression.expression
  if (!ts.isIdentifier(collection)) {
    recordUnresolved(unresolved, collection, file, `Mapped JSX collection provenance is unsupported: ${collection.getText(file)}`)
    return []
  }
  const repetition: JsxRenderRepetition = { kind: "map", source: publicBindings.has(collection.text) ? "prop" : "state", name: collection.text }
  const returned = ts.isBlock(callback.body) ? returnedJsx(callback, file, publicBindings, scope.stateBindings, unresolved) : [{ expression: callback.body }]
  const nodes: JsxRenderNode[] = []
  for (const result of returned) {
    if (!result.expression) continue
    for (const candidate of jsxExpressionBranches(result.expression, file, unresolved, publicBindings, scope)) {
      const marker = mergeBranchMarkers({ ...(result.when ? { when: result.when } : {}), ...(result.otherwise ? { otherwise: true as const } : {}) }, branchMarker(candidate))
      if (marker === "impossible") continue
      if (!marker) {
        recordUnresolved(unresolved, result.expression, file, `Mapped JSX callback has compound branch predicates: ${result.expression.getText(file)}`)
        continue
      }
      if (marker.otherwise) recordUnresolved(unresolved, result.expression, file, `Mapped JSX callback otherwise branch cannot be represented as a repeated child predicate: ${result.expression.getText(file)}`)
      for (const node of candidate.value) nodes.push({ ...node, repetition, ...(marker.when ? { when: marker.when } : {}) })
    }
  }
  return nodes
}

function jsxExpressionBranches(expression: ts.Expression | undefined, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxBranch<JsxRenderNode[]>[] {
  if (!expression || expression.kind === ts.SyntaxKind.NullKeyword) return [branch([])]
  if (ts.isIdentifier(expression) && expression.text === "children") return [branch([])]
  if (ts.isIdentifier(expression) && scope.aliases.has(expression.text)) return structuredClone(scope.aliases.get(expression.text)!)
  // A useMemo-derived child is runtime data; its callback may return text, JSX, or null.
  // Keep the opaque branch structurally valid without inventing a false unsupported-expression finding.
  if (ts.isIdentifier(expression) && scope.dynamicChildren.has(expression.text)) return [branch([])]
  if (ts.isIdentifier(expression) && publicBindings.has(expression.text)) return [branch([])]
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return jsxExpressionBranches(expression.expression, file, unresolved, publicBindings, scope)
  if (ts.isConditionalExpression(expression)) {
    const condition = booleanBranchCondition(expression.condition, publicBindings, scope.stateBindings)
    if (!condition) {
      recordUnresolved(unresolved, expression.condition, file, `Conditional JSX child has unsupported predicate: ${expression.condition.getText(file)}`)
      return [branch([
        ...jsxExpressionBranches(expression.whenTrue, file, unresolved, publicBindings, scope).flatMap((item) => item.value),
        ...jsxExpressionBranches(expression.whenFalse, file, unresolved, publicBindings, scope).flatMap((item) => item.value),
      ])]
    }
    const apply = (items: JsxBranch<JsxRenderNode[]>[], marker: JsxBranchMarker) => items.flatMap((item) => {
      const merged = mergeBranchMarkers(marker, branchMarker(item))
      if (merged === "impossible") return []
      if (merged) return [branch(item.value, merged)]
      recordUnresolved(unresolved, expression, file, `Conditional JSX child has compound predicates: ${expression.getText(file)}`)
      return []
    })
    return [
      ...apply(jsxExpressionBranches(expression.whenTrue, file, unresolved, publicBindings, scope), { when: condition }),
      ...apply(jsxExpressionBranches(expression.whenFalse, file, unresolved, publicBindings, scope), { otherwise: true, otherwiseFor: condition }),
    ]
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    const nonNullish = nullishnessCondition(expression.left, publicBindings, "non-nullish")
    const nullish = nullishnessCondition(expression.left, publicBindings, "nullish")
    if (!nonNullish || !nullish) {
      recordUnresolved(unresolved, expression.left, file, `Nullish JSX child has unsupported predicate: ${expression.left.getText(file)}`)
      return [branch(jsxExpressionBranches(expression.right, file, unresolved, publicBindings, scope).flatMap((item) => item.value))]
    }
    const fallback = jsxExpressionBranches(expression.right, file, unresolved, publicBindings, scope)
    if (fallback.some((item) => item.when || item.otherwise)) {
      recordUnresolved(unresolved, expression.right, file, `Nullish JSX fallback has compound predicates: ${expression.right.getText(file)}`)
      return []
    }
    return [branch([], { when: nonNullish }), ...fallback.map((item) => branch(item.value, { when: nullish }))]
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    if (ts.isIdentifier(expression.left)) {
      const propName = expression.left.text
      const condition = publicBindings.has(propName)
        ? propName === "children"
          ? { propName, truthiness: "truthy" } as const
          : { propName, equals: true } as const
        : { source: "state", name: propName, truthiness: "truthy" } as const
      return jsxExpressionBranches(expression.right, file, unresolved, publicBindings, scope).map((item) => branch(item.value.flatMap((node) => {
        const when = node.when ? conjunction(condition, node.when) : condition
        return when === "impossible" ? [] : [{ ...node, when }]
      }), branchMarker(item)))
    }
    recordUnresolved(unresolved, expression.left, file, `Conditional JSX child cannot establish automatic structure: ${expression.left.getText(file)}`)
    return [branch(jsxExpressionBranches(expression.right, file, unresolved, publicBindings, scope).flatMap((item) => item.value))]
  }
  if (ts.isCallExpression(expression)) {
    const mapped = mappedJsxChildren(expression, file, unresolved, publicBindings, scope)
    if (mapped) return [branch(mapped)]
  }
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return jsxNodeBranches(expression, file, unresolved, publicBindings, scope).map((item) => branch([item.value], branchMarker(item)))
  recordUnresolved(unresolved, expression, file, `Unsupported JSX child expression: ${expression.getText(file)}`)
  return [branch([])]
}

function jsxChildrenBranches(children: readonly ts.JsxChild[], file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxBranch<JsxRenderNode[]>[] {
  let results: JsxBranch<JsxRenderNode[]>[] = [branch([])]
  for (const child of children) {
    const candidates = ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)
      ? jsxNodeBranches(child, file, unresolved, publicBindings, scope).map((item) => branch([item.value], branchMarker(item)))
      : ts.isJsxExpression(child) ? jsxExpressionBranches(child.expression, file, unresolved, publicBindings, scope) : [branch([])]
    const next: JsxBranch<JsxRenderNode[]>[] = []
    for (const result of results) for (const candidate of candidates) {
      const marker = mergeBranchMarkers(branchMarker(result), branchMarker(candidate))
      if (marker === "impossible") continue
      if (marker) next.push(branch([...result.value, ...candidate.value], marker))
      else recordUnresolved(unresolved, child, file, `JSX children have independent branch predicates: ${child.getText(file)}`)
    }
    results = next
  }
  return results
}

function jsxNodeBranches(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, file: ts.SourceFile, unresolved: JsxUnresolved, publicBindings: Set<string>, scope: JsxScope): JsxBranch<JsxRenderNode>[] {
  if (ts.isJsxFragment(node)) return jsxChildrenBranches(node.children, file, unresolved, publicBindings, scope).map((children) => branch({ tag: "Fragment", kind: "fragment", portal: false, receivesPublicProps: false, dataAttributes: [], derivedSpreads: [], children: children.value }, branchMarker(children)))
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  const name = jsxTagName(opening.tagName, file)
  if (name.kind === "unresolved") recordUnresolved(unresolved, opening.tagName, file, `Unsupported JSX tag: ${name.tag}`)
  let importedRoot: ts.Node = opening.tagName
  while (ts.isPropertyAccessExpression(importedRoot)) importedRoot = importedRoot.expression
  const importBinding = ts.isIdentifier(importedRoot) ? scope.importBindings.get(importedRoot.text) : undefined
  const hosts = ts.isIdentifier(opening.tagName) && scope.hostAliases.has(opening.tagName.text)
    ? scope.hostAliases.get(opening.tagName.text)!
    : [branch<JsxHost | undefined>(undefined)]
  const children = ts.isJsxElement(node) ? jsxChildrenBranches(node.children, file, unresolved, publicBindings, scope) : [branch([])]
  const attributes = jsxAttributes(opening.attributes, file, publicBindings, unresolved, scope)
  const results: JsxBranch<JsxRenderNode>[] = []
  for (const host of hosts) for (const child of children) {
    const marker = mergeBranchMarkers(branchMarker(host), branchMarker(child))
    if (marker === "impossible") continue
    if (!marker) {
      recordUnresolved(unresolved, node, file, `JSX host and children have independent branch predicates: ${node.getText(file)}`)
      continue
    }
    const resolvedHost = host.value
    const effectiveTag = resolvedHost?.tag ?? name.tag
    results.push(branch({
      ...name,
      ...(importBinding ? { importBinding } : {}),
      ...(resolvedHost ? { resolvedHost } : {}),
      portal: effectiveTag === "Portal" || effectiveTag.endsWith(".Portal") || effectiveTag.endsWith("Portal"),
      ...attributes,
      children: child.value,
    }, marker))
  }
  return results
}

type ReturnedJsx = { expression?: ts.Expression; absent?: true; when?: JsxRenderCondition; otherwise?: true }

function directReturns(statement: ts.Statement, condition: JsxRenderCondition | undefined, results: ReturnedJsx[]) {
  if (ts.isReturnStatement(statement) && statement.expression?.kind === ts.SyntaxKind.NullKeyword && condition) results.push({ absent: true, when: condition })
  else if (ts.isReturnStatement(statement) && statement.expression) results.push({ expression: statement.expression, ...(condition ? { when: condition } : {}) })
  else if (ts.isBlock(statement)) for (const child of statement.statements) directReturns(child, condition, results)
}

function returnedJsx(functionDeclaration: SourceFunction, file: ts.SourceFile, publicBindings: Set<string>, stateBindings: Set<string>, unresolved: JsxUnresolved): ReturnedJsx[] {
  const results: ReturnedJsx[] = []
  let hasUnsupportedReturnCondition = false
  if (ts.isArrowFunction(functionDeclaration) && !ts.isBlock(functionDeclaration.body)) return [{ expression: functionDeclaration.body }]
  if (!functionDeclaration.body || !ts.isBlock(functionDeclaration.body)) return results
  for (const statement of functionDeclaration.body.statements) {
    if (ts.isIfStatement(statement)) {
      const condition = recognizedTruthinessCondition(statement.expression, publicBindings, stateBindings) ?? derivedCondition(statement.expression, publicBindings, stateBindings)
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
  if (results.length === 2 && results[0].absent && results[0].when && "truthiness" in results[0].when && !results[1].when) results[1].when = { ...results[0].when, truthiness: results[0].when.truthiness === "truthy" ? "falsy" : "truthy" }
  const rendered = results.filter((result): result is ReturnedJsx & { expression: ts.Expression } => Boolean(result.expression))
  if (rendered.length === 2 && rendered[0].when && "truthiness" in rendered[0].when && !rendered[1].when) rendered[1].when = { ...rendered[0].when, truthiness: rendered[0].when.truthiness === "truthy" ? "falsy" : "truthy" }
  if (rendered.length > 1) for (const result of rendered) if (!result.when) result.otherwise = true
  if (results.some((result) => result.absent) && rendered.length === 1) rendered[0].absent = true
  return rendered
}

function aliases(functionDeclaration: SourceFunction, file: ts.SourceFile, publicBindings: Set<string>, unresolved: JsxUnresolved, conventions: RenderSourceAnalysisConventions, contextSource: ContextRenderSource) {
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
  const scope: JsxScope = { aliases: new Map(), dynamicChildren: new Set(), hostAliases: new Map(), derivedSpreads: new Map(), importBindings, stateBindings: new Set(), contextValues: contextSource.values, contextBindings: contextSource.bindings, contextActive: contextSource.context.length > 0 && contextSource.unresolved.length === 0 }
  const recognizedStateBinding = (declaration: ts.VariableDeclaration) => {
    if (!ts.isObjectBindingPattern(declaration.name) || !declaration.initializer || !conventions.isStateBinding?.(declaration.initializer)) return
    for (const element of declaration.name.elements) if (ts.isIdentifier(element.name)) scope.stateBindings.add(element.name.text)
  }
  const jsxHostAliases = new Set<string>()
  const collectHostAliases = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) jsxHostAliases.add(node.tagName.text)
    if (!ts.isFunctionLike(node) || node === functionDeclaration) ts.forEachChild(node, collectHostAliases)
  }
  if (functionDeclaration.body) ts.forEachChild(functionDeclaration.body, collectHostAliases)
  const containsJsx = (expression: ts.Expression): boolean => {
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return true
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return containsJsx(expression.expression)
    return ts.isConditionalExpression(expression) && (containsJsx(expression.whenTrue) || containsJsx(expression.whenFalse))
  }
  const canBeHost = (expression: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return canBeHost(expression.expression)
    if (ts.isConditionalExpression(expression)) return canBeHost(expression.whenTrue) && canBeHost(expression.whenFalse)
    return ts.isStringLiteral(expression) || ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)
  }
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (deterministicStateAlias(node.initializer, publicBindings, scope.stateBindings)) scope.stateBindings.add(node.name.text)
      if (containsJsx(node.initializer)) scope.aliases.set(node.name.text, jsxExpressionBranches(node.initializer, file, unresolved, publicBindings, scope))
      else if (ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && importBindings.get(node.initializer.expression.text)?.importedName === "useMemo") {
        scope.dynamicChildren.add(node.name.text)
        scope.stateBindings.add(node.name.text)
      }
      else if (jsxHostAliases.has(node.name.text) && canBeHost(node.initializer)) {
        const hosts = aliasHostBranches(node.initializer, file, unresolved, publicBindings, scope)
        if (hosts) scope.hostAliases.set(node.name.text, hosts)
      }
      const spread = tracedPropSpread(node.initializer, publicBindings)
      if (spread) scope.derivedSpreads.set(node.name.text, spread)
    } else if (ts.isVariableDeclaration(node)) recognizedStateBinding(node)
    if (!ts.isFunctionLike(node) || node === functionDeclaration) ts.forEachChild(node, visit)
  }
  if (functionDeclaration.body) ts.forEachChild(functionDeclaration.body, visit)
  return scope
}

export function analyzeJsxRenderTree(sourcePath: string, exportName: string, conventions: RenderSourceAnalysisConventions = {}): JsxRenderTree {
  const file = sourceFile(sourcePath)
  const declaration = findSourceFunction(sourcePath, exportName)
  const unresolved: JsxUnresolved = { messages: [], findings: [] }
  if (!declaration) {
    recordUnresolved(unresolved, file, file, `No returned JSX found for ${exportName}`)
    return { unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  }
  const bindings = publicPropBindings(declaration)
  const contextSource = analyzeContextRenderSource(sourcePath, exportName)
  // Existing components with richer context programs retain their established
  // render facts. A contract that opts into context facts is checked separately
  // by canonical reconciliation and cannot silently claim an unsupported form.
  const scope = aliases(declaration, file, bindings, unresolved, conventions, contextSource)
  const returned = returnedJsx(declaration, file, bindings, scope.stateBindings, unresolved)
  const expressions = returned.filter((item): item is ReturnedJsx & { expression: ts.Expression } => Boolean(item.expression))
  if (!expressions.length) {
    recordUnresolved(unresolved, declaration, file, `No returned JSX found for ${exportName}`)
    return { unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  }
  const roots: Array<{ root: JsxRenderNode; when?: JsxRenderCondition; otherwise?: true }> = []
  for (const expression of expressions) {
    const outer = { ...(expression.when ? { when: expression.when } : {}), ...(expression.otherwise ? { otherwise: true as const } : {}) }
    const candidates = jsxExpressionBranches(expression.expression, file, unresolved, bindings, scope)
    for (const candidate of candidates) {
      const marker = mergeBranchMarkers(outer, branchMarker(candidate))
      if (marker === "impossible") continue
      if (!marker) {
        recordUnresolved(unresolved, expression.expression, file, `Returned JSX has compound branch predicates: ${expression.expression.getText(file)}`)
        continue
      }
      const publicMarker = marker.when ? { when: marker.when } : marker.otherwise ? { otherwise: true as const } : {}
      for (const root of candidate.value) roots.push({ root, ...publicMarker })
    }
  }
  if (!roots.length) recordUnresolved(unresolved, declaration, file, `No JSX root found for ${exportName}`)
  const hasNullReturn = returned.some((item) => item.absent || item.expression?.kind === ts.SyntaxKind.NullKeyword)
  const nullReturnIsOptionalMemoContent = hasNullReturn && expressions.every(({ when }) => when && "source" in when && scope.dynamicChildren.has(when.name))
  const absence = conventions.retainAbsence && hasNullReturn ? { absent: true as const } : {}
  if (roots.length === 1 && (!roots[0].when && !roots[0].otherwise || nullReturnIsOptionalMemoContent)) return { root: roots[0].root, ...absence, unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
  return { alternatives: roots.map(({ when, otherwise, root }) => when ? { when, root } : { otherwise: otherwise ?? true, root }), ...absence, unresolved: unresolved.messages, unresolvedFindings: unresolved.findings }
}

type ContractRenderNode = {
  id: string
  host: { kind: string; tag?: string; interfaceId?: string; familyId?: string; exportName?: string }
  receivesPublicProps: boolean
  dataAttributes: Array<{ name: string; source: string; value?: string; prop?: string; condition?: JsxRenderCondition; whenTrue?: unknown; whenFalse?: unknown; writes?: RenderAttributeWrite[] }>
  derivedSpreads?: Array<{ source: string; name: string }>
  children: Array<{
    nodeId: string
    when?: JsxRenderCondition
    repeat?: { collectionId: string; count: "collection-length" | "matching-items"; itemWhen?: { op: "truthy"; itemProperty: string } }
  }>
}
type ContractRenderingTree = { rootNodeId: string; publicPropsTargetNodeId: string; nodes: ContractRenderNode[]; portalBoundaries: Array<{ nodeId: string }> }
type ContractRendering = ContractRenderingTree | { alternatives: Array<({ when: JsxRenderCondition; otherwise?: never } | { otherwise: true; when?: never }) & { rendering: ContractRenderingTree }> }

export type RenderSourceAnalysisConventions = Readonly<{
  isStateBinding?: (initializer: ts.Expression) => boolean
  normalizeRenderName?: (name: string) => string
  matchesInheritedInterface?: (sourceTag: string, interfaceId: string, normalizeRenderName: (name: string) => string, importBinding?: JsxRenderNode["importBinding"]) => boolean
  matchesCrossFamilySource?: (moduleSpecifier: string, familyId: string) => boolean
  includeUnresolved?: boolean
  compareRepetition?: boolean
  retainAbsence?: boolean
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
    return conventions.matchesInheritedInterface?.(resolved.tag, interfaceId, normalizeRenderName, resolved.importBinding ?? source.importBinding) ?? normalizeRenderName(resolved.tag).endsWith(normalizeRenderName(interfaceId))
  }
  return host.kind === "unresolved" && (source.kind === "component" || source.kind === "member" || source.kind === "unresolved" || Boolean(source.resolvedHost))
}

function sameDataAttributes(expected: ContractRenderNode["dataAttributes"], actual: JsxRenderNode["dataAttributes"]) {
  return expected.length === actual.length && expected.every((attribute, index) => {
    const candidate = actual[index]
    return attribute.name === candidate?.name && attribute.source === candidate?.source && attribute.value === candidate?.value && attribute.prop === candidate?.prop && JSON.stringify(attribute.condition ?? null) === JSON.stringify(candidate?.condition ?? null) && JSON.stringify(attribute.source === "conditional-value" ? attribute.whenTrue : null) === JSON.stringify(candidate?.source === "conditional-value" ? candidate.whenTrue : null) && JSON.stringify(attribute.source === "conditional-value" ? attribute.whenFalse : null) === JSON.stringify(candidate?.source === "conditional-value" ? candidate.whenFalse : null) && JSON.stringify(attribute.source === "ordered-writes" ? attribute.writes : null) === JSON.stringify(candidate?.source === "ordered-writes" ? candidate.writes : null)
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
      if (expectedChild.repeat && expectedChild.repeat.collectionId !== actualChild.repetition?.name) errors.push(`Repeated render edge provenance mismatch at ${path}>${actualChild.tag}.`)
      if (conventions.compareRepetition && Boolean(expectedChild.repeat) !== Boolean(actualChild.repetition)) errors.push(`Repeated render edge mismatch at ${path}>${actualChild.tag}.`)
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
  if (source.alternatives) {
    return [...errors, "Source has render alternatives but contract has a single render tree."]
  }
  if (!source.root) return [...errors, "Source has no render root."]
  compareTree(rendering, source.root)
  return errors
}
