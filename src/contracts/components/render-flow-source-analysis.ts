import { readFileSync } from "node:fs"
import ts from "typescript"

import { analyzeJsxRenderTree, compareJsxRenderTree, type JsxRenderNode, type RenderSourceAnalysisConventions } from "./render-source-analysis"
import type { RenderingFlow, RenderFlowGuard, RenderFlowGuardSource, RenderingTree } from "./types"

type Flow = Omit<RenderingFlow, "collections" | "branches"> & {
  collections: Array<{ id: string; choices: Array<{ when?: RenderFlowGuard; source: { kind: "prop" | "singleton-prop"; propName: string } }>; uniqueBy?: { itemProperty: string; optionalItem: boolean; retention: "last-value-first-key-order" } }>
  branches: Array<{ when?: RenderFlowGuard; otherwise?: true; outcome: { kind: "absent" } | { kind: "rendered"; root: JsxRenderNode; content?: { source: "prop"; propName: string } | { source: "collection-item-property"; collectionId: string; itemProperty: string; optionalItem: boolean; index: 0 }; repeats?: Array<{ collectionId: string; count: "collection-length" | "matching-items"; itemWhen?: { op: "truthy"; itemProperty: string; optionalItem: boolean } }> } }>
}

export type RenderFlowSourceResult = { flow?: Flow; errors: string[] }

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) expression = expression.expression
  return expression
}
function identifier(expression: ts.Expression | undefined): string | undefined { const node = expression && unwrap(expression); return node && ts.isIdentifier(node) ? node.text : undefined }
function property(expression: ts.Expression | undefined, propertyName: string): ts.Expression | undefined {
  const node = expression && unwrap(expression)
  return node && (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) && node.name.text === propertyName ? node.expression : undefined
}
function propertyPath(expression: ts.Expression | undefined): { base: string; propertyName: string } | undefined {
  const node = expression && unwrap(expression)
  if (!node || !ts.isPropertyAccessExpression(node) && !ts.isPropertyAccessChain(node)) return undefined
  const base = identifier(node.expression)
  return base ? { base, propertyName: node.name.text } : undefined
}
function isNull(expression: ts.Expression | undefined) { return expression && unwrap(expression).kind === ts.SyntaxKind.NullKeyword }
function meaningfulChildren(element: ts.JsxElement) { return element.children.filter((child) => !ts.isJsxText(child) || child.getText().trim().length > 0) }
function onlyNonstructuralAttributes(element: ts.JsxElement, permitted: readonly string[]) {
  return element.openingElement.attributes.properties.every((attribute) => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && permitted.includes(attribute.name.text))
}
function isReactMemoCallee(callee: ts.LeftHandSideExpression, file: ts.SourceFile): boolean {
  if (ts.isIdentifier(callee)) return file.statements.some((statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "react" && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some((binding) => binding.name.text === callee.text && (binding.propertyName?.text ?? binding.name.text) === "useMemo"))
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === "useMemo" && ts.isIdentifier(callee.expression)) return file.statements.some((statement) => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "react" && (statement.importClause?.name?.text === callee.expression.getText(file) || statement.importClause?.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings) && statement.importClause.namedBindings.name.text === callee.expression.getText(file)))
  return false
}
function memoBody(initializer: ts.Expression, file: ts.SourceFile): ts.ConciseBody | undefined {
  const call = unwrap(initializer)
  if (!ts.isCallExpression(call) || call.arguments.length !== 2) return
  if (!isReactMemoCallee(call.expression, file)) return
  const callback = call.arguments[0]
  return ts.isArrowFunction(callback) || ts.isFunctionExpression(callback) ? callback.body : undefined
}
function memoDependencies(initializer: ts.Expression): string[] | undefined {
  const call = unwrap(initializer)
  if (!ts.isCallExpression(call) || call.arguments.length !== 2 || !ts.isArrayLiteralExpression(call.arguments[1])) return
  const names = call.arguments[1].elements.map((element) => identifier(element))
  return names.every((name): name is string => Boolean(name)) ? names : undefined
}
function sameNames(left: readonly string[] | undefined, right: readonly string[]) { return Boolean(left && left.length === right.length && left.every((name, index) => name === right[index])) }
function declarations(block: ts.Block) {
  const result = new Map<string, ts.Expression>()
  for (const statement of block.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer) result.set(declaration.name.text, declaration.initializer)
  }
  return result
}
function exportedFunction(file: ts.SourceFile, exportName: string): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName) return statement
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) {
      let result: ts.ArrowFunction | ts.FunctionExpression | undefined
      const visit = (node: ts.Node) => { if (result) return; if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) result = node; else ts.forEachChild(node, visit) }
      visit(declaration.initializer)
      return result
    }
  }
}
function publicProps(fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression): Set<string> {
  const result = new Set<string>()
  const parameter = fn.parameters[0]
  if (parameter && ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (ts.isIdentifier(element.name)) result.add(element.name.text)
  return result
}
function shadowsBuiltins(file: ts.SourceFile, fn: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression): boolean {
  const forbidden = new Set(["Array", "Map"])
  let shadowed = false
  const visit = (node: ts.Node) => {
    if (shadowed) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && forbidden.has(node.name.text)) shadowed = true
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name && forbidden.has(node.name.text)) shadowed = true
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && forbidden.has(node.name.text)) shadowed = true
    ts.forEachChild(node, visit)
  }
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.name && forbidden.has(clause.name.text)) shadowed = true
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some((binding) => forbidden.has(binding.name.text))) shadowed = true
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings) && forbidden.has(clause.namedBindings.name.text)) shadowed = true
    } else if (statement !== fn) visit(statement)
  }
  visit(fn)
  return shadowed
}
function guard(expression: ts.Expression, props: Set<string>, collectionNames: Set<string>): RenderFlowGuard | undefined {
  const node = unwrap(expression)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = guard(node.operand, props, collectionNames)
    return inner && "op" in inner && (inner.op === "truthy" || inner.op === "falsy") ? { ...inner, op: inner.op === "truthy" ? "falsy" : "truthy" } : undefined
  }
  if (ts.isIdentifier(node) && props.has(node.text)) return { op: "truthy", source: { kind: "prop", propName: node.text } }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && identifier(node.expression.expression) === "Array" && node.expression.name.text === "isArray" && node.arguments.length === 1) {
    const name = identifier(node.arguments[0]); return name && props.has(name) ? { op: "array", source: { kind: "prop", propName: name } } : undefined
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const left = guard(node.left, props, collectionNames); const right = guard(node.right, props, collectionNames)
    return left && right ? { all: [left, right] } : undefined
  }
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.GreaterThanToken)) {
    const left = unwrap(node.left); const right = unwrap(node.right)
    const value = ts.isNumericLiteral(right) ? Number(right.text) : undefined
    if (value === undefined) return
    const lengthBase = property(left, "length")
    const collection = identifier(lengthBase)
    if (collection && collectionNames.has(collection)) return { op: node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ? "length-eq" : "length-gt", source: { kind: "collection", collectionId: collection }, value }
  }
  return undefined
}
function collectionChoices(expression: ts.Expression, props: Set<string>): Flow["collections"][number]["choices"] | undefined {
  const result: Flow["collections"][number]["choices"] = []
  let node = unwrap(expression)
  while (ts.isConditionalExpression(node)) {
    const when = guard(node.condition, props, new Set())
    const name = identifier(node.whenTrue)
    if (!when || !name || !props.has(name)) return
    result.push({ when, source: { kind: "prop", propName: name } })
    node = unwrap(node.whenFalse)
  }
  if (!ts.isArrayLiteralExpression(node) || node.elements.length !== 1) return
  const fallback = identifier(node.elements[0])
  if (!fallback || !props.has(fallback)) return
  result.push({ source: { kind: "singleton-prop", propName: fallback } })
  return result
}
function dedupCollection(expression: ts.Expression): { input: string; itemProperty: string; optionalItem: boolean } | undefined {
  const node = unwrap(expression)
  if (!ts.isArrayLiteralExpression(node) || node.elements.length !== 1 || !ts.isSpreadElement(node.elements[0])) return
  const values = unwrap(node.elements[0].expression)
  if (!ts.isCallExpression(values) || values.arguments.length !== 0 || !property(values.expression, "values")) return
  const map = unwrap(property(values.expression, "values")!)
  if (!ts.isNewExpression(map) || identifier(map.expression) !== "Map" || map.arguments?.length !== 1) return
  const call = unwrap(map.arguments[0])
  if (!ts.isCallExpression(call) || call.arguments.length !== 1) return
  const input = identifier(property(call.expression, "map"))
  const callback = call.arguments[0]
  if (!input || !ts.isArrowFunction(callback) || callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) || callback.parameters.length !== 1 || !ts.isIdentifier(callback.parameters[0].name)) return
  const item = callback.parameters[0].name.text
  if (ts.isBlock(callback.body)) return
  const tuple = unwrap(callback.body)
  if (!ts.isArrayLiteralExpression(tuple) || tuple.elements.length !== 2 || identifier(tuple.elements[1]) !== item) return
  const keyNode = unwrap(tuple.elements[0])
  const key = propertyPath(tuple.elements[0])
  return key?.base === item ? { input, itemProperty: key.propertyName, optionalItem: ts.isPropertyAccessChain(keyNode) && Boolean(keyNode.questionDotToken) } : undefined
}
function cloneNode(node: JsxRenderNode): JsxRenderNode { return structuredClone(node) }
function renderRoot(path: string, exportName: string, conventions: RenderSourceAnalysisConventions): JsxRenderNode | undefined {
  const analyzed = analyzeJsxRenderTree(path, exportName, { ...conventions, retainAbsence: true })
  return analyzed.unresolved.length === 0 && !analyzed.alternatives ? analyzed.root : undefined
}
function returned(statement: ts.Statement): ts.Expression | undefined {
  if (ts.isReturnStatement(statement)) return statement.expression
  if (ts.isBlock(statement) && statement.statements.length === 1 && ts.isReturnStatement(statement.statements[0])) return statement.statements[0].expression
}
function ifReturn(statement: ts.Statement): { condition: ts.Expression; value: ts.Expression } | undefined {
  if (!ts.isIfStatement(statement) || statement.elseStatement) return
  const value = returned(statement.thenStatement)
  return value ? { condition: statement.expression, value } : undefined
}
function listTemplate(expression: ts.Expression, collectionName: string, itemProperty: string): { tag: string; itemTag: string; filterProperty: string; optionalItem: boolean } | undefined {
  const root = unwrap(expression)
  if (!ts.isJsxElement(root) || !ts.isIdentifier(root.openingElement.tagName) || !/^[a-z]/.test(root.openingElement.tagName.text) || !onlyNonstructuralAttributes(root, ["className"])) return
  const children = meaningfulChildren(root)
  if (children.length !== 1 || !ts.isJsxExpression(children[0]) || !children[0].expression) return
  const map = unwrap(children[0].expression)
  if (!ts.isCallExpression(map) || identifier(property(map.expression, "map")) !== collectionName || map.arguments.length !== 1) return
  const callback = map.arguments[0]
  if (!ts.isArrowFunction(callback) || callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) || !ts.isIdentifier(callback.parameters[0]?.name)) return
  const item = callback.parameters[0].name.text
  if (ts.isBlock(callback.body)) return
  const body = unwrap(callback.body)
  if (!ts.isBinaryExpression(body) || body.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) return
  const filter = propertyPath(body.left)
  const filterNode = unwrap(body.left)
  const jsx = unwrap(body.right)
  if (filter?.base !== item || !ts.isJsxElement(jsx) || !ts.isIdentifier(jsx.openingElement.tagName) || !/^[a-z]/.test(jsx.openingElement.tagName.text) || !onlyNonstructuralAttributes(jsx, ["className", "key"])) return
  const rendered = meaningfulChildren(jsx)
  if (rendered.length !== 1 || !ts.isJsxExpression(rendered[0]) || propertyPath(rendered[0].expression)?.base !== item || propertyPath(rendered[0].expression)?.propertyName !== itemProperty) return
  return { tag: root.openingElement.tagName.getText(), itemTag: jsx.openingElement.tagName.getText(), filterProperty: filter.propertyName, optionalItem: ts.isPropertyAccessChain(filterNode) && Boolean(filterNode.questionDotToken) }
}
function appendList(root: JsxRenderNode, tag: string, itemTag: string, collection: string, filterProperty: string): JsxRenderNode {
  const list: JsxRenderNode = { tag, kind: "intrinsic", portal: false, receivesPublicProps: false, dataAttributes: [], derivedSpreads: [], children: [{ tag: itemTag, kind: "intrinsic", portal: false, receivesPublicProps: false, dataAttributes: [], derivedSpreads: [], children: [], repetition: { kind: "map", source: "state", name: collection } }] }
  return { ...cloneNode(root), children: [...root.children, list] }
}
function countFlowChildren(tree: RenderingTree): Array<{ collectionId: string; count: string; itemWhen?: unknown }> {
  return tree.nodes.flatMap((node) => node.children.flatMap((child) => child.repeat ? [{ collectionId: child.repeat.collectionId, count: child.repeat.count, itemWhen: child.repeat.itemWhen }] : []))
}
function sourceRepeatNodes(root: JsxRenderNode): JsxRenderNode[] { return [root, ...root.children.flatMap(sourceRepeatNodes)].filter((node) => Boolean(node.repetition)) }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stable(entry)]))
  return value
}
function sameFact(left: unknown, right: unknown) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)) }

function validatesThumbAriaNames(file: ts.SourceFile): boolean {
  const fn = file.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "validateThumbAriaNames")
  if (!fn?.body || fn.parameters.length !== 3 || !fn.parameters.every((parameter, index) =>
    ts.isIdentifier(parameter.name) && parameter.name.text === ["values", "labels", "labelledBy"][index])) return false

  const compact = (node: ts.Node) => node.getText(file).replace(/\s+/g, "")
  const statements = (statement: ts.Statement) => ts.isBlock(statement) ? [...statement.statements] : [statement]
  const throwsError = (statement: ts.Statement) => {
    const body = statements(statement)
    return body.length === 1 && ts.isThrowStatement(body[0]) && body[0].expression &&
      ts.isNewExpression(body[0].expression) && identifier(body[0].expression.expression) === "Error"
  }
  const matchesIf = (statement: ts.Statement, condition: string, children: string[]) => {
    if (!ts.isIfStatement(statement) || statement.elseStatement || compact(statement.expression) !== condition) return false
    const body = statements(statement.thenStatement)
    if (children.length === 0) return body.length === 1 && throwsError(body[0])
    return body.length === children.length && body.every((child, index) =>
      ts.isIfStatement(child) && !child.elseStatement && compact(child.expression) === children[index] && throwsError(child.thenStatement))
  }
  const body = fn.body.statements
  return body.length === 3 &&
    matchesIf(body[0], "labels!==undefined&&labelledBy!==undefined", []) &&
    matchesIf(body[1], "labels!==undefined", ["labels.length!==values.length", "labels.some((label)=>label.trim().length===0)"]) &&
    matchesIf(body[2], "labelledBy!==undefined", ["labelledBy.length!==values.length", "labelledBy.some((id)=>id.trim().length===0)"])
}

/** Closed AST recognizers for ordered memo content and array-selected mapped children. */
export function analyzeRenderFlowSource(path: string, exportName: string, conventions: RenderSourceAnalysisConventions = {}): RenderFlowSourceResult {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const fn = exportedFunction(file, exportName)
  if (!fn || !fn.body || !ts.isBlock(fn.body)) return { errors: [`${exportName} has no analyzable function body.`] }
  if (shadowsBuiltins(file, fn)) return { errors: [`${exportName} shadows a built-in collection constructor.`] }
  const props = publicProps(fn); const bindings = declarations(fn.body)
  const root = renderRoot(path, exportName, conventions)
  if (!root) return { errors: [`${exportName} has no analyzable render root.`] }
  const collections: Flow["collections"] = []
  for (const [id, initializer] of bindings) {
    const body = memoBody(initializer, file)
    if (!body || ts.isBlock(body)) continue
    const choices = collectionChoices(body, props)
    if (choices && sameNames(memoDependencies(initializer), choices.map((choice) => choice.source.propName))) collections.push({ id, choices })
  }
  const collectionNames = new Set(collections.map((collection) => collection.id))
  const mapped = sourceRepeatNodes(root)
  const renderStatements = fn.body.statements
  const lastRenderStatement = renderStatements[renderStatements.length - 1]
  const validationStatement = renderStatements.length === 3 ? renderStatements[1] : undefined
  const validationCall = validationStatement && ts.isExpressionStatement(validationStatement)
    ? unwrap(validationStatement.expression)
    : undefined
  const hasThumbNameValidation = validationCall && ts.isCallExpression(validationCall) &&
    identifier(validationCall.expression) === "validateThumbAriaNames" &&
    validationCall.arguments.length === 3 &&
    validationCall.arguments.map(identifier).every((name, index) => name === ["values", "thumbAriaLabels", "thumbAriaLabelledBy"][index]) &&
    validatesThumbAriaNames(file)
  const unconditionalMappedRoot = (renderStatements.length === 2 || renderStatements.length === 3) &&
    ts.isVariableStatement(renderStatements[0]) &&
    Boolean(lastRenderStatement && ts.isReturnStatement(lastRenderStatement) && lastRenderStatement.expression) &&
    (renderStatements.length === 2 || hasThumbNameValidation)
  if (unconditionalMappedRoot && collections.length === 1 && mapped.length === 1 && mapped[0].repetition?.name === collections[0].id) return { flow: { collections, branches: [{ otherwise: true, outcome: { kind: "rendered", root, repeats: [{ collectionId: collections[0].id, count: "collection-length" }] } }] }, errors: [] }

  for (const [id, initializer] of bindings) {
    const body = memoBody(initializer, file)
    if (!body || !ts.isBlock(body)) continue
    const localDeclarations = body.statements.filter(ts.isVariableStatement)
    if (localDeclarations.length !== 1 || localDeclarations[0].declarationList.declarations.length !== 1) return { errors: [`${exportName} memo content has unsupported local declarations.`] }
    const uniqueDeclaration = [...declarations(body)].map(([name, expression]) => ({ name, fact: dedupCollection(expression) })).find((item) => item.fact)
    if (!uniqueDeclaration?.fact || !props.has(uniqueDeclaration.fact.input)) continue
    const uniqueName = uniqueDeclaration.name
    const collection = { id: uniqueName, choices: [{ source: { kind: "prop" as const, propName: uniqueDeclaration.fact.input } }], uniqueBy: { itemProperty: uniqueDeclaration.fact.itemProperty, optionalItem: uniqueDeclaration.fact.optionalItem, retention: "last-value-first-key-order" as const } }
    const statements = body.statements.filter((statement) => !ts.isVariableStatement(statement) && !ts.isEmptyStatement(statement))
    if (statements.length !== 4) return { errors: [`${exportName} memo content has unsupported statement structure.`] }
    const authored = ifReturn(statements[0]); const empty = ifReturn(statements[1]); const singleton = ifReturn(statements[2]); const list = returned(statements[3])
    if (!authored || !empty || !singleton || !list) return { errors: [`${exportName} memo content has unsupported branch structure.`] }
    const authoredGuard = guard(authored.condition, props, new Set([uniqueName]))
    const emptyExpression = unwrap(empty.condition)
    const emptyLengthAccess = ts.isPrefixUnaryExpression(emptyExpression) && emptyExpression.operator === ts.SyntaxKind.ExclamationToken ? unwrap(emptyExpression.operand) : undefined
    const emptyLength = emptyLengthAccess ? property(emptyLengthAccess, "length") : undefined
    const emptyInput = identifier(emptyLength)
    const optionalSource = Boolean(emptyLengthAccess && ts.isPropertyAccessChain(emptyLengthAccess) && emptyLengthAccess.questionDotToken)
    const singleGuard = guard(singleton.condition, props, new Set([uniqueName]))
    const singleValue = unwrap(singleton.value)
    const first = ts.isPropertyAccessExpression(singleValue) || ts.isPropertyAccessChain(singleValue) ? singleValue.expression : undefined
    const firstIndex = first && unwrap(first)
    const singleProperty = propertyPath(singleton.value)?.propertyName ?? ((ts.isPropertyAccessExpression(singleValue) || ts.isPropertyAccessChain(singleValue)) ? singleValue.name.text : undefined)
    if (!authoredGuard || identifier(authored.value) !== identifier(authored.condition) || !isNull(empty.value) || emptyInput !== collection.choices[0].source.propName || !sameNames(memoDependencies(initializer), [identifier(authored.value)!, emptyInput]) || !singleGuard || !("op" in singleGuard && singleGuard.op === "length-eq" && singleGuard.value === 1) || !firstIndex || !ts.isElementAccessExpression(firstIndex) || identifier(firstIndex.expression) !== uniqueName || !firstIndex.argumentExpression || !ts.isNumericLiteral(firstIndex.argumentExpression) || firstIndex.argumentExpression.text !== "0" || !singleProperty) return { errors: [`${exportName} memo content contains an unsupported guard or return.`] }
    const listFact = listTemplate(list, uniqueName, singleProperty)
    if (!listFact) return { errors: [`${exportName} memo list/repetition is unsupported.`] }
    const outerStatements = fn.body.statements.filter((statement) => !ts.isVariableStatement(statement) && !ts.isEmptyStatement(statement))
    if (outerStatements.length !== 2) return { errors: [`${exportName} outer render has unsupported statement structure.`] }
    const outerAbsent = ifReturn(outerStatements[0]); const outerRendered = returned(outerStatements[1])
    const outerGuard = outerAbsent && guard(outerAbsent.condition, new Set([id]), new Set())
    const renderedElement = outerRendered && unwrap(outerRendered)
    const contentReferences: ts.JsxExpression[] = []
    if (renderedElement && ts.isJsxElement(renderedElement)) {
      const visit = (node: ts.Node) => { if (ts.isJsxExpression(node) && identifier(node.expression) === id) contentReferences.push(node); ts.forEachChild(node, visit) }
      visit(renderedElement)
    }
    if (!outerAbsent || !outerRendered || !isNull(outerAbsent.value) || !outerGuard || !("op" in outerGuard && outerGuard.op === "falsy" && outerGuard.source.kind === "prop" && outerGuard.source.propName === id) || contentReferences.length !== 1) return { errors: [`${exportName} outer absence/content guard is unsupported.`] }
    const optionalItem = ts.isPropertyAccessChain(singleValue) && Boolean(singleValue.questionDotToken)
    const itemSource: RenderFlowGuardSource = { kind: "collection-item-property", collectionId: uniqueName, itemProperty: singleProperty, optionalItem, index: 0 }
    const branches: Flow["branches"] = [
      { when: authoredGuard, outcome: { kind: "rendered", root: cloneNode(root), content: { source: "prop", propName: identifier(authored.value)! } } },
      { when: { op: "empty", source: { kind: "prop", propName: emptyInput }, optionalSource }, outcome: { kind: "absent" } },
      { when: { all: [singleGuard, { op: "falsy", source: itemSource }] }, outcome: { kind: "absent" } },
      { when: { all: [singleGuard, { op: "truthy", source: itemSource }] }, outcome: { kind: "rendered", root: cloneNode(root), content: { source: "collection-item-property", collectionId: uniqueName, itemProperty: singleProperty, optionalItem, index: 0 } } },
      { otherwise: true, outcome: { kind: "rendered", root: appendList(root, listFact.tag, listFact.itemTag, uniqueName, listFact.filterProperty), repeats: [{ collectionId: uniqueName, count: "matching-items", itemWhen: { op: "truthy", itemProperty: listFact.filterProperty, optionalItem: listFact.optionalItem } }] } },
    ]
    return { flow: { collections: [collection], branches }, errors: [] }
  }
  return { errors: [`${exportName} render flow has no supported source structure.`] }
}

/** Compare every ordered choice, guard, outcome, JSX tree, and repetition edge. */
export function compareRenderFlowSource(contract: RenderingFlow, source: RenderFlowSourceResult, conventions: RenderSourceAnalysisConventions = {}): string[] {
  if (!source.flow) return source.errors.length ? source.errors : ["Source render flow is missing."]
  const actual = source.flow; const errors = [...source.errors]
  if (contract.collections.length !== actual.collections.length) errors.push("Derived collection count mismatch.")
  for (let index = 0; index < Math.min(contract.collections.length, actual.collections.length); index++) {
    const expected = contract.collections[index], found = actual.collections[index]
    if (expected.id !== found.id) errors.push(`Derived collection id mismatch at ${index}.`)
    if (expected.choices.length !== found.choices.length) errors.push(`Collection choice count mismatch at ${index}.`)
    for (let choiceIndex = 0; choiceIndex < Math.min(expected.choices.length, found.choices.length); choiceIndex++) {
      const choice = expected.choices[choiceIndex], sourceChoice = found.choices[choiceIndex]
      if (!sameFact(choice.when ?? null, sourceChoice.when ?? null) || !sameFact(choice.source, sourceChoice.source)) errors.push(`Collection choice/order mismatch at ${index}:${choiceIndex}.`)
    }
    if (!sameFact(expected.uniqueBy ? { itemProperty: expected.uniqueBy.itemProperty, optionalItem: expected.uniqueBy.optionalItem, retention: expected.uniqueBy.retention } : null, found.uniqueBy ?? null)) errors.push(`Collection deduplication mismatch at ${index}.`)
  }
  if (contract.branches.length !== actual.branches.length) errors.push("Render flow branch count mismatch.")
  for (let index = 0; index < Math.min(contract.branches.length, actual.branches.length); index++) {
    const expected = contract.branches[index], found = actual.branches[index]
    if (!sameFact("when" in expected ? expected.when : { otherwise: true }, found.when ?? { otherwise: true })) errors.push(`Render flow guard/order mismatch at ${index}.`)
    if (expected.outcome.kind !== found.outcome.kind) { errors.push(`Render flow outcome mismatch at ${index}.`); continue }
    if (expected.outcome.kind === "rendered" && found.outcome.kind === "rendered") {
      if (!sameFact(expected.outcome.content ?? null, found.outcome.content ?? null)) errors.push(`Render flow content mismatch at ${index}.`)
      errors.push(...compareJsxRenderTree(expected.outcome.tree, { root: found.outcome.root, unresolved: [], unresolvedFindings: [] }, { ...conventions, compareRepetition: true }).map((error) => `Render flow branch ${index}: ${error}`))
      const repetitions = countFlowChildren(expected.outcome.tree)
      if (!sameFact(repetitions, found.outcome.repeats ?? [])) errors.push(`Render flow repetition/cardinality mismatch at ${index}.`)
    }
  }
  return errors
}
