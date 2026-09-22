import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

import * as ts from "typescript"
import { describe, expect, test } from "vitest"

import { canonicalFamilyIds } from "./fixtures/canonical-component-inventory"

const root = resolve(process.cwd())
const familyDirectory = join(root, "contracts/components/families")
const interfaceDirectory = join(root, "contracts/components/interfaces")
const approvedTokenIds = new Set<string>(readJson(join(root, "contracts/tokens/token-contract.json")).tokens.map((token: AnyRecord) => token.id))
const expectedFamilies = [...canonicalFamilyIds].sort()

type AnyRecord = Record<string, any>
type IndependentStructuredType =
  | { kind: "boolean" | "string" | "number" }
  | { kind: "enum"; values: string[] }
  | { kind: "typescript"; typeText: string }
type IndependentLocalPropFact = {
  required: boolean
  type: IndependentStructuredType
  hasDefault: boolean
  default?: unknown
}
type SourceFacts = {
  sourceFile: ts.SourceFile
  sourceText: string
  declaration: ts.Node
  functionLike: ts.FunctionLikeDeclaration | undefined
  bindings: Set<string>
  restBindings: Set<string>
  bindingDefaults: Map<string, unknown>
  typeFacts: Map<string, { typeText: string; values: string[] }>
  jsx: Array<ts.JsxElement | ts.JsxSelfClosingElement>
  dataAttributes: Array<{ name: string; value?: unknown; expressionKind: string }>
  portalCount: number
  propSpreadCount: number
  directUsesSlot: boolean
  returnCount: number
  conditionalSource: boolean
  renderAlternativePredicates: AnyRecord[]
  renderBranches: IndependentRenderBranch[]
  mappedRenderEvidence: Array<{ tag: string; parentTag?: string; collection: string; slot?: string; parentSlot?: string }>
  propSurfaceError?: string
  localPropFacts: Map<string, IndependentLocalPropFact>
}

type IndependentRenderNode = {
  tag: string
  resolvedTag?: string
  importBinding?: { importedName: string; moduleSpecifier: string }
  portal: boolean
  receivesPublicProps: boolean
  dataAttributes: Array<{ name: string; source: string; value?: unknown; prop?: string }>
  children: Array<{ node: IndependentRenderNode; when?: AnyRecord }>
}
type IndependentRenderBranch = { predicate: AnyRecord; tree?: IndependentRenderNode }

type DeclarationContext = {
  checker: ts.TypeChecker
  sourceFile: ts.SourceFile
  propsType: ts.Type
}

type DeclarationProgram = {
  program: ts.Program
  checker: ts.TypeChecker
}

const sourceCache = new Map<string, { sourceFile: ts.SourceFile; sourceText: string }>()
const declarationCache = new Map<string, DeclarationContext | undefined>()
let declarationProgramCache: DeclarationProgram | undefined
let componentProgramCache: DeclarationProgram | undefined

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"))
}

function jsonFiles(directory: string): string[] {
  return readdirSync(directory).filter((file) => file.endsWith(".json")).sort()
}

function loadArtifacts(): { families: AnyRecord[]; interfaces: AnyRecord[] } {
  return {
    families: jsonFiles(familyDirectory).map((file) => readJson(join(familyDirectory, file))),
    interfaces: jsonFiles(interfaceDirectory).map((file) => readJson(join(interfaceDirectory, file))),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function familyById(artifacts: { families: AnyRecord[] }, id: string): AnyRecord {
  const family = artifacts.families.find((item) => item.id === id)
  if (!family) throw new Error(`Missing family fixture ${id}`)
  return family
}

function exportByName(family: AnyRecord, name: string): AnyRecord {
  const exported = family.exports.find((item: AnyRecord) => item.name === name)
  if (!exported) throw new Error(`Missing export fixture ${family.id}.${name}`)
  return exported
}

function interfaceById(artifacts: { interfaces: AnyRecord[] }, id: string): AnyRecord {
  const artifact = artifacts.interfaces.find((item) => item.id === id)
  if (!artifact) throw new Error(`Missing interface fixture ${id}`)
  return artifact
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function sourceFacts(path: string): { sourceFile: ts.SourceFile; sourceText: string } {
  const cached = sourceCache.get(path)
  if (cached) return cached
  const sourceText = readFileSync(path, "utf8")
  const facts = {
    sourceFile: componentProgramCache?.program.getSourceFile(resolve(path)) ?? ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    sourceText,
  }
  sourceCache.set(path, facts)
  return facts
}

function propertyName(node: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return undefined
}

function exportedNames(sourceFile: ts.SourceFile): string[] {
  const names = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text)
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) names.add(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
      }
    }
  }
  return [...names].sort()
}

function declarationFor(sourceFile: ts.SourceFile, name: string): ts.Node | undefined {
  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) return statement
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find((item) => ts.isIdentifier(item.name) && item.name.text === name)
      if (declaration) return declaration
    }
  }
  return undefined
}

function functionLikeIn(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return node
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    for (const argument of node.arguments ?? []) {
      const found = functionLikeIn(argument)
      if (found) return found
    }
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return functionLikeIn(node.expression)
  return undefined
}

function functionLikeFor(declaration: ts.Node | undefined): ts.FunctionLikeDeclaration | undefined {
  if (!declaration) return undefined
  if (ts.isFunctionDeclaration(declaration)) return declaration
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) return functionLikeIn(declaration.initializer)
  return undefined
}

function literalValue(node: ts.Expression | undefined): unknown {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  return undefined
}

function collectTypeFacts(node: ts.TypeNode | undefined, sourceFile: ts.SourceFile, facts: Map<string, { typeText: string; values: string[] }>): void {
  if (!node) return
  if (ts.isTypeLiteralNode(node)) {
    for (const member of node.members) {
      if (!ts.isPropertySignature(member)) continue
      const name = propertyName(member.name)
      if (!name || !member.type) continue
      const values = ts.isUnionTypeNode(member.type)
        ? member.type.types.flatMap((type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal) ? [type.literal.text] : [])
        : ts.isLiteralTypeNode(member.type) && ts.isStringLiteral(member.type.literal)
          ? [member.type.literal.text]
          : []
      facts.set(name, { typeText: member.type.getText(sourceFile), values })
    }
  }
  ts.forEachChild(node, (child) => {
    if (ts.isTypeNode(child)) collectTypeFacts(child, sourceFile, facts)
  })
}

function walkComponent(node: ts.Node, callback: (node: ts.Node) => void): void {
  const visit = (current: ts.Node): void => {
    if (current !== node && (ts.isFunctionLike(current) || ts.isClassDeclaration(current))) return
    callback(current)
    current.forEachChild(visit)
  }
  visit(node)
}

function jsxTag(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText()
}

function jsxAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttributes {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
}

function jsxNodes(functionLike: ts.FunctionLikeDeclaration): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
  const nodes: Array<ts.JsxElement | ts.JsxSelfClosingElement> = []
  const body = functionLike.body
  if (!body) return nodes
  const isMapCallback = (node: ts.Node): boolean => (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    && ts.isCallExpression(node.parent)
    && node.parent.arguments.includes(node as ts.Expression)
    && ts.isPropertyAccessExpression(node.parent.expression)
    && node.parent.expression.name.text === "map"
  const visit = (node: ts.Node): void => {
    if (node !== body && ts.isFunctionLike(node)) {
      if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && isMapCallback(node)) node.body.forEachChild(visit)
      return
    }
    if (ts.isJsxElement(node)) nodes.push(node)
    if (ts.isJsxSelfClosingElement(node)) nodes.push(node)
    node.forEachChild(visit)
  }
  visit(body)
  return nodes
}

function literalSlot(node: ts.JsxElement | ts.JsxSelfClosingElement): string | undefined {
  const attribute = jsxAttributes(node).properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === "data-slot")
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined
}

function mappedRenderEvidence(functionLike: ts.FunctionLikeDeclaration): SourceFacts["mappedRenderEvidence"] {
  return jsxNodes(functionLike).flatMap((node) => {
    let current: ts.Node | undefined = node
    let call: ts.CallExpression | undefined
    while (current && current !== functionLike) {
      if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "map") {
        const callback = current.arguments[0]
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) call = current
      }
      current = current.parent
    }
    if (!call || !ts.isPropertyAccessExpression(call.expression) || !ts.isIdentifier(call.expression.expression)) return []
    current = call.parent
    let parent: ts.JsxElement | undefined
    while (current && current !== functionLike) {
      if (ts.isJsxElement(current)) { parent = current; break }
      current = current.parent
    }
    return [{
      tag: jsxTag(node),
      ...(parent ? { parentTag: jsxTag(parent) } : {}),
      collection: call.expression.expression.text,
      ...(literalSlot(node) ? { slot: literalSlot(node) } : {}),
      ...(parent && literalSlot(parent) ? { parentSlot: literalSlot(parent) } : {}),
    }]
  })
}

function independentRenderCondition(expression: ts.Expression, bindings: Set<string>, mode: "truthiness" | "boolean" | "non-nullish" = "truthiness"): AnyRecord | undefined {
  const reference = (name: string, value: AnyRecord) => bindings.has(name) ? { propName: name, ...value } : { source: "state", name, ...value }
  if (ts.isIdentifier(expression)) return reference(expression.text, mode === "boolean" ? { equals: true } : mode === "non-nullish" ? { nullishness: "non-nullish" } : { truthiness: "truthy" })
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(expression.operand)) {
    return reference(expression.operand.text, mode === "boolean" ? { equals: false } : { truthiness: "falsy" })
  }
  if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(expression.operatorToken.kind)) {
    const left = ts.isIdentifier(expression.left) ? expression.left.text : undefined
    const right = literalValue(expression.right)
    if (left && right !== undefined && right !== null) return reference(left, { equals: right })
  }
  return undefined
}

function negateIndependentRenderCondition(condition: AnyRecord): AnyRecord | undefined {
  if (condition.all) return undefined
  if (condition.truthiness) return { ...condition, truthiness: condition.truthiness === "truthy" ? "falsy" : "truthy" }
  if (condition.nullishness) return { ...condition, nullishness: condition.nullishness === "nullish" ? "non-nullish" : "nullish" }
  if (typeof condition.equals === "boolean") return { ...condition, equals: !condition.equals }
  return undefined
}

function independentConditionSubject(condition: AnyRecord): string {
  return condition.propName ? `prop:${condition.propName}` : `state:${condition.name}`
}

function independentAtomsContradict(left: AnyRecord, right: AnyRecord): boolean {
  if (independentConditionSubject(left) !== independentConditionSubject(right)) return false
  if ("equals" in left && "equals" in right) return left.equals !== right.equals
  if (left.truthiness && right.truthiness) return left.truthiness !== right.truthiness
  if (left.nullishness && right.nullishness) return left.nullishness !== right.nullishness
  if (left.nullishness || right.nullishness) {
    const nullish = left.nullishness ? left : right
    const other = nullish === left ? right : left
    if (nullish.nullishness === "non-nullish") return false
    return "equals" in other || other.truthiness === "truthy"
  }
  const truthiness = left.truthiness ? left : right
  const equals = truthiness === left ? right : left
  return "equals" in equals && Boolean(equals.equals) !== (truthiness.truthiness === "truthy")
}

function combineIndependentRenderConditions(left: AnyRecord, right: AnyRecord): AnyRecord | undefined {
  const members = [...(left.all ?? [left]), ...(right.all ?? [right])]
  if (members.some((condition, index) => members.slice(index + 1).some((candidate) => independentAtomsContradict(condition, candidate)))) return undefined
  const unique = members
    .filter((condition, index) => members.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(condition)) === index)
  return unique.length === 1 ? unique[0] : { all: unique }
}

function independentRenderBranchExpressions(functionLike: ts.FunctionLikeDeclaration): Array<{ predicate: AnyRecord; expression: ts.Expression }> {
  if (!functionLike.body || !ts.isBlock(functionLike.body)) return []
  const bindings = new Set<string>()
  const parameter = functionLike.parameters[0]
  if (parameter && ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (ts.isIdentifier(element.name)) bindings.add(element.name.text)
  const branches: Array<{ predicate?: AnyRecord; expression: ts.Expression }> = []
  for (const statement of functionLike.body.statements) {
    if (ts.isIfStatement(statement)) {
      const returned = ts.isReturnStatement(statement.thenStatement)
        ? statement.thenStatement.expression
        : ts.isBlock(statement.thenStatement)
          ? statement.thenStatement.statements.find(ts.isReturnStatement)?.expression
          : undefined
      const condition = returned ? independentRenderCondition(statement.expression, bindings) : undefined
      if (condition && returned) branches.push({ predicate: condition, expression: returned })
    } else if (ts.isReturnStatement(statement) && statement.expression) branches.push({ expression: statement.expression })
  }
  if (branches.length === 2 && branches[0].predicate && !branches[1].predicate) {
    branches[1].predicate = negateIndependentRenderCondition(branches[0].predicate)
  }

  const declarations = new Map<string, ts.Expression>()
  walkComponent(functionLike.body, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer)
  })
  const nestedCondition = (expression: ts.Expression): AnyRecord | undefined => {
    const visited = new Set<string>()
    let found: AnyRecord | undefined
    const visit = (node: ts.Node): void => {
      if (found) return
      if (ts.isIdentifier(node) && declarations.has(node.text)) {
        const initializer = declarations.get(node.text)!
        const isRootAlias = node === expression
        const isJsxTag = ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent)
        const isJsxAlias = ts.isJsxExpression(node.parent)
        if ((isRootAlias || isJsxTag) && ts.isConditionalExpression(initializer)) {
          found = independentRenderCondition(initializer.condition, bindings, "boolean")
          return
        }
        if ((isRootAlias || isJsxAlias) && !visited.has(node.text)) {
          visited.add(node.text)
          visit(initializer)
          if (found) return
        }
      }
      node.forEachChild(visit)
    }
    visit(unwrapReturnedExpression(expression))
    return found
  }

  const results: Array<{ predicate: AnyRecord; expression: ts.Expression }> = []
  const branchCandidates: Array<{ predicate?: AnyRecord; expression: ts.Expression }> = branches.length
    ? branches
    : returnExpressions(functionLike).map((expression) => ({ expression }))
  for (const branch of branchCandidates) {
    let nullish: AnyRecord | undefined
    walkComponent(unwrapReturnedExpression(branch.expression), (node) => {
      if (!nullish && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
        nullish = independentRenderCondition(node.left, bindings, "non-nullish")
      }
    })
    const nested = nullish ?? nestedCondition(branch.expression)
    if (!nested) {
      results.push({ predicate: branch.predicate ?? { otherwise: true }, expression: branch.expression })
      continue
    }
    const inverse = negateIndependentRenderCondition(nested)
    if (branch.predicate && inverse) {
      const positive = combineIndependentRenderConditions(branch.predicate, nested)
      const negative = combineIndependentRenderConditions(branch.predicate, inverse)
      if (positive) results.push({ predicate: positive, expression: branch.expression })
      if (negative) results.push({ predicate: negative, expression: branch.expression })
    } else if (!branch.predicate && inverse) {
      results.push(
        { predicate: nested, expression: branch.expression },
        { predicate: nullish ? inverse : { otherwise: true }, expression: branch.expression },
      )
    } else results.push({ predicate: branch.predicate ?? nested, expression: branch.expression })
  }
  return results.length === 1 && results[0].predicate.otherwise ? [] : results
}

function renderAlternativePredicates(functionLike: ts.FunctionLikeDeclaration): AnyRecord[] {
  return independentRenderBranchExpressions(functionLike).map((branch) => branch.predicate)
}

function independentRenderBranches(functionLike: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile, restBindings: Set<string>): IndependentRenderBranch[] {
  const declarations = new Map<string, ts.Expression>()
  walkComponent(functionLike.body!, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer)
  })
  const imports = new Map<string, { importedName: string; moduleSpecifier: string }>()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const moduleSpecifier = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (clause?.name) imports.set(clause.name.text, { importedName: "default", moduleSpecifier })
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) imports.set(clause.namedBindings.name.text, { importedName: "*", moduleSpecifier })
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) {
      imports.set(element.name.text, { importedName: element.propertyName?.text ?? element.name.text, moduleSpecifier })
    }
  }
  const bindings = new Set<string>()
  const parameter = functionLike.parameters[0]
  if (parameter && ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) if (ts.isIdentifier(element.name)) bindings.add(element.name.text)
  const branchSelects = (predicate: AnyRecord, condition: AnyRecord): boolean | undefined => {
    const atoms = predicate.all ?? [predicate]
    const expected = JSON.stringify(normalizedPredicate(condition))
    if (atoms.some((atom: AnyRecord) => JSON.stringify(normalizedPredicate(atom)) === expected)) return true
    const inverse = negateIndependentRenderCondition(condition)
    if (inverse && atoms.some((atom: AnyRecord) => JSON.stringify(normalizedPredicate(atom)) === JSON.stringify(normalizedPredicate(inverse)))) return false
    return predicate.otherwise ? false : undefined
  }
  const selectedExpression = (expression: ts.Expression, predicate: AnyRecord, visited = new Set<string>()): ts.Expression => {
    const unwrapped = unwrapReturnedExpression(expression)
    if (ts.isIdentifier(unwrapped) && declarations.has(unwrapped.text) && !visited.has(unwrapped.text)) {
      visited.add(unwrapped.text)
      return selectedExpression(declarations.get(unwrapped.text)!, predicate, visited)
    }
    if (ts.isConditionalExpression(unwrapped)) {
      const condition = independentRenderCondition(unwrapped.condition, bindings, "boolean")
      const selected = condition && branchSelects(predicate, condition)
      if (selected !== undefined) return selectedExpression(selected ? unwrapped.whenTrue : unwrapped.whenFalse, predicate, visited)
    }
    return unwrapped
  }
  const importForTag = (tagName: ts.JsxTagNameExpression) => {
    let root: ts.Node = tagName
    while (ts.isPropertyAccessExpression(root)) root = root.expression
    return ts.isIdentifier(root) ? imports.get(root.text) : undefined
  }
  const renderNode = (expression: ts.Expression, predicate: AnyRecord, edgeWhen?: AnyRecord): { node: IndependentRenderNode; when?: AnyRecord } | undefined => {
    const selected = selectedExpression(expression, predicate)
    if (!ts.isJsxElement(selected) && !ts.isJsxSelfClosingElement(selected) && !ts.isJsxFragment(selected)) return undefined
    if (ts.isJsxFragment(selected)) {
      const children = selected.children.flatMap((child) => renderChild(child, predicate))
      return { node: { tag: "Fragment", portal: false, receivesPublicProps: false, dataAttributes: [], children }, ...(edgeWhen ? { when: edgeWhen } : {}) }
    }
    const opening = ts.isJsxElement(selected) ? selected.openingElement : selected
    const tag = opening.tagName.getText(sourceFile)
    let resolvedTag: string | undefined
    let importBinding = importForTag(opening.tagName)
    if (ts.isIdentifier(opening.tagName) && declarations.has(opening.tagName.text)) {
      const host = selectedExpression(declarations.get(opening.tagName.text)!, predicate)
      if (ts.isStringLiteral(host)) resolvedTag = host.text
      else if (ts.isIdentifier(host) || ts.isPropertyAccessExpression(host)) {
        resolvedTag = host.getText(sourceFile)
        let root: ts.Node = host
        while (ts.isPropertyAccessExpression(root)) root = root.expression
        if (ts.isIdentifier(root)) importBinding = imports.get(root.text)
      }
    }
    const dataAttributes: IndependentRenderNode["dataAttributes"] = []
    let receivesPublicProps = false
    for (const attribute of opening.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        if (ts.isIdentifier(attribute.expression) && restBindings.has(attribute.expression.text)) receivesPublicProps = true
        continue
      }
      if (!ts.isJsxAttribute(attribute)) continue
      const name = attribute.name.getText(sourceFile)
      if (!name.startsWith("data-")) continue
      if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) dataAttributes.push({ name, source: "literal", value: attribute.initializer.text })
      else if (attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isIdentifier(attribute.initializer.expression)) {
        dataAttributes.push({
          name,
          source: bindings.has(attribute.initializer.expression.text) ? "prop" : "primitive-state",
          prop: attribute.initializer.expression.text,
        })
      }
      else dataAttributes.push({ name, source: "other" })
    }
    const effectiveTag = resolvedTag ?? tag
    const children = ts.isJsxElement(selected) ? selected.children.flatMap((child) => renderChild(child, predicate)) : []
    return {
      node: {
        tag,
        ...(resolvedTag ? { resolvedTag } : {}),
        ...(importBinding ? { importBinding } : {}),
        portal: effectiveTag === "Portal" || effectiveTag.endsWith(".Portal") || effectiveTag.endsWith("Portal"),
        receivesPublicProps,
        dataAttributes,
        children,
      },
      ...(edgeWhen ? { when: edgeWhen } : {}),
    }
  }
  const renderChild = (child: ts.JsxChild, predicate: AnyRecord): Array<{ node: IndependentRenderNode; when?: AnyRecord }> => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
      const rendered = renderNode(child, predicate)
      return rendered ? [rendered] : []
    }
    if (!ts.isJsxExpression(child) || !child.expression || ts.isIdentifier(child.expression) && child.expression.text === "children") return []
    let expression = child.expression
    let when: AnyRecord | undefined
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const nonNullish = independentRenderCondition(expression.left, bindings, "non-nullish")
      if (nonNullish && branchSelects(predicate, nonNullish)) return []
      expression = expression.right
    } else if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      when = independentRenderCondition(expression.left, bindings, "boolean")
      expression = expression.right
    }
    const rendered = renderNode(expression, predicate, when)
    return rendered ? [rendered] : []
  }
  return independentRenderBranchExpressions(functionLike).map(({ predicate, expression }) => {
    const rendered = renderNode(expression, predicate)
    return { predicate, ...(rendered ? { tree: rendered.node } : {}) }
  })
}

function returnExpressions(functionLike: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!functionLike.body) return []
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const expressions: ts.Expression[] = []
  walkComponent(functionLike.body, (node) => {
    if (ts.isReturnStatement(node) && node.expression) expressions.push(node.expression)
  })
  return expressions
}

function directBindingDefaults(functionLike: ts.FunctionLikeDeclaration): Map<string, unknown> {
  const defaults = new Map<string, unknown>()
  const parameter = functionLike.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return defaults
  for (const element of parameter.name.elements) {
    const name = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName))
      ? element.propertyName.text
      : ts.isIdentifier(element.name) ? element.name.text : undefined
    const value = literalValue(element.initializer)
    if (name && value !== undefined) defaults.set(name, value)
  }
  return defaults
}

function forwardedBindingNames(functionLike: ts.FunctionLikeDeclaration): Set<string> {
  const names = new Set<string>()
  const parameter = functionLike.parameters[0]
  if (!parameter) return names
  if (ts.isIdentifier(parameter.name)) names.add(parameter.name.text)
  if (ts.isObjectBindingPattern(parameter.name)) for (const element of parameter.name.elements) {
    if (element.dotDotDotToken && ts.isIdentifier(element.name)) names.add(element.name.text)
  }
  return names
}

function unwrapReturnedExpression(expression: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) return unwrapReturnedExpression(expression.expression)
  return expression
}

function returnedRootOpening(expression: ts.Expression): ts.JsxOpeningLikeElement | undefined {
  const root = unwrapReturnedExpression(expression)
  if (ts.isJsxElement(root)) return root.openingElement
  return ts.isJsxSelfClosingElement(root) ? root : undefined
}

function resolvedSymbol(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node)
  return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}

function functionForSymbol(symbol: ts.Symbol | undefined): ts.FunctionLikeDeclaration | undefined {
  for (const declaration of symbol?.declarations ?? []) {
    const found = ts.isVariableDeclaration(declaration) ? functionLikeFor(declaration) : functionLikeIn(declaration)
    if (found) return found
  }
  return undefined
}

function inheritedWrapperDefaults(functionLike: ts.FunctionLikeDeclaration, checker: ts.TypeChecker, seen = new Set<ts.FunctionLikeDeclaration>()): Map<string, unknown> {
  if (seen.has(functionLike)) return new Map()
  seen.add(functionLike)
  const forwarded = forwardedBindingNames(functionLike)
  const branches: Array<Map<string, unknown>> = []
  for (const expression of returnExpressions(functionLike)) {
    const opening = returnedRootOpening(expression)
    if (!opening || !opening.attributes.properties.some((property) => ts.isJsxSpreadAttribute(property) && ts.isIdentifier(property.expression) && forwarded.has(property.expression.text))) continue
    const defaults = new Map<string, unknown>()
    if (ts.isIdentifier(opening.tagName)) {
      const child = functionForSymbol(resolvedSymbol(checker, opening.tagName))
      if (child) {
        for (const [name, value] of inheritedWrapperDefaults(child, checker, new Set(seen))) defaults.set(name, value)
        for (const [name, value] of directBindingDefaults(child)) defaults.set(name, value)
      }
    }
    for (const property of opening.attributes.properties) {
      if (!ts.isJsxAttribute(property)) continue
      const name = ts.isIdentifier(property.name) ? property.name.text : undefined
      const initializer = property.initializer
      const value = initializer && ts.isStringLiteral(initializer)
        ? initializer.text
        : initializer && ts.isJsxExpression(initializer) ? literalValue(initializer.expression) : undefined
      if (name && value !== undefined) defaults.set(name, value)
    }
    branches.push(defaults)
  }
  seen.delete(functionLike)
  if (!branches.length) return new Map()
  const common = new Map(branches[0])
  for (const [name, value] of common) if (!branches.every((branch) => branch.has(name) && branch.get(name) === value)) common.delete(name)
  return common
}

function independentTypeName(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : name.right.text
}

function independentStringKeys(node: ts.TypeNode | undefined): string[] {
  if (!node) return []
  if (ts.isUnionTypeNode(node)) return node.types.flatMap(independentStringKeys)
  return ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? [node.literal.text] : []
}

function independentPropsTypeNode(functionLike: ts.FunctionLikeDeclaration): ts.TypeNode | undefined {
  const direct = functionLike.parameters[0]?.type
  if (direct) return direct
  return ts.isCallExpression(functionLike.parent) ? functionLike.parent.typeArguments?.[1] : undefined
}

function independentLocalPropTypeNodes(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, visited = new Set<ts.Node>()): Map<string, ts.TypeNode | undefined> {
  const values = new Map<string, ts.TypeNode | undefined>()
  if (!typeNode || visited.has(typeNode)) return values
  visited.add(typeNode)
  if (ts.isParenthesizedTypeNode(typeNode)) return independentLocalPropTypeNodes(typeNode.type, checker, visited)
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) for (const [name, node] of independentLocalPropTypeNodes(member, checker, new Set(visited))) values.set(name, node)
    return values
  }
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) values.set(member.name.text, member.type)
    }
    return values
  }
  if (!ts.isTypeReferenceNode(typeNode)) return values
  const utility = independentTypeName(typeNode.typeName)
  if (utility === "Pick") {
    const selected = independentLocalPropTypeNodes(typeNode.typeArguments?.[0], checker, new Set(visited))
    for (const name of independentStringKeys(typeNode.typeArguments?.[1])) values.set(name, selected.get(name))
    return values
  }
  if (utility === "Omit") {
    const selected = independentLocalPropTypeNodes(typeNode.typeArguments?.[0], checker, new Set(visited))
    for (const name of independentStringKeys(typeNode.typeArguments?.[1])) selected.delete(name)
    return selected
  }
  if (utility === "VariantProps") {
    for (const property of checker.getPropertiesOfType(checker.getTypeAtLocation(typeNode))) values.set(property.name, undefined)
    return values
  }
  if (utility === "ComponentProps" || utility === "ComponentPropsWithoutRef") {
    const target = typeNode.typeArguments?.[0]
    if (!target || !ts.isTypeQueryNode(target)) return values
    const child = functionForSymbol(resolvedSymbol(checker, target.exprName))
    return child ? independentLocalPropTypeNodes(independentPropsTypeNode(child), checker, new Set(visited)) : values
  }
  const symbol = resolvedSymbol(checker, typeNode.typeName)
  for (const declaration of symbol?.declarations ?? []) if (ts.isTypeAliasDeclaration(declaration)) {
    for (const [name, node] of independentLocalPropTypeNodes(declaration.type, checker, new Set(visited))) values.set(name, node)
  }
  return values
}

function independentUnsafeAuthority(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, visited = new Set<ts.Node>()): boolean {
  if (!typeNode || visited.has(typeNode)) return false
  visited.add(typeNode)
  if (checker.getTypeAtLocation(typeNode).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return true
  if (ts.isParenthesizedTypeNode(typeNode)) return independentUnsafeAuthority(typeNode.type, checker, visited)
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some((member) => independentUnsafeAuthority(member, checker, new Set(visited)))
  }
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.some((member) => ts.isPropertySignature(member) && independentUnsafeAuthority(member.type, checker, new Set(visited)))
  }
  if (!ts.isTypeReferenceNode(typeNode)) return false
  const utility = independentTypeName(typeNode.typeName)
  if (["Pick", "Omit", "VariantProps"].includes(utility) && independentUnsafeAuthority(typeNode.typeArguments?.[0], checker, new Set(visited))) return true
  if (utility === "ComponentProps" || utility === "ComponentPropsWithoutRef") return false
  const symbol = resolvedSymbol(checker, typeNode.typeName)
  return (symbol?.declarations ?? []).some((declaration) => ts.isTypeAliasDeclaration(declaration)
    && independentUnsafeAuthority(declaration.type, checker, new Set(visited)))
}

function independentStructuredType(checker: ts.TypeChecker, type: ts.Type, authored: ts.TypeNode | undefined): IndependentStructuredType {
  const members = (type.isUnion() ? type.types : [type]).filter((member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)))
  const values = members.filter((member) => member.isStringLiteral()).map((member) => member.value)
  if (members.length > 0 && values.length === members.length) return { kind: "enum", values: [...new Set(values)].sort() }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)))) return { kind: "boolean" }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)))) return { kind: "string" }
  if (members.length > 0 && members.every((member) => Boolean(member.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)))) return { kind: "number" }
  return {
    kind: "typescript",
    typeText: authored
      ? authored.getText(authored.getSourceFile()).replaceAll("React.", "")
      : checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
  }
}

function componentSourceFacts(sourceFile: ts.SourceFile, declaration: ts.Node): SourceFacts {
  const functionLike = functionLikeFor(declaration)
  const bindings = new Set<string>()
  const restBindings = new Set<string>()
  const bindingDefaults = new Map<string, unknown>()
  const typeFacts = new Map<string, { typeText: string; values: string[] }>()
  let propSurfaceError: string | undefined
  const localPropFacts = new Map<string, IndependentLocalPropFact>()
  if (functionLike?.parameters[0]) {
    const parameter = functionLike.parameters[0]
    collectTypeFacts(parameter.type, sourceFile, typeFacts)
    const checker = componentProgramCache?.checker
    if (checker) {
      const propsType = checker.getTypeAtLocation(parameter)
      const typeNode = independentPropsTypeNode(functionLike)
      const localTypes = independentLocalPropTypeNodes(typeNode, checker)
      if (propsType.flags & ts.TypeFlags.Any) propSurfaceError = "component props type is any"
      else if (propsType.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Never)) propSurfaceError = "component props type cannot be resolved"
      else if (independentUnsafeAuthority(typeNode, checker)) propSurfaceError = "component props type contains unsafe any or unknown authority"
      else {
        for (const symbol of checker.getPropertiesOfType(propsType)) {
          const type = checker.getTypeOfSymbolAtLocation(symbol, parameter)
          if (localTypes.has(symbol.name) && type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
            propSurfaceError = "component props type contains unsafe any or unknown authority"
            typeFacts.clear()
            localPropFacts.clear()
            break
          }
          typeFacts.set(symbol.name, {
            typeText: checker.typeToString(type, parameter, ts.TypeFormatFlags.NoTruncation),
            values: [...new Set(stringLiteralValues(type))].sort(),
          })
          if (localTypes.has(symbol.name)) {
            localPropFacts.set(symbol.name, {
              required: !Boolean(symbol.flags & ts.SymbolFlags.Optional),
              type: independentStructuredType(checker, type, localTypes.get(symbol.name)),
              hasDefault: false,
            })
          }
        }
      }
      for (const [name, value] of inheritedWrapperDefaults(functionLike, checker)) bindingDefaults.set(name, value)
    }
    if (ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          bindings.add(element.name.text)
          if (element.dotDotDotToken) restBindings.add(element.name.text)
          const value = literalValue(element.initializer)
          if (value !== undefined) bindingDefaults.set(element.name.text, value)
        }
      }
    }
  }
  if (functionLike?.body) {
    walkComponent(functionLike.body, (node) => {
      if (!ts.isBinaryExpression(node) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) return
      const leftName = ts.isIdentifier(node.left) ? node.left.text : undefined
      const rightValue = literalValue(node.right)
      const rightName = ts.isIdentifier(node.right) ? node.right.text : undefined
      const leftValue = literalValue(node.left)
      const name = leftName ?? rightName
      const value = leftName ? rightValue : leftValue
      if (!name || typeof value !== "string") return
      const previous = typeFacts.get(name)
      const values = [...new Set([...(previous?.values ?? []), value])].sort()
      typeFacts.set(name, { typeText: previous?.typeText ?? "string", values })
    })
  }
  const jsx = functionLike ? jsxNodes(functionLike) : []
  const dataAttributes: SourceFacts["dataAttributes"] = []
  let propSpreadCount = 0
  let directUsesSlot = false
  for (const node of jsx) {
    if (jsxTag(node).includes("Portal")) {
      // A Portal JSX element is a render boundary in the source, regardless of its package owner.
    }
    for (const attribute of jsxAttributes(node).properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        if (ts.isIdentifier(attribute.expression) && restBindings.has(attribute.expression.text)) propSpreadCount++
        continue
      }
      if (!ts.isJsxAttribute(attribute)) continue
      const name = attribute.name.getText(sourceFile)
      if (!name.startsWith("data-")) continue
      const value = attribute.initializer
      if (!value) {
        dataAttributes.push({ name, expressionKind: "boolean" })
      } else if (ts.isStringLiteral(value)) {
        dataAttributes.push({ name, value: value.text, expressionKind: "literal" })
      } else if (ts.isJsxExpression(value) && value.expression) {
        const expression = value.expression
        dataAttributes.push({
          name,
          value: literalValue(expression),
          expressionKind: ts.isConditionalExpression(expression) ? "conditional" : ts.isIdentifier(expression) ? "identifier" : "other",
        })
      }
    }
  }
  const bodyText = functionLike?.getText(sourceFile) ?? declaration.getText(sourceFile)
  const variantDefaults = cvaFacts(sourceFile, bodyText).defaults
  for (const [name, fact] of localPropFacts) {
    const hasDefault = bindingDefaults.has(name) || variantDefaults.has(name)
    const value = bindingDefaults.has(name) ? bindingDefaults.get(name) : variantDefaults.get(name)
    localPropFacts.set(name, { ...fact, hasDefault, ...(hasDefault ? { default: value } : {}) })
  }
  directUsesSlot ||= bodyText.includes("Slot.Root")
  return {
    sourceFile,
    sourceText: bodyText,
    declaration,
    functionLike,
    bindings,
    restBindings,
    bindingDefaults,
    typeFacts,
    jsx,
    dataAttributes,
    portalCount: jsx.filter((node) => jsxTag(node).includes("Portal")).length,
    propSpreadCount,
    directUsesSlot,
    returnCount: functionLike ? returnExpressions(functionLike).length : 0,
    conditionalSource: /\bif\s*\(|\?|&&/.test(bodyText),
    renderAlternativePredicates: functionLike ? renderAlternativePredicates(functionLike) : [],
    renderBranches: functionLike ? independentRenderBranches(functionLike, sourceFile, restBindings) : [],
    mappedRenderEvidence: functionLike ? mappedRenderEvidence(functionLike) : [],
    ...(propSurfaceError ? { propSurfaceError } : {}),
    localPropFacts,
  }
}

function cvaFacts(sourceFile: ts.SourceFile, bodyText: string): { variants: Map<string, string[]>; defaults: Map<string, unknown>; texts: string[] } {
  const variants = new Map<string, string[]>()
  const defaults = new Map<string, unknown>()
  const texts: string[] = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
      if (declaration.initializer.expression.getText(sourceFile) !== "cva" || !bodyText.includes(declaration.name.text)) continue
      texts.push(declaration.initializer.getText(sourceFile))
      const options = declaration.initializer.arguments[1]
      if (!options || !ts.isObjectLiteralExpression(options)) continue
      for (const property of options.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        const name = propertyName(property.name)
        if (!name || !ts.isObjectLiteralExpression(property.initializer)) continue
        if (name === "variants") {
          for (const variant of property.initializer.properties) {
            if (!ts.isPropertyAssignment(variant) || !ts.isObjectLiteralExpression(variant.initializer)) continue
            const variantName = propertyName(variant.name)
            if (!variantName) continue
            variants.set(variantName, variant.initializer.properties
              .filter((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item))
              .map((item) => propertyName(item.name))
              .filter((item): item is string => !!item))
          }
        }
        if (name === "defaultVariants") {
          for (const defaultVariant of property.initializer.properties) {
            if (!ts.isPropertyAssignment(defaultVariant)) continue
            const defaultName = propertyName(defaultVariant.name)
            if (!defaultName) continue
            const value = literalValue(defaultVariant.initializer)
            if (value !== undefined) defaults.set(defaultName, value)
          }
        }
      }
    }
  }
  return { variants, defaults, texts }
}

function renderings(component: AnyRecord): AnyRecord[] {
  const rendering = component.rendering
  if (!rendering) return []
  if (Array.isArray(rendering.alternatives)) return rendering.alternatives.map((alternative: AnyRecord) => alternative.rendering)
  return [rendering]
}

function renderingNodes(component: AnyRecord): AnyRecord[] {
  return renderings(component).flatMap((rendering) => rendering?.nodes ?? [])
}

function renderingAttributes(component: AnyRecord): AnyRecord[] {
  return renderingNodes(component).flatMap((node) => node.dataAttributes ?? [])
}

function renderingHostTags(component: AnyRecord): string[] {
  return renderingNodes(component)
    .map((node) => node.host)
    .filter((host) => host?.kind === "intrinsic" && typeof host.tag === "string")
    .map((host) => host.tag)
}

function collectChildIds(node: AnyRecord, ids: string[]): void {
  for (const child of node.children ?? []) {
    if (typeof child.nodeId === "string") ids.push(child.nodeId)
  }
}

function normalizedPredicate(predicate: AnyRecord): AnyRecord {
  if (predicate.otherwise) return { otherwise: true }
  if (predicate.all) return { all: predicate.all.map(normalizedPredicate) }
  if (predicate.truthiness === "truthy") return { ...predicate, equals: true, truthiness: undefined }
  if (predicate.truthiness === "falsy") return { ...predicate, equals: false, truthiness: undefined }
  return predicate
}

function normalizedHostName(value: string): string {
  return value.split(".").at(-1)!.replace(/[^a-z0-9]/gi, "").toLowerCase()
}

function independentHostMatches(tag: string, host: AnyRecord): boolean {
  if (host?.kind === "unresolved") return true
  const expected = host?.kind === "inherited-interface"
    ? host.interfaceId
    : host?.kind === "component-export" || host?.kind === "cross-family-export"
      ? host.exportName
      : host?.tag
  return typeof expected === "string" && normalizedHostName(tag) === normalizedHostName(expected)
}

function independentImportMatches(binding: IndependentRenderNode["importBinding"], host: AnyRecord): boolean {
  if (!binding || !["component-export", "cross-family-export"].includes(host?.kind)) return true
  if (binding.importedName !== host.exportName) return false
  if (host.kind !== "cross-family-export") return true
  const normalizedModule = binding.moduleSpecifier.replace(/\\/g, "/").replace(/\.(?:[cm]?[jt]sx?)$/, "")
  return normalizedModule === host.familyId || normalizedModule.endsWith(`/${host.familyId}`)
}

function comparableIndependentAttribute(attribute: AnyRecord): AnyRecord {
  return {
    name: attribute.name,
    source: attribute.source,
    ...(Object.hasOwn(attribute, "value") ? { value: attribute.value } : {}),
    ...(Object.hasOwn(attribute, "prop") ? { prop: attribute.prop } : {}),
  }
}

function independentRenderTreeMatches(source: IndependentRenderNode, rendering: AnyRecord): boolean {
  const nodes = new Map<string, AnyRecord>((rendering.nodes ?? []).map((node: AnyRecord) => [node.id, node]))
  const portalIds = new Set<string>((rendering.portalBoundaries ?? []).map((boundary: AnyRecord) => boundary.nodeId))
  const visited = new Set<string>()
  const compareNode = (sourceNode: IndependentRenderNode, nodeId: string): boolean => {
    const contractNode = nodes.get(nodeId)
    if (!contractNode || visited.has(nodeId)) return false
    visited.add(nodeId)
    const sourceHost = sourceNode.resolvedTag ?? sourceNode.tag
    if (!independentHostMatches(sourceHost, contractNode.host) || !independentImportMatches(sourceNode.importBinding, contractNode.host)) return false
    if (sourceNode.portal !== portalIds.has(nodeId) || sourceNode.receivesPublicProps !== Boolean(contractNode.receivesPublicProps)) return false
    const contractAttributes = contractNode.dataAttributes ?? []
    if (sourceNode.dataAttributes.length !== contractAttributes.length) return false
    if (!sourceNode.dataAttributes.every((attribute, index) => {
      const candidate = comparableIndependentAttribute(contractAttributes[index])
      if (attribute.name !== candidate.name) return false
      if (attribute.source === "other") return true
      return JSON.stringify(comparableIndependentAttribute(attribute)) === JSON.stringify(candidate)
    })) return false
    const contractChildren = contractNode.children ?? []
    if (sourceNode.children.length !== contractChildren.length) return false
    return sourceNode.children.every((child, index) => {
      const contractChild = contractChildren[index]
      if (JSON.stringify(normalizedPredicate(child.when ?? { otherwise: true })) !== JSON.stringify(normalizedPredicate(contractChild.when ?? { otherwise: true }))) return false
      return typeof contractChild.nodeId === "string" && compareNode(child.node, contractChild.nodeId)
    })
  }
  return typeof rendering.rootNodeId === "string"
    && compareNode(source, rendering.rootNodeId)
    && visited.size === nodes.size
}

function directTokenEvidence(text: string, tokenIds: Set<string>): Set<string> {
  const result = new Set<string>()
  const hasClass = (value: string): boolean => {
    const index = text.indexOf(value)
    if (index < 0) return false
    const before = text[index - 1]
    const after = text[index + value.length]
    return !before || !/[A-Za-z0-9_-]/.test(before) ? (!after || !/[A-Za-z0-9_-]/.test(after)) : false
  }
  for (const tokenId of tokenIds) {
    const [category, name] = tokenId.split(".")
    let found = false
    if (category === "color") {
      found = ["bg-", "text-", "border-", "ring-", "fill-", "stroke-", "outline-", "placeholder:text-"]
        .some((prefix) => hasClass(`${prefix}${name}`))
    } else if (tokenId === "font.heading") {
      found = hasClass("font-heading")
    } else if (category === "font-size") {
      found = hasClass(`text-${name}`)
    } else if (category === "font-weight") {
      found = hasClass(`font-${name}`)
    } else if (category === "letter-spacing") {
      found = hasClass(`tracking-${name}`)
    } else if (category === "radius") {
      found = hasClass(`rounded-${name}`)
    } else if (category === "shadow") {
      found = hasClass(`shadow-${name}`)
    } else if (category === "spacing") {
      found = /(?:^|[^A-Za-z0-9_-])(?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy]|inset|top|right|bottom|left|h|w|size|translate)-(?:\d+(?:\.\d+)?|\[[^\]]+\]|\([^)]*\))(?:$|[^A-Za-z0-9_-])/.test(text)
    }
    if (found) result.add(tokenId)
  }
  return result
}

function sourceDeclarationContext(artifact: AnyRecord): DeclarationContext | undefined {
  const declarationPath = artifact.source?.declarationPath
  if (typeof declarationPath !== "string") return undefined
  const cacheKey = `${declarationPath}:${artifact.source.symbol}`
  if (declarationCache.has(cacheKey)) return declarationCache.get(cacheKey)
  const absolutePath = resolve(root, declarationPath)
  const sourceFile = declarationProgramCache?.program.getSourceFile(absolutePath)
  const checker = declarationProgramCache?.checker
  if (!sourceFile) {
    declarationCache.set(cacheKey, undefined)
    return undefined
  }
  let propsType: ts.Type | undefined
  if (artifact.source.kind === "package-declaration") {
    const moduleSymbol = (sourceFile as ts.SourceFile & { symbol?: ts.Symbol }).symbol
    const [exportName, ...members] = artifact.source.symbol.split(".") as string[]
    let symbol = moduleSymbol && checker!.getExportsOfModule(moduleSymbol).find((item) => item.name === exportName)
    let componentType = symbol && checker!.getTypeOfSymbolAtLocation(symbol, sourceFile)
    for (const member of members) {
      symbol = componentType && checker!.getPropertyOfType(componentType, member)
      componentType = symbol && checker!.getTypeOfSymbolAtLocation(symbol, sourceFile)
    }
    const signature = componentType && checker!.getSignaturesOfType(componentType, ts.SignatureKind.Call)[0]
    const propsParameter = signature?.parameters[0]
    if (propsParameter) propsType = checker!.getTypeOfSymbolAtLocation(propsParameter, sourceFile)
    else if (symbol) propsType = checker!.getDeclaredTypeOfSymbol(symbol)
  } else {
    const tagMatch = /\["([^\"]+)"\]$/.exec(artifact.source.symbol ?? "")
    const visit = (node: ts.Node): void => {
      if (propsType || !ts.isInterfaceDeclaration(node) || node.name.text !== "IntrinsicElements" || !tagMatch) {
        node.forEachChild(visit)
        return
      }
      const member = node.members.find((item): item is ts.PropertySignature => ts.isPropertySignature(item) && propertyName(item.name) === tagMatch[1])
      if (member) propsType = checker!.getTypeAtLocation(member)
    }
    sourceFile.forEachChild(visit)
  }
  const result = propsType ? { checker: checker!, sourceFile, propsType } : undefined
  declarationCache.set(cacheKey, result)
  return result
}

function comparableIndependentType(type: IndependentStructuredType): IndependentStructuredType {
  if (type.kind === "enum") return { kind: "enum", values: [...type.values].sort() }
  if (type.kind === "typescript") return { kind: "typescript", typeText: type.typeText.replaceAll("React.", "").replace(/\s+/g, "") }
  return type
}

function propertySymbols(checker: ts.TypeChecker, type: ts.Type, name: string): ts.Symbol[] {
  if (type.isUnionOrIntersection()) return type.types.flatMap((member) => propertySymbols(checker, member, name))
  const symbol = checker.getPropertyOfType(type, name)
  return symbol ? [symbol] : []
}

function uniqueSymbols(symbols: ts.Symbol[]): ts.Symbol[] {
  return symbols.filter((symbol, index) => symbols.findIndex((candidate) => candidate === symbol) === index)
}

function stringLiteralValues(type: ts.Type): string[] {
  if (type.isUnion()) return type.types.flatMap(stringLiteralValues)
  return type.isStringLiteral() ? [type.value] : []
}

function createDeclarationProgram(interfaces: AnyRecord[]): DeclarationProgram {
  const declarationPaths = [...new Set(interfaces.map((artifact) => artifact.source?.declarationPath))]
    .filter((path): path is string => typeof path === "string")
    .map((path) => resolve(root, path))
  const program = ts.createProgram(declarationPaths, {
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  })
  return { program, checker: program.getTypeChecker() }
}

function createComponentProgram(families: AnyRecord[]): DeclarationProgram {
  const sourcePaths = families.map((family) => resolve(root, family.source.canonicalPath))
  const program = ts.createProgram(sourcePaths, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    baseUrl: root,
    paths: { "@/*": ["src/*"] },
  })
  return { program, checker: program.getTypeChecker() }
}

function directDeclarationErrors(interfaces: AnyRecord[]): string[] {
  const errors: string[] = []
  if (!declarationProgramCache) declarationProgramCache = createDeclarationProgram(interfaces)
  for (const artifact of interfaces) {
    const declarationPath = resolve(root, artifact.source.declarationPath)
    if (!existsSync(declarationPath)) errors.push(`${artifact.id}: declaration file cannot be read`)
    if (hashFile(declarationPath) !== artifact.source.declarationSha256) errors.push(`${artifact.id}: declaration hash mismatch`)
    const context = sourceDeclarationContext(artifact)
    if (!context) {
      errors.push(`${artifact.id}: declaration symbol cannot be resolved independently`)
      continue
    }
    for (const prop of artifact.props ?? []) {
      const actual = uniqueSymbols(propertySymbols(context.checker, context.propsType, prop.name))
      if (!actual.length) {
        errors.push(`${artifact.id}: declared property ${prop.name} is missing from the source type`)
        continue
      }
      const actualTypes = actual.map((symbol) => context.checker.getTypeOfSymbolAtLocation(symbol, context.sourceFile))
      if (prop.type?.kind === "enum") {
        const actualValues = [...new Set(actualTypes.flatMap(stringLiteralValues))].sort()
        if (JSON.stringify(actualValues) !== JSON.stringify([...prop.type.values].sort())) errors.push(`${artifact.id}: enum type mismatch for ${prop.name}`)
      }
      if (["boolean", "string", "number"].includes(prop.type?.kind) && !actualTypes.some((type) => context.checker.typeToString(type) === prop.type.kind)) {
        errors.push(`${artifact.id}: primitive type mismatch for ${prop.name}`)
      }
      const actualRequired = actual.every((symbol) => !Boolean(symbol.flags & ts.SymbolFlags.Optional))
      if (typeof prop.required === "boolean" && actualRequired !== prop.required) errors.push(`${artifact.id}: requiredness mismatch for ${prop.name}`)
    }
    for (const event of artifact.events ?? []) {
      const actual = uniqueSymbols(propertySymbols(context.checker, context.propsType, event.propName))
      if (!actual.length) {
        errors.push(`${artifact.id}: declared event ${event.propName} is missing from the source type`)
        continue
      }
      const payloadTypes = actual.flatMap((symbol) => context.checker.getSignaturesOfType(context.checker.getTypeOfSymbolAtLocation(symbol, context.sourceFile), ts.SignatureKind.Call)[0]?.parameters[0] ?? [])
        .map((parameter) => context.checker.getTypeOfSymbolAtLocation(parameter, context.sourceFile))
      if (!payloadTypes.length) errors.push(`${artifact.id}: event ${event.propName} has no source payload`)
      const actualRequired = actual.every((symbol) => !Boolean(symbol.flags & ts.SymbolFlags.Optional))
      if (typeof event.required === "boolean" && actualRequired !== event.required) errors.push(`${artifact.id}: event requiredness mismatch for ${event.propName}`)
    }
  }
  return errors
}

function directSourceErrors(families: AnyRecord[], interfaces: AnyRecord[]): string[] {
  const errors: string[] = []
  const interfaceById = new Map(interfaces.map((artifact) => [artifact.id, artifact]))

  for (const family of families) {
    const sourcePath = resolve(root, family.source.canonicalPath)
    const { sourceFile } = sourceFacts(sourcePath)
    const actualExports = exportedNames(sourceFile)
    const expectedExports = (family.exports ?? []).map((item: AnyRecord) => item.name).sort()
    if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) {
      errors.push(`${family.id}: public export set differs from the canonical AST`)
    }
    for (const exported of family.exports ?? []) {
      const declaration = declarationFor(sourceFile, exported.name)
      if (!declaration) {
        errors.push(`${family.id}.${exported.name}: exported declaration is missing from the canonical AST`)
        continue
      }
      const hasJsx = !!functionLikeFor(declaration) && jsxNodes(functionLikeFor(declaration)!).length > 0
      const expectedKind = hasJsx ? "component" : /^use[A-Z]/.test(exported.name) ? "hook" : "helper"
      if (exported.kind !== expectedKind || exported.authorableJsx !== hasJsx) {
        errors.push(`${family.id}.${exported.name}: independent export classification differs`)
      }
      if (!exported.component) continue
      const source = componentSourceFacts(sourceFile, declaration)
      if (source.propSurfaceError) errors.push(`${family.id}.${exported.name}: ${source.propSurfaceError}`)
      const variants = cvaFacts(sourceFile, source.sourceText)
      const sourceProps = new Set([...source.bindings].filter((name) => !source.restBindings.has(name)).concat([...source.typeFacts.keys(), ...variants.variants.keys()]))
      const contractedLocalProps = new Map<string, AnyRecord>((exported.component.localProps ?? []).map((prop: AnyRecord) => [prop.name, prop]))
      for (const [name, sourceFact] of source.localPropFacts) {
        const localProp = contractedLocalProps.get(name)
        if (!localProp) {
          errors.push(`${family.id}.${exported.name}: source local prop ${name} is omitted from the contract`)
          continue
        }
        if (localProp.required !== sourceFact.required) errors.push(`${family.id}.${exported.name}: requiredness for ${name} differs from source`)
        if (JSON.stringify(comparableIndependentType(localProp.type)) !== JSON.stringify(comparableIndependentType(sourceFact.type))) {
          const message = localProp.type?.kind === "enum"
            ? `enum values for ${name} differ from source literals`
            : `type for ${name} differs from source`
          errors.push(`${family.id}.${exported.name}: ${message}`)
        }
        const contractHasDefault = Object.hasOwn(localProp, "default")
        if (contractHasDefault !== sourceFact.hasDefault) errors.push(`${family.id}.${exported.name}: default presence for ${name} differs from source`)
        else if (contractHasDefault && localProp.default !== sourceFact.default) errors.push(`${family.id}.${exported.name}: default for ${name} differs from source`)
      }
      for (const name of contractedLocalProps.keys()) {
        if (!source.localPropFacts.has(name)) errors.push(`${family.id}.${exported.name}: contract local prop ${name} is absent from the source-local signature`)
      }

      const inheritedProps = new Set<string>()
      for (const interfaceId of exported.component.inherits ?? []) {
        const inherited = interfaceById.get(interfaceId)
        const context = inherited && sourceDeclarationContext(inherited)
        if (!context) {
          errors.push(`${family.id}.${exported.name}: inherited prop surface ${interfaceId} cannot be resolved independently`)
          continue
        }
        for (const prop of context.checker.getPropertiesOfType(context.propsType)) inheritedProps.add(prop.name)
      }
      const hasAsChild = inheritedProps.has("asChild") || sourceProps.has("asChild")
      const slots = exported.component.slots ?? []
      if (source.directUsesSlot && !slots.some((slot: AnyRecord) => slot.propName === "asChild")) {
        errors.push(`${family.id}.${exported.name}: source uses Slot.Root without an asChild slot fact`)
      }
      for (const slot of slots) {
        if (slot.propName !== "asChild") errors.push(`${family.id}.${exported.name}: unsupported slot prop ${slot.propName}`)
        if (!hasAsChild) errors.push(`${family.id}.${exported.name}: asChild slot lacks independent interface/signature evidence`)
        if (slot.childCardinality?.min !== 0 || slot.childCardinality?.max !== 1) errors.push(`${family.id}.${exported.name}: invalid asChild child cardinality`)
        if (slot.forwardsProps !== true || !slot.evidenceRefs?.includes("source")) errors.push(`${family.id}.${exported.name}: incomplete asChild forwarding evidence`)
        if (source.propSpreadCount === 0) errors.push(`${family.id}.${exported.name}: asChild slot has no public props spread in source`)
      }

      const contractTokenIds = new Set<string>((exported.component.tokenDependencies ?? []).map((dependency: AnyRecord) => dependency.tokenId))
      const tokenText = `${source.sourceText}\n${variants.texts.join("\n")}`
      const sourceTokenIds = directTokenEvidence(tokenText, approvedTokenIds)
      for (const tokenId of contractTokenIds) {
        if (!sourceTokenIds.has(tokenId)) errors.push(`${family.id}.${exported.name}: token ${tokenId} has no direct source expression`)
      }
      for (const tokenId of sourceTokenIds) {
        if (!contractTokenIds.has(tokenId)) errors.push(`${family.id}.${exported.name}: source token ${tokenId} is omitted from the contract`)
      }
      for (const token of exported.component.tokenDependencies ?? []) {
        if (!token.evidenceRefs?.includes("source") || !token.evidenceRefs?.includes("tokens")) errors.push(`${family.id}.${exported.name}: token evidence is incomplete`)
      }

      const directDataAttributes = source.dataAttributes
      const directAttributeNames = [...new Set(directDataAttributes.map((attribute) => attribute.name))].sort()
      const contractAttributes = renderingAttributes(exported.component)
      const contractAttributeNames = [...new Set(contractAttributes.map((attribute) => attribute.name))].sort()
      if (JSON.stringify(directAttributeNames) !== JSON.stringify(contractAttributeNames)) {
        errors.push(`${family.id}.${exported.name}: data attribute names differ from the canonical JSX`)
      }
      for (const attribute of directDataAttributes) {
        const matching = contractAttributes.filter((candidate) => candidate.name === attribute.name)
        if (!matching.length) continue
        if (attribute.expressionKind === "literal" && !matching.some((candidate) => candidate.value === attribute.value)) {
          errors.push(`${family.id}.${exported.name}: literal ${attribute.name} value is omitted`)
        }
        if (attribute.expressionKind === "conditional" && !matching.some((candidate) => ["conditional-value", "derived-condition"].includes(candidate.source))) {
          errors.push(`${family.id}.${exported.name}: conditional ${attribute.name} fact is omitted`)
        }
        if (attribute.expressionKind === "identifier" && !matching.some((candidate) => ["prop", "primitive-state"].includes(candidate.source))) {
          errors.push(`${family.id}.${exported.name}: derived ${attribute.name} target is omitted`)
        }
        if (attribute.expressionKind === "other" && !matching.some((candidate) => candidate.source === "derived-condition")) errors.push(`${family.id}.${exported.name}: unresolved data attribute expression ${attribute.name}`)
      }
      const directSlotValues = [...new Set(directDataAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.value))].sort()
      const contractSlotValues = [...new Set(contractAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.value))].sort()
      if (JSON.stringify(directSlotValues) !== JSON.stringify(contractSlotValues)) {
        errors.push(`${family.id}.${exported.name}: data-slot values differ from the canonical JSX`)
      }

      const variantsToCheck = renderings(exported.component)
      if (!variantsToCheck.length) errors.push(`${family.id}.${exported.name}: render tree is missing`)
      if (source.renderAlternativePredicates.length || "alternatives" in exported.component.rendering) {
        const contractPredicates = "alternatives" in exported.component.rendering
          ? exported.component.rendering.alternatives.map((alternative: AnyRecord) => normalizedPredicate(alternative.when ?? { otherwise: true }))
          : []
        const sourcePredicates = source.renderAlternativePredicates.map(normalizedPredicate)
        const predicatesMatch = JSON.stringify(contractPredicates) === JSON.stringify(sourcePredicates)
        if (!predicatesMatch) errors.push(`${family.id}.${exported.name}: render alternative predicates differ from the canonical AST`)
        if (predicatesMatch && "alternatives" in exported.component.rendering) {
          exported.component.rendering.alternatives.forEach((alternative: AnyRecord, index: number) => {
            const sourceTree = source.renderBranches[index]?.tree
            if (!sourceTree || !independentRenderTreeMatches(sourceTree, alternative.rendering)) {
              errors.push(`${family.id}.${exported.name}: render alternative tree ${index} differs from the canonical AST`)
            }
          })
        }
      }
      const expectedPortalCount = source.portalCount
      const actualPortalCount = variantsToCheck.reduce((count, rendering) => count + (rendering.portalBoundaries ?? []).length, 0)
      if (expectedPortalCount !== actualPortalCount) errors.push(`${family.id}.${exported.name}: portal count differs from canonical JSX`)
      for (const rendering of variantsToCheck) {
        const nodes = rendering.nodes ?? []
        const nodeIds = new Set(nodes.map((node: AnyRecord) => node.id))
        if (!nodeIds.has(rendering.rootNodeId) || !nodeIds.has(rendering.publicPropsTargetNodeId)) {
          errors.push(`${family.id}.${exported.name}: render root or props target is dangling`)
        }
        const target = nodes.find((node: AnyRecord) => node.id === rendering.publicPropsTargetNodeId)
        if (!target?.receivesPublicProps) errors.push(`${family.id}.${exported.name}: public props target does not receive props`)
        for (const node of nodes) {
          const childIds: string[] = []
          collectChildIds(node, childIds)
          if (childIds.some((childId) => !nodeIds.has(childId))) errors.push(`${family.id}.${exported.name}: render child target is dangling`)
        }
        for (const boundary of rendering.portalBoundaries ?? []) {
          if (!nodeIds.has(boundary.nodeId)) errors.push(`${family.id}.${exported.name}: portal boundary target is dangling`)
        }
        const knownHostTags = renderingHostTags(exported.component)
        for (const tag of knownHostTags) {
          if (!source.jsx.some((node) => jsxTag(node) === tag) && !source.sourceText.includes(`: "${tag}"`) && !source.sourceText.includes(`: \"${tag}\"`)) {
            errors.push(`${family.id}.${exported.name}: intrinsic host ${tag} is absent from source`)
          }
        }
      }
      for (const repeated of source.mappedRenderEvidence) {
        const trees = renderings(exported.component)
        const repeatedNodes = trees.flatMap((rendering) => rendering.nodes ?? []).filter((node: AnyRecord) => {
          const slot = (node.dataAttributes ?? []).find((attribute: AnyRecord) => attribute.name === "data-slot" && attribute.source === "literal")?.value
          return repeated.slot ? slot === repeated.slot : independentHostMatches(repeated.tag, node.host)
        })
        if (!repeatedNodes.some((node: AnyRecord) => independentHostMatches(repeated.tag, node.host))) {
          errors.push(`${family.id}.${exported.name}: repeated JSX host ${repeated.tag} differs from the contract`)
          continue
        }
        if (repeated.parentSlot && repeated.slot) {
          const linked = trees.some((rendering) => {
            const nodes = rendering.nodes ?? []
            const parent = nodes.find((node: AnyRecord) => (node.dataAttributes ?? []).some((attribute: AnyRecord) => attribute.name === "data-slot" && attribute.source === "literal" && attribute.value === repeated.parentSlot))
            const children = new Set((parent?.children ?? []).map((child: AnyRecord) => child.nodeId))
            return repeatedNodes.some((node: AnyRecord) => children.has(node.id))
          })
          if (!linked) errors.push(`${family.id}.${exported.name}: repeated JSX child ${repeated.slot} is omitted from the contract render edges`)
        }
      }
      if (source.propSpreadCount === 0) errors.push(`${family.id}.${exported.name}: public props spread is absent from source`)
    }
    if ((family.unresolved ?? []).length !== 0) errors.push(`${family.id}: contract contains unresolved source facts the direct audit did not find`)
  }
  return errors
}

function independentAudit(artifacts: { families: AnyRecord[]; interfaces: AnyRecord[] }): string[] {
  const errors: string[] = []
  const familyIds = artifacts.families.map((family) => family.id).sort()
  if (JSON.stringify(familyIds) !== JSON.stringify(expectedFamilies)) errors.push("physical family artifacts do not match the independently approved release scope")
  if (artifacts.families.length !== expectedFamilies.length) errors.push(`expected ${expectedFamilies.length} family artifacts, found ${artifacts.families.length}`)
  if (!["candidate", "approved"].includes(readJson(join(root, "contracts/components/component-contract-set.json")).status)) errors.push("component contract set has an invalid lifecycle status")
  errors.push(...directDeclarationErrors(artifacts.interfaces))
  errors.push(...directSourceErrors(artifacts.families, artifacts.interfaces))

  const evidenceReferences = collectEvidenceReferences(artifacts)
  for (const [kind, artifactList] of [["family", artifacts.families], ["interface", artifacts.interfaces]] as const) {
    for (const artifact of artifactList) {
      const availableEvidence = new Set(Object.keys(artifact.evidence ?? {}).filter((key) => artifact.evidence[key]))
      if (kind === "interface") availableEvidence.add("declaration")
      const localReferences = new Set<string>()
      collectEvidenceReferences(artifact, localReferences)
      for (const reference of localReferences) {
        if (!availableEvidence.has(reference)) errors.push(`${kind}:${artifact.id}:${reference} evidence reference has no authority record`)
      }
      for (const key of Object.keys(artifact.evidence ?? {})) {
        if (!evidenceReferences.has(key)) errors.push(`${kind}:${artifact.id}:${key} is unreferenced evidence`)
      }
    }
  }
  return errors
}

function collectEvidenceReferences(value: unknown, references: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceReferences(item, references)
    return references
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "evidenceRefs" && Array.isArray(child)) {
        for (const reference of child) references.add(String(reference))
      } else {
        collectEvidenceReferences(child, references)
      }
    }
  }

  return references
}

function findUnreferencedEvidence(): string[] {
  const artifacts = [
    ...readdirSync(familyDirectory).filter((file) => file.endsWith(".json")).map((file) => ["family", file] as const),
    ...readdirSync(interfaceDirectory).filter((file) => file.endsWith(".json")).map((file) => ["interface", file] as const),
  ]
  const references = new Set<string>()
  const records: string[] = []

  for (const [kind, file] of artifacts) {
    const artifact = readJson(join(kind === "family" ? familyDirectory : interfaceDirectory, file))
    const artifactReferences = collectEvidenceReferences(artifact)
    for (const reference of artifactReferences) references.add(reference)

    for (const evidenceKey of Object.keys(artifact.evidence ?? {})) {
      if (!artifactReferences.has(evidenceKey)) records.push(`${file}:${evidenceKey}`)
    }
  }

  return records
}

declarationProgramCache = createDeclarationProgram(loadArtifacts().interfaces)
componentProgramCache = createComponentProgram(loadArtifacts().families)

describe("Phase 3 Task 10 independent review", () => {
  test("matches the independent 38-family oracle to the manifest and physical artifacts", () => {
    const manifest = readJson(join(root, "contracts/components/component-contract-set.json"))
    const manifestIds = manifest.familyFiles.map((path: string) => path.split("/").at(-1)!.replace(/\.json$/, "")).sort()
    const physicalIds = loadArtifacts().families.map((family) => family.id).sort()

    expect(manifest.familyCount).toBe(expectedFamilies.length)
    expect(manifestIds).toEqual(expectedFamilies)
    expect(physicalIds).toEqual(expectedFamilies)
  })

  test("audits every inherited interface through independent declaration access", () => {
    expect(directDeclarationErrors(loadArtifacts().interfaces)).toEqual([])
  })

  test.each(["empty", "group", "input", "item", "list", "separator"])("independently resolves the cmdk Command.%s declaration", (member) => {
    const artifact = interfaceById(loadArtifacts(), `cmdk.command.${member}`)
    const context = sourceDeclarationContext(artifact)
    expect(context).toBeDefined()
    expect(directDeclarationErrors([artifact])).toEqual([])
  })

  test("rejects missing cmdk static members instead of resolving them as Command", () => {
    const artifact = clone(interfaceById(loadArtifacts(), "cmdk.command.input"))
    artifact.source.symbol = "Command.Missing"
    expect(sourceDeclarationContext(artifact)).toBeUndefined()
  })

  test.each([["content", 274], ["overlay", 267], ["portal", 3]])("independently resolves Vaul %s props through its React default import", (member, count) => {
    const context = sourceDeclarationContext(interfaceById(loadArtifacts(), `vaul.drawer.${member}`))!
    expect(context.checker.getPropertiesOfType(context.propsType)).toHaveLength(count as number)
  })

  test("independently resolves composed local prop surfaces and delegated defaults", () => {
    const facts = (id: string, exportName: string) => {
      const { sourceFile } = sourceFacts(join(root, "src/components/ui", `${id}.tsx`))
      return componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
    }

    const action = facts("alert-dialog", "AlertDialogAction")
    expect(action.typeFacts.get("variant")?.values).toEqual(["default", "destructive", "ghost", "link", "outline", "secondary"])
    expect(action.typeFacts.get("size")?.values).toEqual(["default", "icon", "icon-lg", "icon-sm", "icon-xs", "lg", "sm", "xs"])

    const inputGroupButton = facts("input-group", "InputGroupButton")
    expect(inputGroupButton.typeFacts.get("asChild")?.typeText).toBe("boolean | undefined")
    expect(inputGroupButton.typeFacts.get("size")?.values).toEqual(["icon-sm", "icon-xs", "sm", "xs"])
    expect(inputGroupButton.bindingDefaults.get("asChild")).toBe(false)

    const previous = facts("pagination", "PaginationPrevious")
    expect(previous.typeFacts.get("isActive")?.typeText).toBe("boolean | undefined")
    expect(previous.typeFacts.get("size")?.values).toEqual(["default", "icon", "icon-lg", "icon-sm", "icon-xs", "lg", "sm", "xs"])
    expect(previous.bindingDefaults.get("size")).toBe("default")
  })

  test("independent local-prop comparison catches exact composed-surface mutations", () => {
    const artifacts = clone(loadArtifacts())
    const previous = exportByName(familyById(artifacts, "pagination"), "PaginationPrevious").component
    previous.localProps = previous.localProps.filter((prop: AnyRecord) => prop.name !== "isActive")
    previous.localProps.find((prop: AnyRecord) => prop.name === "size").default = "icon"
    previous.localProps.find((prop: AnyRecord) => prop.name === "size").type.values = ["default"]

    const findings = directSourceErrors(artifacts.families, artifacts.interfaces)
    expect(findings).toContain("pagination.PaginationPrevious: source local prop isActive is omitted from the contract")
    expect(findings).toContain("pagination.PaginationPrevious: enum values for size differ from source literals")
    expect(findings).toContain("pagination.PaginationPrevious: default for size differs from source")
  })

  test("independent local-prop comparison rejects forged inheritance over an omitted local", () => {
    const artifacts = clone(loadArtifacts())
    const previous = exportByName(familyById(artifacts, "pagination"), "PaginationPrevious").component
    previous.localProps = previous.localProps.filter((prop: AnyRecord) => prop.name !== "size")
    previous.inherits.push("html.input")

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(
      "pagination.PaginationPrevious: source local prop size is omitted from the contract",
    )
  })

  test("independently preserves cross-file authored type provenance", () => {
    const fixturePath = join(root, "tests/fixtures/component-prop-source-analysis-parent-fixture.tsx")
    const fixtureProgram = ts.createProgram([fixturePath], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
    })
    const previousProgram = componentProgramCache
    componentProgramCache = { program: fixtureProgram, checker: fixtureProgram.getTypeChecker() }
    sourceCache.delete(fixturePath)
    try {
      const { sourceFile } = sourceFacts(fixturePath)
      const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "CrossFileWrapper")!)
      expect(facts.localPropFacts.get("payload")?.type).toEqual({ kind: "typescript", typeText: "Promise<string>" })
    } finally {
      componentProgramCache = previousProgram
      sourceCache.delete(fixturePath)
    }
  })

  test.each([
    ["wrong string type", (component: AnyRecord) => { component.localProps.find((prop: AnyRecord) => prop.name === "text").type = { kind: "number" } }, "pagination.PaginationPrevious: type for text differs from source"],
    ["requiredness flip", (component: AnyRecord) => { component.localProps.find((prop: AnyRecord) => prop.name === "isActive").required = true }, "pagination.PaginationPrevious: requiredness for isActive differs from source"],
    ["deleted default", (component: AnyRecord) => { delete component.localProps.find((prop: AnyRecord) => prop.name === "size").default }, "pagination.PaginationPrevious: default presence for size differs from source"],
    ["inherited DOM prop labeled local", (component: AnyRecord, artifacts: { interfaces: AnyRecord[] }) => {
      component.localProps.push(clone(interfaceById({ interfaces: artifacts.interfaces }, "html.a").props.find((prop: AnyRecord) => prop.name === "href")))
    }, "pagination.PaginationPrevious: contract local prop href is absent from the source-local signature"],
  ])("independent exact local oracle rejects %s", (_name, mutate, expected) => {
    const artifacts = clone(loadArtifacts())
    const previous = exportByName(familyById(artifacts, "pagination"), "PaginationPrevious").component
    mutate(previous, artifacts)

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(expected)
  })

  test("independent prop analysis fails closed for an any-typed surface", () => {
    const fixturePath = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const fixtureProgram = ts.createProgram([fixturePath], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
    })
    const previousProgram = componentProgramCache
    componentProgramCache = { program: fixtureProgram, checker: fixtureProgram.getTypeChecker() }
    sourceCache.delete(fixturePath)
    try {
      const { sourceFile } = sourceFacts(fixturePath)
      const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "AnyPropsFixture")!)
      expect(facts.typeFacts.size).toBe(0)
      expect(facts.propSurfaceError).toBe("component props type is any")
    } finally {
      componentProgramCache = previousProgram
      sourceCache.delete(fixturePath)
    }
  })

  test.each([
    ["UnknownPropsFixture", "component props type cannot be resolved"],
    ["PickAnyPropsFixture", "component props type contains unsafe any or unknown authority"],
    ["VariantAnyPropsFixture", "component props type contains unsafe any or unknown authority"],
  ])("independent prop analysis fails closed for %s", (exportName, reason) => {
    const fixturePath = join(root, "tests/fixtures/component-prop-source-analysis-fixture.tsx")
    const fixtureProgram = ts.createProgram([fixturePath], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
    })
    const previousProgram = componentProgramCache
    componentProgramCache = { program: fixtureProgram, checker: fixtureProgram.getTypeChecker() }
    sourceCache.delete(fixturePath)
    try {
      const { sourceFile } = sourceFacts(fixturePath)
      const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      expect(facts.typeFacts.size).toBe(0)
      expect(facts.propSurfaceError).toBe(reason)
    } finally {
      componentProgramCache = previousProgram
      sourceCache.delete(fixturePath)
    }
  })

  test("independently traverses mapped Slider JSX with host, slot, parent, and repetition evidence", () => {
    const { sourceFile } = sourceFacts(join(root, "src/components/ui/slider.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "Slider")!)
    const tags = facts.jsx.map(jsxTag)
    const slots = facts.dataAttributes
      .filter((attribute) => attribute.name === "data-slot")
      .map((attribute) => attribute.value)

    expect(tags).toContain("SliderPrimitive.Thumb")
    expect(slots).toEqual(expect.arrayContaining(["slider", "slider-track", "slider-range", "slider-thumb"]))

    const thumb = facts.jsx.find((node) => jsxTag(node) === "SliderPrimitive.Thumb")!
    let current: ts.Node | undefined = thumb
    let mapCall: ts.CallExpression | undefined
    let parentHost: ts.JsxElement | undefined
    while (current) {
      if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "map") mapCall = current
      if (mapCall && ts.isJsxElement(current) && jsxTag(current) === "SliderPrimitive.Root") parentHost = current
      current = current.parent
    }
    expect(mapCall?.expression.getText(sourceFile)).toBe("values.map")
    expect(parentHost && jsxTag(parentHost)).toBe("SliderPrimitive.Root")
  })

  test.each([
    ["child edge", (component: AnyRecord) => {
      const root = component.rendering.nodes.find((node: AnyRecord) => node.id === "root")
      root.children = root.children.filter((child: AnyRecord) => child.nodeId !== "thumb")
    }, "slider.Slider: repeated JSX child slider-thumb is omitted from the contract render edges"],
    ["host", (component: AnyRecord) => {
      component.rendering.nodes.find((node: AnyRecord) => node.id === "thumb").host.interfaceId = "radix.slider.track"
    }, "slider.Slider: repeated JSX host SliderPrimitive.Thumb differs from the contract"],
  ])("independent mapped-render oracle rejects a mutated %s", (_name, mutate, expected) => {
    const artifacts = clone(loadArtifacts())
    mutate(exportByName(familyById(artifacts, "slider"), "Slider").component)

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(expected)
  })

  test("independent conditional-render oracle rejects a mutated branch predicate", () => {
    const artifacts = clone(loadArtifacts())
    const link = exportByName(familyById(artifacts, "breadcrumb"), "BreadcrumbLink").component
    link.rendering.alternatives[0].when = { propName: "asChild", equals: false }

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(
      "breadcrumb.BreadcrumbLink: render alternative predicates differ from the canonical AST",
    )
  })

  test("independent conditional-render oracle rejects an omitted whole branch", () => {
    const artifacts = clone(loadArtifacts())
    const link = exportByName(familyById(artifacts, "breadcrumb"), "BreadcrumbLink").component
    link.rendering = link.rendering.alternatives[1].rendering

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(
      "breadcrumb.BreadcrumbLink: render alternative predicates differ from the canonical AST",
    )
  })

  test("independent conditional-render oracle binds each predicate to its own tree", () => {
    const artifacts = clone(loadArtifacts())
    const link = exportByName(familyById(artifacts, "breadcrumb"), "BreadcrumbLink").component
    ;[link.rendering.alternatives[0].rendering, link.rendering.alternatives[1].rendering] = [link.rendering.alternatives[1].rendering, link.rendering.alternatives[0].rendering]

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContain(
      "breadcrumb.BreadcrumbLink: render alternative tree 0 differs from the canonical AST",
    )
  })

  test("independent branch-tree oracle rejects a portal and conditional host moved to the wrong predicate", () => {
    const { sourceFile } = sourceFacts(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "NestedHostPortalFixture")!)
    const rendering = (host: AnyRecord, portal: boolean): AnyRecord => ({
      rootNodeId: "host",
      publicPropsTargetNodeId: "host",
      nodes: [{
        id: "host",
        host,
        receivesPublicProps: true,
        dataAttributes: [{ name: "data-slot", source: "literal", value: "nested-portal" }],
        children: [],
      }],
      portalBoundaries: portal ? [{ nodeId: "host" }] : [],
    })
    const portalRendering = rendering({ kind: "unresolved" }, true)
    const divRendering = rendering({ kind: "intrinsic", tag: "div" }, false)

    expect(independentRenderTreeMatches(facts.renderBranches[1].tree!, portalRendering)).toBe(true)
    expect(independentRenderTreeMatches(facts.renderBranches[2].tree!, divRendering)).toBe(true)
    expect(independentRenderTreeMatches(facts.renderBranches[1].tree!, divRendering)).toBe(false)
    expect(independentRenderTreeMatches(facts.renderBranches[2].tree!, portalRendering)).toBe(false)
  })

  test("independent conjunction canonicalization rejects complements and deduplicates identical atoms", () => {
    const enabled = { propName: "enabled", equals: true }

    expect(combineIndependentRenderConditions(enabled, enabled)).toEqual(enabled)
    expect(combineIndependentRenderConditions(enabled, { propName: "enabled", equals: false })).toBeUndefined()
  })

  test("independently distinguishes nullishness from truthiness, including falsy non-nullish values", () => {
    const { sourceFile } = sourceFacts(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "NullishChildFixture")!)

    expect(facts.renderAlternativePredicates).toEqual([
      { propName: "children", nullishness: "non-nullish" },
      { propName: "children", nullishness: "nullish" },
    ])
  })

  test("independently retains compound outer-return and conditional-host predicates", () => {
    const { sourceFile } = sourceFacts(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "NestedHostPortalFixture")!)

    expect(facts.renderAlternativePredicates).toEqual([
      { propName: "enabled", truthiness: "falsy" },
      { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: true }] },
      { all: [{ propName: "enabled", truthiness: "truthy" }, { propName: "asChild", equals: false }] },
    ])
  })

  test("has no unreferenced evidence records", () => {
    expect(findUnreferencedEvidence()).toEqual([])
  })

  test("audits the independently approved 38-family scope through direct AST and declaration access", () => {
    expect(independentAudit(loadArtifacts())).toEqual([])
  })

  test("does not share the production analyzer oracle", () => {
    const testSource = readFileSync(__filename, "utf8")
    expect(testSource).not.toMatch(/src\/contracts\/components\/(?:canonical|render|inherited|.*analysis|.*reconciliation)/)
    expect(testSource).not.toMatch(/component-(?:source|token)-analysis/)
  })

  test("fails on adversarial omissions and mutations", () => {
    const cases: Array<[string, (artifacts: { families: AnyRecord[]; interfaces: AnyRecord[] }) => void]> = [
      ["public export", (artifacts) => {
        const family = familyById(artifacts, "button")
        family.exports = family.exports.filter((item: AnyRecord) => item.name !== "Button")
      }],
      ["declaration hash", (artifacts) => {
        interfaceById(artifacts, "radix.dialog.content").source.declarationSha256 = "0".repeat(64)
      }],
      ["local enum", (artifacts) => {
        exportByName(familyById(artifacts, "button"), "Button").component.localProps[0].type.values = ["mutated"]
      }],
      ["slot cardinality", (artifacts) => {
        exportByName(familyById(artifacts, "button"), "Button").component.slots[0].childCardinality.max = 2
      }],
      ["token dependency", (artifacts) => {
        const component = exportByName(familyById(artifacts, "button"), "Button").component
        component.tokenDependencies = component.tokenDependencies.filter((item: AnyRecord) => item.tokenId !== "color.primary")
      }],
      ["render attribute", (artifacts) => {
        const component = exportByName(familyById(artifacts, "button"), "Button").component
        component.rendering.nodes[0].dataAttributes = component.rendering.nodes[0].dataAttributes.filter((item: AnyRecord) => item.name !== "data-size")
      }],
      ["unresolved omission", (artifacts) => {
        familyById(artifacts, "button").unresolved = [{ topic: "mutated", scope: "test", reason: "mutated", evidenceAttempted: [], evidenceRefs: ["source"] }]
      }],
      ["evidence reference", (artifacts) => {
        familyById(artifacts, "button").evidence.source = undefined
      }],
    ]
    for (const [label, mutate] of cases) {
      const artifacts = clone(loadArtifacts())
      mutate(artifacts)
      expect(independentAudit(artifacts), label).not.toEqual([])
    }
  }, 60_000)
})
