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
const independentSeedComponents = Object.values(readJson(join(root, "provenance/seed-components.json")).components) as AnyRecord[]

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
  dataAttributes: Array<{ name: string; value?: unknown; expressionKind: string; expression?: string }>
  portalCount: number
  propSpreadCount: number
  directUsesSlot: boolean
  returnCount: number
  conditionalSource: boolean
  renderAlternativePredicates: AnyRecord[]
  renderBranches: IndependentRenderBranch[]
  renderUnresolved: IndependentRenderUnresolved[]
  mappedRenderEvidence: Array<{ tag: string; parentTag?: string; collection: string; slot?: string; parentSlot?: string }>
  propSurfaceError?: string
  localPropFacts: Map<string, IndependentLocalPropFact>
}

type IndependentRenderUnresolved = {
  sourcePath: string
  start: number
  end: number
  expressionKind: string
  sourceText: string
  reason: string
}

type IndependentRenderNode = {
  tag: string
  resolvedTag?: string
  importBinding?: { importedName: string; moduleSpecifier: string }
  portal: boolean
  receivesPublicProps: boolean
  dataAttributes: Array<{
    name: string
    source: string
    value?: unknown
    prop?: string
    condition?: AnyRecord
    whenTrue?: { source: string; value?: unknown; name?: string }
    whenFalse?: { source: string; value?: unknown; name?: string }
    expression?: string
  }>
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

function independentRenderBranchExpressions(functionLike: ts.FunctionLikeDeclaration, opaqueStateBindings = new Set<string>()): Array<{ predicate: AnyRecord; expression: ts.Expression }> {
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
  const nestedCondition = (expression: ts.Expression, predicate?: AnyRecord): AnyRecord | undefined => {
    const visited = new Set<string>()
    let found: AnyRecord | undefined
    const visit = (node: ts.Node): void => {
      if (found || ts.isJsxAttributes(node)) return
      if (ts.isConditionalExpression(node)) {
        const condition = independentRenderCondition(node.condition, bindings, "boolean")
        const atoms = predicate?.all ?? (predicate ? [predicate] : [])
        const matches = (candidate: AnyRecord) => atoms.some((atom: AnyRecord) => JSON.stringify(normalizedPredicate(atom)) === JSON.stringify(normalizedPredicate(candidate)))
        const inverse = condition && negateIndependentRenderCondition(condition)
        if (condition && matches(condition)) visit(node.whenTrue)
        else if (inverse && matches(inverse)) visit(node.whenFalse)
        else found = condition
        return
      }
      if (ts.isIdentifier(node) && declarations.has(node.text)) {
        const initializer = declarations.get(node.text)!
        const isRootAlias = node === expression
        const isJsxTag = ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent)
        const isJsxAlias = ts.isJsxExpression(node.parent)
        if ((isRootAlias || isJsxTag) && ts.isConditionalExpression(initializer)) {
          visit(initializer)
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
  // Refine each selected host through conditional JSX children and their aliases.
  // Attribute ternaries do not create render branches, and unselected arms must
  // not contribute conditions (e.g. raw HTML only matters while loading).
  const refine = (branch: { predicate: AnyRecord; expression: ts.Expression }): typeof results => {
    const condition = nestedCondition(branch.expression, branch.predicate)
    const inverse = condition && negateIndependentRenderCondition(condition)
    if (!condition || !inverse) return [branch]
    return [condition, inverse].flatMap((atom) => {
      const predicate = combineIndependentRenderConditions(branch.predicate, atom)
      return predicate ? refine({ ...branch, predicate }) : []
    })
  }
  const refinedResults = results.flatMap((branch) => {
    if (!branch.predicate.otherwise) return refine(branch)
    const first = nestedCondition(branch.expression)
    const inverse = first && negateIndependentRenderCondition(first)
    if (!inverse) return [branch]
    const explicit = { ...branch, predicate: inverse }
    return nestedCondition(branch.expression, inverse) ? refine(explicit) : [branch]
  })
  const renderedResults = refinedResults.filter(({ expression }) => unwrapReturnedExpression(expression).kind !== ts.SyntaxKind.NullKeyword)
  const onlyPredicate = renderedResults[0]?.predicate
  const opaqueSurvivor = renderedResults.length === 1 && onlyPredicate?.source === "state" && opaqueStateBindings.has(onlyPredicate.name)
  return renderedResults.length === 1 && (onlyPredicate.otherwise || opaqueSurvivor) ? [] : renderedResults
}

function renderAlternativePredicates(functionLike: ts.FunctionLikeDeclaration, opaqueStateBindings = new Set<string>()): AnyRecord[] {
  return independentRenderBranchExpressions(functionLike, opaqueStateBindings).map((branch) => branch.predicate)
}

function independentRenderBranches(functionLike: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile, restBindings: Set<string>, opaqueStateBindings = new Set<string>()): IndependentRenderBranch[] {
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
  const renderValue = (expression: ts.Expression): { source: string; value?: unknown; name?: string } | undefined => {
    const value = literalValue(expression)
    if (value !== undefined && value !== null) return { source: "literal", value }
    if (ts.isIdentifier(expression)) return { source: bindings.has(expression.text) ? "prop" : "state", name: expression.text }
    return undefined
  }
  const renderCondition = (expression: ts.Expression): AnyRecord | undefined => {
    const direct = independentRenderCondition(expression, bindings)
    if (direct) return direct
    if (!ts.isBinaryExpression(expression) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(expression.operatorToken.kind)) return undefined
    const leftValue = literalValue(expression.left)
    return ts.isIdentifier(expression.right) && leftValue !== undefined && leftValue !== null
      ? bindings.has(expression.right.text)
        ? { propName: expression.right.text, equals: leftValue }
        : { source: "state", name: expression.right.text, equals: leftValue }
      : undefined
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
      else if (attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isPropertyAccessExpression(attribute.initializer.expression)) {
        let root: ts.Expression = attribute.initializer.expression
        while (ts.isPropertyAccessExpression(root)) root = root.expression
        if (ts.isIdentifier(root)) {
          dataAttributes.push({
            name,
            source: bindings.has(root.text) ? "prop" : "primitive-state",
            prop: attribute.initializer.expression.getText(sourceFile),
          })
        } else {
          dataAttributes.push({ name, source: "unresolved", expression: attribute.initializer.expression.getText(sourceFile) })
        }
      }
      else if (attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isConditionalExpression(attribute.initializer.expression)) {
        const condition = renderCondition(attribute.initializer.expression.condition)
        const whenTrue = renderValue(attribute.initializer.expression.whenTrue)
        const whenFalse = renderValue(attribute.initializer.expression.whenFalse)
        dataAttributes.push(condition && whenTrue && whenFalse
          ? { name, source: "conditional-value", condition, whenTrue, whenFalse }
          : { name, source: "unresolved", expression: attribute.initializer.expression.getText(sourceFile) })
      }
      else if (attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
        const condition = renderCondition(attribute.initializer.expression)
        dataAttributes.push(condition
          ? { name, source: "derived-condition", condition }
          : { name, source: "unresolved", expression: attribute.initializer.expression.getText(sourceFile) })
      }
      else dataAttributes.push({ name, source: "unresolved", expression: "true" })
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
  return independentRenderBranchExpressions(functionLike, opaqueStateBindings).map(({ predicate, expression }) => {
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

function independentNonUndefinedTypes(type: ts.Type): ts.Type[] {
  if (!type.isUnion()) return [type]
  return type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined))
}

function independentEquivalentPropTypes(checker: ts.TypeChecker, left: ts.Type, right: ts.Type): boolean {
  const normalizedLeft = independentNonUndefinedTypes(left)
  const normalizedRight = independentNonUndefinedTypes(right)
  return normalizedLeft.every((leftMember) => normalizedRight.some((rightMember) => checker.isTypeAssignableTo(leftMember, rightMember)))
    && normalizedRight.every((rightMember) => normalizedLeft.some((leftMember) => checker.isTypeAssignableTo(rightMember, leftMember)))
}

function independentInheritedPropNames(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, visited = new Set<ts.Node>()): Set<string> {
  const names = new Set<string>()
  if (!typeNode || visited.has(typeNode)) return names
  visited.add(typeNode)
  if (ts.isParenthesizedTypeNode(typeNode)) return independentInheritedPropNames(typeNode.type, checker, visited)
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) for (const name of independentInheritedPropNames(member, checker, new Set(visited))) names.add(name)
    return names
  }
  if (!ts.isTypeReferenceNode(typeNode)) return names
  const utility = independentTypeName(typeNode.typeName)
  const target = typeNode.typeArguments?.[0]
  if (utility === "ComponentProps" || utility === "ComponentPropsWithoutRef") {
    if (!target) return names
    if (ts.isTypeQueryNode(target)) {
      const declaration = functionForSymbol(resolvedSymbol(checker, target.exprName))
      if (declaration && !declaration.getSourceFile().fileName.includes("node_modules")) return names
    } else if (!ts.isLiteralTypeNode(target) || !ts.isStringLiteral(target.literal)) return names
    for (const property of checker.getPropertiesOfType(checker.getTypeAtLocation(typeNode))) names.add(property.name)
  }
  return names
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
      const inheritedProps = independentInheritedPropNames(typeNode, checker)
      const localTypeNodes = independentLocalPropTypeNodes(typeNode, checker)
      const localTypes = new Map([...localTypeNodes].filter(([name, node]) => {
        if (!inheritedProps.has(name) || !node) return true
        const inheritedSymbol = checker.getPropertyOfType(propsType, name)
        if (!inheritedSymbol) return true
        return !independentEquivalentPropTypes(checker, checker.getTypeAtLocation(node), checker.getTypeOfSymbolAtLocation(inheritedSymbol, parameter))
      }))
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
    if (ts.isIdentifier(parameter.name)) {
      bindings.add(parameter.name.text)
      restBindings.add(parameter.name.text)
    } else if (ts.isObjectBindingPattern(parameter.name)) {
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
  const jsxAliases = new Set<string>()
  const importedFunctions = new Map<string, string>()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue
    for (const element of statement.importClause.namedBindings.elements) {
      importedFunctions.set(element.name.text, element.propertyName?.text ?? element.name.text)
    }
  }
  const dynamicChildBindings = new Set<string>()
  const containsDirectJsx = (expression: ts.Expression): boolean => {
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return true
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return containsDirectJsx(expression.expression)
    return ts.isConditionalExpression(expression) && (containsDirectJsx(expression.whenTrue) || containsDirectJsx(expression.whenFalse))
  }
  if (functionLike?.body) walkComponent(functionLike.body, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && containsDirectJsx(node.initializer)) jsxAliases.add(node.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && importedFunctions.get(node.initializer.expression.text) === "useMemo") {
      dynamicChildBindings.add(node.name.text)
    }
  })
  const renderUnresolved: IndependentRenderUnresolved[] = []
  const nonJsxBindings = new Set([...typeFacts.entries()]
    .filter(([name, fact]) => bindings.has(name) && /^(?:string|number|boolean)(?:\s*\|\s*undefined)?$/.test(fact.typeText.trim()))
    .map(([name]) => name))
  for (const node of jsx) {
    if (!ts.isJsxElement(node)) continue
    for (const child of node.children) {
      if (!ts.isJsxExpression(child) || !child.expression || !ts.isIdentifier(child.expression) || child.expression.text === "children" || jsxAliases.has(child.expression.text) || dynamicChildBindings.has(child.expression.text) || nonJsxBindings.has(child.expression.text)) continue
      renderUnresolved.push({
        sourcePath: sourceFile.fileName,
        start: child.expression.getStart(sourceFile),
        end: child.expression.getEnd(),
        expressionKind: ts.SyntaxKind[child.expression.kind],
        sourceText: child.expression.getText(sourceFile),
        reason: `Unsupported JSX child expression: ${child.expression.getText(sourceFile)}`,
      })
    }
  }
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
          ...(ts.isPropertyAccessExpression(expression) ? { expression: expression.getText(sourceFile) } : {}),
          expressionKind: ts.isConditionalExpression(expression)
            ? "conditional"
            : ts.isIdentifier(expression)
              ? "identifier"
              : ts.isPropertyAccessExpression(expression)
                ? "property-access"
                : "other",
        })
      }
    }
  }
  const bodyText = functionLike?.getText(sourceFile) ?? declaration.getText(sourceFile)
  const variantDefaults = cvaFacts(sourceFile, bodyText, declaration).defaults
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
    renderAlternativePredicates: functionLike ? renderAlternativePredicates(functionLike, dynamicChildBindings) : [],
    renderBranches: functionLike ? independentRenderBranches(functionLike, sourceFile, restBindings, dynamicChildBindings) : [],
    renderUnresolved,
    mappedRenderEvidence: functionLike ? mappedRenderEvidence(functionLike) : [],
    ...(propSurfaceError ? { propSurfaceError } : {}),
    localPropFacts,
  }
}

type IndependentCvaClassSource = { classNames: string; propName?: string; equals?: string; sourcePath: string }

function independentGitBlobSha(source: string): string {
  return createHash("sha1").update(`blob ${Buffer.byteLength(source)}\0${source}`).digest("hex")
}

function independentRecipeSource(moduleSpecifier: string): string | undefined {
  const entry = independentSeedComponents.find((component) => `@/${String(component.canonicalPath).replace(/^src\//, "").replace(/\.[cm]?[jt]sx?$/, "")}` === moduleSpecifier)
  if (!entry) return undefined
  const path = join(root, entry.canonicalPath)
  if (!existsSync(path)) return undefined
  const source = readFileSync(path, "utf8")
  return independentGitBlobSha(source) === entry.canonicalBlobSha ? path : undefined
}

function independentExportedRecipe(sourceFile: ts.SourceFile, exportName: string): ts.CallExpression | undefined {
  const localNames: string[] = []
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) localNames.push(exportName)
    }
    if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue
    for (const element of statement.exportClause.elements) if (element.name.text === exportName) localNames.push(element.propertyName?.text ?? element.name.text)
  }
  if (localNames.length !== 1) return undefined
  const calls = sourceFile.statements.flatMap((statement) => ts.isVariableStatement(statement)
    ? statement.declarationList.declarations.flatMap((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === localNames[0] && declaration.initializer && ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(sourceFile) === "cva" ? [declaration.initializer] : [])
    : [])
  return calls.length === 1 ? calls[0] : undefined
}

function independentBindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : independentBindingNames(element.name))
}

type IndependentLexicalBinding = { kind: "parameter" | "variable" | "function" | "class" | "catch"; initializer?: ts.Expression; declaration?: ts.Node; owner: ts.Node }

function independentStatementBinding(statement: ts.Statement, name: string): IndependentLexicalBinding | undefined {
  if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find((candidate) => independentBindingNames(candidate.name).includes(name))
    if (declaration) return { kind: "variable", ...(ts.isIdentifier(declaration.name) && declaration.initializer ? { initializer: declaration.initializer } : {}), declaration, owner: statement.parent }
  }
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return { kind: "function", declaration: statement, owner: statement.parent }
  if (ts.isClassDeclaration(statement) && statement.name?.text === name) return { kind: "class", declaration: statement, owner: statement.parent }
  return undefined
}

function independentNearestLexicalBinding(node: ts.Node, name: string): IndependentLexicalBinding | undefined {
  for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
    if (ts.isBlock(current)) {
      for (const statement of current.statements) {
        const binding = independentStatementBinding(statement, name)
        if (binding) return binding
      }
    }
    if (ts.isCatchClause(current) && current.variableDeclaration && independentBindingNames(current.variableDeclaration.name).includes(name)) {
      return { kind: "catch", declaration: current.variableDeclaration, owner: current }
    }
    if (ts.isForStatement(current) || ts.isForOfStatement(current) || ts.isForInStatement(current)) {
      const initializer = current.initializer
      if (initializer && ts.isVariableDeclarationList(initializer)) {
        const declaration = initializer.declarations.find((candidate) => independentBindingNames(candidate.name).includes(name))
        if (declaration) return { kind: "variable", ...(ts.isIdentifier(declaration.name) && declaration.initializer ? { initializer: declaration.initializer } : {}), declaration, owner: current }
      }
    }
    if (ts.isCaseClause(current) || ts.isDefaultClause(current)) {
      for (const clause of current.parent.clauses) for (const statement of clause.statements) {
        const binding = independentStatementBinding(statement, name)
        if (binding) return binding
      }
    }
    if (ts.isFunctionLike(current)) {
      const parameter = current.parameters.find((candidate) => independentBindingNames(candidate.name).includes(name))
      if (parameter) return { kind: "parameter", declaration: parameter, owner: current }
    }
  }
  return undefined
}

function independentLexicallyShadowed(node: ts.Node, name: string): boolean {
  return !!independentNearestLexicalBinding(node, name)
}

function independentSafeRecipeSelector(expression: ts.Expression, invocation: ts.CallExpression, sourceFile: ts.SourceFile, visited = new Set<string>()): boolean {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return independentSafeRecipeSelector(expression.expression, invocation, sourceFile, visited)
  if (ts.isPropertyAccessExpression(expression)) return independentSafeRecipeSelector(expression.expression, invocation, sourceFile, new Set(visited))
  if (ts.isElementAccessExpression(expression)) {
    return !!expression.argumentExpression
      && (ts.isStringLiteral(expression.argumentExpression) || ts.isNumericLiteral(expression.argumentExpression))
      && independentSafeRecipeSelector(expression.expression, invocation, sourceFile, new Set(visited))
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return independentSafeRecipeSelector(expression.left, invocation, sourceFile, new Set(visited))
      && independentSafeRecipeSelector(expression.right, invocation, sourceFile, new Set(visited))
  }
  if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
    if (ts.isPropertyAccessExpression(expression.expression) && ts.isIdentifier(expression.expression.expression)) {
      const namespace = expression.expression.expression.text
      const approved = sourceFile.statements.some((statement) => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === "react"
        && !!statement.importClause?.namedBindings
        && ts.isNamespaceImport(statement.importClause.namedBindings)
        && statement.importClause.namedBindings.name.text === namespace)
      return approved && expression.expression.name.text === "useContext" && !independentLexicallyShadowed(expression, namespace)
    }
    if (ts.isIdentifier(expression.expression)) {
      const name = expression.expression.text
      return sourceFile.statements.some((statement) => ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === "react"
        && !!statement.importClause?.namedBindings
        && ts.isNamedImports(statement.importClause.namedBindings)
        && statement.importClause.namedBindings.elements.some((element) => element.name.text === name && (element.propertyName?.text ?? element.name.text) === "useContext"))
        && !independentLexicallyShadowed(expression, name)
    }
  }
  if (!ts.isIdentifier(expression)) return false
  if (visited.has(expression.text)) return false
  type FunctionWithBody = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration
  let owner: FunctionWithBody | undefined
  let componentOwner: FunctionWithBody | undefined
  for (let current: ts.Node | undefined = invocation; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)) {
      if (!owner) owner = current
      componentOwner = current
    }
  }
  const lexicalBinding = independentNearestLexicalBinding(invocation, expression.text)
  if (lexicalBinding) {
    if (lexicalBinding.kind === "parameter") return lexicalBinding.owner === componentOwner
    if (!lexicalBinding.initializer) return false
    visited.add(expression.text)
    return independentSafeRecipeSelector(lexicalBinding.initializer, invocation, sourceFile, visited)
  }
  const initializers = new Map<string, ts.Expression>()
  const collect = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && node !== owner) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && node.getStart(sourceFile) < invocation.getStart(sourceFile)) initializers.set(node.name.text, node.initializer)
    node.forEachChild(collect)
  }
  for (const statement of sourceFile.statements) if (ts.isVariableStatement(statement)) statement.forEachChild(collect)
  if (owner?.body) collect(owner.body)
  const initializer = initializers.get(expression.text)
  if (!initializer) return false
  visited.add(expression.text)
  return independentSafeRecipeSelector(initializer, invocation, sourceFile, visited)
}

function independentClassRootExpressions(declaration: ts.Node | undefined): ts.Expression[] {
  const component = declaration ? functionLikeIn(declaration) : undefined
  if (!component) return []
  const roots: ts.Expression[] = []
  const resolving = new Set<ts.Node>()
  const functionFromBinding = (binding: IndependentLexicalBinding | undefined): ts.FunctionLikeDeclaration | undefined => {
    if (binding?.initializer && (ts.isArrowFunction(binding.initializer) || ts.isFunctionExpression(binding.initializer))) return binding.initializer
    if (binding?.declaration && ts.isFunctionDeclaration(binding.declaration)) return binding.declaration
    return undefined
  }
  const visitFunction = (functionLike: ts.FunctionLikeDeclaration): void => {
    if (resolving.has(functionLike)) return
    resolving.add(functionLike)
    for (const returned of returnExpressions(functionLike)) visitExpression(returned)
    resolving.delete(functionLike)
  }
  const visitCallback = (expression: ts.Expression | undefined, invocation: ts.CallExpression): void => {
    if (!expression) return
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      visitFunction(expression)
      return
    }
    if (!ts.isIdentifier(expression)) return
    const callback = functionFromBinding(independentNearestLexicalBinding(invocation, expression.text))
    if (callback) visitFunction(callback)
  }
  const visitJsxAttributes = (attributes: ts.JsxAttributes): void => {
    for (const attribute of attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || attribute.name.text !== "className" || !attribute.initializer) continue
      if (ts.isStringLiteral(attribute.initializer)) roots.push(attribute.initializer)
      else if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) roots.push(attribute.initializer.expression)
    }
  }
  const visitJsxChildren = (children: ts.NodeArray<ts.JsxChild>): void => {
    for (const child of children) {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) visitExpression(child)
      else if (ts.isJsxExpression(child)) visitExpression(child.expression)
    }
  }
  const visitExpression = (expression: ts.Expression | undefined): void => {
    if (!expression) return
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) {
      visitExpression(expression.expression)
      return
    }
    if (ts.isJsxElement(expression)) {
      visitJsxAttributes(expression.openingElement.attributes)
      visitJsxChildren(expression.children)
      return
    }
    if (ts.isJsxSelfClosingElement(expression)) {
      visitJsxAttributes(expression.attributes)
      return
    }
    if (ts.isJsxFragment(expression)) {
      visitJsxChildren(expression.children)
      return
    }
    if (ts.isConditionalExpression(expression)) {
      visitExpression(expression.whenTrue)
      visitExpression(expression.whenFalse)
      return
    }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      visitExpression(expression.right)
      return
    }
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      visitExpression(expression.left)
      visitExpression(expression.right)
      return
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) if (ts.isExpression(element)) visitExpression(element)
      return
    }
    if (ts.isIdentifier(expression)) {
      const binding = independentNearestLexicalBinding(expression, expression.text)
      if (binding?.initializer && binding.declaration && !resolving.has(binding.declaration)) {
        resolving.add(binding.declaration)
        visitExpression(binding.initializer)
        resolving.delete(binding.declaration)
      }
      return
    }
    if (!ts.isCallExpression(expression)) return
    if (ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "map") {
      visitCallback(expression.arguments[0], expression)
      return
    }
    if (!ts.isIdentifier(expression.expression)) return
    const functionLike = functionFromBinding(independentNearestLexicalBinding(expression, expression.expression.text))
    if (functionLike) visitFunction(functionLike)
  }
  visitFunction(component)
  return roots
}

function cvaFacts(sourceFile: ts.SourceFile, bodyText: string, declaration?: ts.Node, resolveRecipeSource = independentRecipeSource): { variants: Map<string, string[]>; defaults: Map<string, unknown>; texts: string[]; classSources: IndependentCvaClassSource[]; localClassSources: IndependentCvaClassSource[]; unresolved: string[] } {
  const variants = new Map<string, string[]>()
  const defaults = new Map<string, unknown>()
  const texts: string[] = []
  const classSources: IndependentCvaClassSource[] = []
  const localClassSources: IndependentCvaClassSource[] = []
  const unresolved: string[] = []
  const parseRecipe = (call: ts.CallExpression, recipeFile: ts.SourceFile, sourcePath: string, invocation?: ts.CallExpression): void => {
    const textStart = texts.length
    const classStart = classSources.length
    const unresolvedStart = unresolved.length
    const variantsBefore = new Map([...variants].map(([name, values]) => [name, [...values]]))
    const defaultsBefore = new Map(defaults)
    const parse = (): void => {
      texts.push(call.getText(recipeFile))
      const base = call.arguments[0]
      if (base && (ts.isStringLiteral(base) || ts.isNoSubstitutionTemplateLiteral(base))) classSources.push({ classNames: base.text, sourcePath })
      else if (base) unresolved.push(`${sourcePath}:${base.getStart(recipeFile)}:dynamic recipe base`)
      const options = call.arguments[1]
      if (!options) return
      if (!ts.isObjectLiteralExpression(options)) { unresolved.push(`${sourcePath}:${options.getStart(recipeFile)}:dynamic recipe configuration`); return }
      if (options.properties.some((property) => !ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))) unresolved.push(`${sourcePath}:${options.getStart(recipeFile)}:computed recipe configuration`)
      const assignment = (name: string) => options.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name) && propertyName(property.name) === name)?.initializer
      const defaultOptions = assignment("defaultVariants")
      if (defaultOptions && !ts.isObjectLiteralExpression(defaultOptions)) unresolved.push(`${sourcePath}:${defaultOptions.getStart(recipeFile)}:dynamic recipe defaults`)
      if (defaultOptions && ts.isObjectLiteralExpression(defaultOptions)) for (const property of defaultOptions.properties) {
        if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) { unresolved.push(`${sourcePath}:${property.getStart(recipeFile)}:computed recipe default`); continue }
        const name = propertyName(property.name)
        const value = literalValue(property.initializer)
        if (!name || value === undefined || value === null) unresolved.push(`${sourcePath}:${property.getStart(recipeFile)}:dynamic recipe default`)
        else defaults.set(name, value)
      }
      const selections = new Map<string, unknown>()
      const dynamicSelections = new Set<string>()
      if (invocation) {
        const argument = invocation.arguments[0]
        if (invocation.arguments.length > 1 || (argument && !ts.isObjectLiteralExpression(argument))) unresolved.push(`${invocation.getSourceFile().fileName}:${(argument ?? invocation).getStart()}:dynamic recipe invocation`)
        else if (argument && ts.isObjectLiteralExpression(argument)) for (const property of argument.properties) {
          if ((!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) || ts.isComputedPropertyName(property.name)) { unresolved.push(`${invocation.getSourceFile().fileName}:${property.getStart()}:computed recipe invocation`); continue }
          const name = propertyName(property.name)
          if (!name || ["class", "className"].includes(name)) continue
          const initializer = ts.isPropertyAssignment(property) ? property.initializer : property.name
          const value = literalValue(initializer)
          if (value === undefined || value === null) {
            if (independentSafeRecipeSelector(initializer, invocation, sourceFile)) dynamicSelections.add(name)
            else unresolved.push(`${invocation.getSourceFile().fileName}:${initializer.getStart()}:ambiguous recipe selector`)
          } else selections.set(name, value)
        }
      }
      const variantOptions = assignment("variants")
      if (variantOptions && !ts.isObjectLiteralExpression(variantOptions)) { unresolved.push(`${sourcePath}:${variantOptions.getStart(recipeFile)}:dynamic recipe variants`); return }
      if (!variantOptions || !ts.isObjectLiteralExpression(variantOptions)) return
      const variantValues = new Map<string, Set<string>>()
      for (const variant of variantOptions.properties) {
        if (!ts.isPropertyAssignment(variant) || ts.isComputedPropertyName(variant.name) || !ts.isObjectLiteralExpression(variant.initializer)) { unresolved.push(`${sourcePath}:${variant.getStart(recipeFile)}:computed or dynamic recipe variant`); continue }
        const variantName = propertyName(variant.name)
        if (!variantName) continue
        const values: string[] = []
        for (const item of variant.initializer.properties) {
          if (!ts.isPropertyAssignment(item) || ts.isComputedPropertyName(item.name)) { unresolved.push(`${sourcePath}:${item.getStart(recipeFile)}:computed recipe value`); continue }
          const valueName = propertyName(item.name)
          if (!valueName || (!ts.isStringLiteral(item.initializer) && !ts.isNoSubstitutionTemplateLiteral(item.initializer))) { unresolved.push(`${sourcePath}:${item.getStart(recipeFile)}:dynamic recipe value`); continue }
          values.push(valueName)
          if (!invocation || dynamicSelections.has(variantName)) classSources.push({ classNames: item.initializer.text, propName: variantName, equals: valueName, sourcePath })
          else if (String(selections.get(variantName) ?? defaults.get(variantName)) === valueName) classSources.push({ classNames: item.initializer.text, sourcePath })
        }
        variants.set(variantName, values)
        variantValues.set(variantName, new Set(values))
      }
      for (const [name, value] of defaults) {
        if (!variantValues.get(name)?.has(String(value))) unresolved.push(`${sourcePath}:${defaultOptions?.getStart(recipeFile) ?? call.getStart(recipeFile)}:unknown recipe default`)
      }
      for (const name of [...selections.keys(), ...dynamicSelections]) {
        if (!variantValues.has(name)) unresolved.push(`${invocation?.getSourceFile().fileName}:${invocation?.getStart()}:unknown recipe variant`)
      }
      for (const [name, value] of selections) {
        if (variantValues.has(name) && !variantValues.get(name)!.has(String(value))) unresolved.push(`${invocation?.getSourceFile().fileName}:${invocation?.getStart()}:unknown recipe value`)
      }
    }
    parse()
    if (unresolved.length === unresolvedStart) return
    texts.splice(textStart)
    classSources.splice(classStart)
    variants.clear(); for (const [name, values] of variantsBefore) variants.set(name, values)
    defaults.clear(); for (const [name, value] of defaultsBefore) defaults.set(name, value)
  }
  void bodyText
  type IndependentImport = { kind: "named" | "default" | "namespace"; importedName?: string; moduleSpecifier: string; node: ts.Node }
  const imports = new Map<string, IndependentImport>()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause) continue
    const moduleSpecifier = statement.moduleSpecifier.text
    if (statement.importClause.name) imports.set(statement.importClause.name.text, { kind: "default", moduleSpecifier, node: statement.importClause.name })
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, { kind: "namespace", moduleSpecifier, node: bindings })
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      imports.set(binding.name.text, { kind: "named", importedName: binding.propertyName?.text ?? binding.name.text, moduleSpecifier, node: binding })
    }
  }
  const localRecipes = new Map<string, ts.CallExpression>()
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const item of statement.declarationList.declarations) {
      if (ts.isIdentifier(item.name) && item.initializer && ts.isCallExpression(item.initializer) && ts.isIdentifier(item.initializer.expression) && item.initializer.expression.text === "cva") localRecipes.set(item.name.text, item.initializer)
    }
  }
  const resolveImportedInvocation = (candidate: IndependentImport, importedName: string | undefined, invocation: ts.CallExpression): void => {
    if (candidate.kind !== "named" || !importedName) {
      unresolved.push(`${sourceFile.fileName}:${invocation.getStart(sourceFile)}:unsupported imported class producer`)
      return
    }
    const sourcePath = resolveRecipeSource(candidate.moduleSpecifier)
    if (!sourcePath) {
      unresolved.push(`${sourceFile.fileName}:${invocation.getStart(sourceFile)}:unapproved or stale recipe module`)
      return
    }
    const importedFile = sourceFacts(sourcePath).sourceFile
    const recipe = independentExportedRecipe(importedFile, importedName)
    if (!recipe) {
      unresolved.push(`${sourceFile.fileName}:${candidate.node.getStart(sourceFile)}:missing recipe export`)
      return
    }
    parseRecipe(recipe, importedFile, sourcePath, invocation)
  }
  const resolving = new Set<ts.Node>()
  const traceClassExpression = (expression: ts.Expression | undefined): void => {
    if (!expression) return
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      localClassSources.push({ classNames: expression.text, sourcePath: sourceFile.fileName })
      return
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) {
      traceClassExpression(expression.expression)
      return
    }
    if (ts.isConditionalExpression(expression)) {
      traceClassExpression(expression.whenTrue)
      traceClassExpression(expression.whenFalse)
      return
    }
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      traceClassExpression(expression.right)
      return
    }
    if (ts.isIdentifier(expression)) {
      const binding = independentNearestLexicalBinding(expression, expression.text)
      if (binding?.kind === "parameter") return
      if (binding?.initializer) {
        if (resolving.has(binding.declaration!)) return
        resolving.add(binding.declaration!)
        traceClassExpression(binding.initializer)
        resolving.delete(binding.declaration!)
        return
      }
      unresolved.push(`${sourceFile.fileName}:${expression.getStart(sourceFile)}:unsupported dynamic class expression`)
      return
    }
    if (!ts.isCallExpression(expression)) {
      unresolved.push(`${sourceFile.fileName}:${expression.getStart(sourceFile)}:unsupported dynamic class expression`)
      return
    }
    if (ts.isIdentifier(expression.expression)) {
      const localName = expression.expression.text
      const imported = imports.get(localName)
      const lexicalBinding = independentNearestLexicalBinding(expression, localName)
      if (imported && lexicalBinding) {
        unresolved.push(`${sourceFile.fileName}:${expression.getStart(sourceFile)}:shadowed imported class producer`)
        return
      }
      if (imported?.kind === "named" && imported.importedName === "cn") {
        for (const argument of expression.arguments) traceClassExpression(argument)
        return
      }
      if (imported) {
        resolveImportedInvocation(imported, imported.importedName, expression)
        return
      }
      const localRecipe = localRecipes.get(localName)
      if (localRecipe) {
        parseRecipe(localRecipe, sourceFile, sourceFile.fileName, expression)
        return
      }
      if (lexicalBinding) {
        const initializer = lexicalBinding.initializer
        const functionLike = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
          ? initializer
          : lexicalBinding.declaration && ts.isFunctionDeclaration(lexicalBinding.declaration) ? lexicalBinding.declaration : undefined
        if (functionLike && !resolving.has(functionLike)) {
          resolving.add(functionLike)
          for (const returned of returnExpressions(functionLike)) traceClassExpression(returned)
          resolving.delete(functionLike)
          return
        }
      }
      unresolved.push(`${sourceFile.fileName}:${expression.getStart(sourceFile)}:unsupported dynamic class producer`)
      return
    }
    if (ts.isPropertyAccessExpression(expression.expression) && ts.isIdentifier(expression.expression.expression)) {
      const namespaceName = expression.expression.expression.text
      const imported = imports.get(namespaceName)
      if (imported?.kind === "namespace" && !independentLexicallyShadowed(expression, namespaceName)) {
        resolveImportedInvocation(imported, expression.expression.name.text, expression)
        return
      }
    }
    unresolved.push(`${sourceFile.fileName}:${expression.getStart(sourceFile)}:unsupported dynamic class producer`)
  }
  for (const rootExpression of independentClassRootExpressions(declaration)) traceClassExpression(rootExpression)
  return { variants, defaults, texts, classSources, localClassSources, unresolved }
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

function independentHostMatches(tag: string, host: AnyRecord, binding?: IndependentRenderNode["importBinding"]): boolean {
  if (tag === "Loader2" && host?.kind === "inherited-interface" && host.interfaceId === "html.svg") {
    return binding?.moduleSpecifier === "lucide-react" && binding.importedName === "Loader2"
  }
  if (host?.kind === "unresolved") return true
  if (host?.kind === "fragment") return tag === "Fragment"
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
    ...(attribute.condition ? { condition: normalizedPredicate(attribute.condition) } : {}),
    ...(attribute.whenTrue ? { whenTrue: attribute.whenTrue } : {}),
    ...(attribute.whenFalse ? { whenFalse: attribute.whenFalse } : {}),
    ...(attribute.expression ? { expression: attribute.expression } : {}),
  }
}

function independentOrderedAttributeMatches(source: AnyRecord, contract: AnyRecord): boolean {
  if (contract.source !== "ordered-writes") return false
  const writes = contract.writes ?? []
  if (writes.length !== 2 || writes[0]?.kind !== "value" || writes[1]?.kind !== "public-props-spread") return false
  const value = writes[0].value
  if (source.name !== contract.name) return false
  if (source.source === "literal") return value?.source === "literal" && value.value === source.value
  if (source.source === "prop") return value?.source === "prop" && value.name === source.prop
  if (source.source !== "primitive-state") return false
  if (value?.source === "context-field") return typeof source.prop === "string" && source.prop.endsWith(`.${value.field}`)
  return value?.source === "nullish-coalesce"
    && value.first?.source === "context-field"
    && value.fallback?.source === "prop"
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
    if (!independentHostMatches(sourceHost, contractNode.host, sourceNode.importBinding) || !independentImportMatches(sourceNode.importBinding, contractNode.host)) return false
    if (sourceNode.portal !== portalIds.has(nodeId) || sourceNode.receivesPublicProps !== Boolean(contractNode.receivesPublicProps)) return false
    const contractAttributes = contractNode.dataAttributes ?? []
    if (sourceNode.dataAttributes.length !== contractAttributes.length) return false
    if (!sourceNode.dataAttributes.every((attribute, index) => {
      const candidate = comparableIndependentAttribute(contractAttributes[index])
      return independentOrderedAttributeMatches(attribute, contractAttributes[index])
        || JSON.stringify(comparableIndependentAttribute(attribute)) === JSON.stringify(candidate)
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
      found = ["rounded", "rounded-s", "rounded-e", "rounded-t", "rounded-b"].some((prefix) => hasClass(`${prefix}-${name}`))
    } else if (category === "line-height") {
      found = hasClass(`leading-${name}`)
    } else if (category === "shadow") {
      found = hasClass(`shadow-${name}`)
    } else if (category === "spacing") {
      const negativeSpacing = /(?:^|[^A-Za-z0-9_-])(?:[a-z-]+:)*-(?:m|mx|my|mt|mr|mb|ml|ms|me|space-x|space-y|inset|inset-x|inset-y|inset-s|inset-e|top|right|bottom|left|start|end)-\d+(?:\.\d+)?(?:$|[^A-Za-z0-9_-])/
      const positiveSpacing = /(?:^|[^A-Za-z0-9_-])(?:[a-z-]+:)*(?:p|px|py|pt|pr|pb|pl|ps|pe|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|ms|me|space-x|space-y|inset|inset-x|inset-y|inset-s|inset-e|top|right|bottom|left|start|end|h|w|min-h|min-w|max-h|max-w|size|translate)-\d+(?:\.\d+)?(?:$|[^A-Za-z0-9_-])/
      found = negativeSpacing.test(text) || positiveSpacing.test(text)
    }
    if (found) result.add(tokenId)
  }
  return result
}

const independentOperationalPrefixes = new Set([
  "*", "**", "dark", "rtl", "ltr", "portrait", "landscape", "print", "motion-safe", "motion-reduce", "contrast-more", "contrast-less", "forced-colors",
  "sm", "md", "lg", "xl", "2xl", "first", "last", "only", "odd", "even", "first-of-type", "last-of-type", "only-of-type", "empty",
  "hover", "focus", "focus-within", "focus-visible", "active", "visited", "target", "disabled", "enabled", "checked", "indeterminate", "default",
  "required", "valid", "invalid", "in-range", "out-of-range", "placeholder", "placeholder-shown", "autofill", "read-only", "open", "before", "after", "first-letter",
  "first-line", "marker", "selection", "file", "backdrop",
])

function independentUtilitySegments(raw: string): string[] | undefined {
  const result: string[] = []
  let square = 0
  let round = 0
  let boundary = 0
  let escaped = false
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]
    if (escaped) { escaped = false; continue }
    if (character === "\\") { escaped = true; continue }
    if (character === "[") square += 1
    if (character === "]") square -= 1
    if (character === "(") round += 1
    if (character === ")") round -= 1
    if (square < 0 || round < 0) return undefined
    if (character === ":" && square === 0 && round === 0) {
      result.push(raw.slice(boundary, index))
      boundary = index + 1
    }
  }
  if (escaped || square !== 0 || round !== 0) return undefined
  result.push(raw.slice(boundary))
  return result.every((segment) => segment.length > 0) ? result : undefined
}

function independentScalar(value: string | undefined): string | number | boolean | undefined {
  if (value === undefined) return true
  if (value.length === 0) return undefined
  let decoded = ""
  let escaped = false
  for (const character of value) {
    if (escaped) { decoded += character; escaped = false; continue }
    if (character === "\\") { escaped = true; continue }
    if (character === "_" || character === ":") return undefined
    decoded += character
  }
  if (escaped || [...decoded].some((character) => " {}$`'\"".includes(character))) return undefined
  if (decoded === "true" || decoded === "false") return decoded === "true"
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decoded)) return Number(decoded)
  return decoded
}

function independentAttributeCondition(prefix: string): AnyRecord | undefined {
  const root = /^(?:((?:(?:group|peer|in|has)-)+))?(data|aria)-(.+)$/.exec(prefix)
  if (!root) return undefined
  const kinds = root[1] ? root[1].split("-").filter(Boolean) : ["self"]
  const suffix = root[3]
  let property: string
  let encodedValue: string | undefined
  let modifier: string | undefined

  if (suffix[0] === "[") {
    let end = -1
    let escaped = false
    for (let cursor = 1; cursor < suffix.length; cursor += 1) {
      const character = suffix[cursor]
      if (escaped) { escaped = false; continue }
      if (character === "\\") { escaped = true; continue }
      if (character === "[") return undefined
      if (character === "]") { end = cursor; break }
    }
    if (escaped || end < 0) return undefined
    const remainder = suffix.slice(end + 1)
    if (remainder) {
      if (!/^\/[A-Za-z0-9_-]+$/.test(remainder)) return undefined
      modifier = remainder.slice(1)
    }
    const arbitrary = suffix.slice(1, end)
    let equals = -1
    escaped = false
    for (let cursor = 0; cursor < arbitrary.length; cursor += 1) {
      const character = arbitrary[cursor]
      if (escaped) { escaped = false; continue }
      if (character === "\\") { escaped = true; continue }
      if (character === "=" && equals < 0) equals = cursor
    }
    if (escaped) return undefined
    property = equals < 0 ? arbitrary : arbitrary.slice(0, equals)
    encodedValue = equals < 0 ? undefined : arbitrary.slice(equals + 1)
  } else {
    const shorthand = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\/([A-Za-z0-9_-]+))?$/.exec(suffix)
    if (!shorthand) return undefined
    property = shorthand[1]
    modifier = shorthand[2]
  }
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(property)) return undefined
  const path = kinds.map((kind) => ({ kind }))
  if (modifier) {
    const target = path.findIndex((segment) => segment.kind === "group" || segment.kind === "peer")
    if (target < 0) return undefined
    path[target] = { kind: path[target].kind, name: modifier } as typeof path[number]
  }
  const equals = independentScalar(encodedValue)
  return equals === undefined ? undefined : { subject: root[2], path, propName: property, equals }
}

function independentUtilityCondition(raw: string, preserveSourceContext = false): { utility: string; atoms: AnyRecord[]; applicability: string[]; target?: AnyRecord } | undefined {
  const segments = independentUtilitySegments(raw)
  if (!segments) return undefined
  const atoms: AnyRecord[] = []
  const applicability: string[] = []
  let target: AnyRecord | undefined
  for (const prefix of segments.slice(0, -1)) {
    if (preserveSourceContext && /^(?:group-)+data-/.test(prefix)) {
      const atom = independentAttributeCondition(prefix)
      if (!atom) return undefined
      applicability.push(prefix)
      continue
    }
    if (preserveSourceContext && ["after", "before"].includes(prefix)) {
      target = { kind: "pseudo-element", name: prefix }
      continue
    }
    if (preserveSourceContext && ["first", "last"].includes(prefix)) {
      applicability.push(prefix)
      continue
    }
    const atom = independentAttributeCondition(prefix)
    if (atom) {
      const identity = independentStableKey({ ...atom, equals: undefined })
      const prior = atoms.find((candidate) => independentStableKey({ ...candidate, equals: undefined }) === identity)
      if (prior && prior.equals !== atom.equals) return undefined
      if (!prior) atoms.push(atom)
      continue
    }
    const namedState = /^(?:group|peer)-(?:hover|focus|focus-within|focus-visible|active|visited|disabled|enabled|checked|open)(?:\/[A-Za-z0-9_-]+)?$/.test(prefix)
    const container = /^@[a-z][A-Za-z0-9_-]*(?:\/[A-Za-z0-9_-]+)?$/.test(prefix)
    const structural = !prefix.includes("${") && !/[\s{}$`]/.test(prefix) && (
      /^(?:\[&[>_].+\]|\[[a-z][A-Za-z0-9-]*\])$/.test(prefix)
      || /^(?:has|not-has)-\[.+\]$/.test(prefix)
    )
    if (!structural && (prefix.includes("data-") || prefix.includes("aria-") || prefix.includes("${") || prefix.startsWith("[") || (!independentOperationalPrefixes.has(prefix) && !namedState && !container))) return undefined
    if (preserveSourceContext && ["after", "before"].includes(prefix) === false && !independentOperationalPrefixes.has(prefix) && !namedState && !container && !structural) return undefined
  }
  return { utility: segments.at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, ""), atoms, applicability, target }
}

function independentMergedCondition(source: IndependentCvaClassSource, utilityAtoms: AnyRecord[]): AnyRecord | undefined {
  const atoms = [...(source.propName && source.equals ? [{ propName: source.propName, equals: source.equals }] : []), ...utilityAtoms]
  const unique: AnyRecord[] = []
  for (const atom of atoms) {
    const { equals: _equals, ...identity } = atom
    const prior = unique.find((candidate) => {
      const { equals: _candidateEquals, ...candidateIdentity } = candidate
      return independentStableKey(candidateIdentity) === independentStableKey(identity)
    })
    if (prior && prior.equals !== atom.equals) return undefined
    if (!prior) unique.push(atom)
  }
  if (unique.length === 0) return {}
  return { when: unique.length === 1 ? unique[0] : { all: unique } }
}

function independentTokenIdsForUtility(utility: string): Set<string> {
  const result = new Set<string>()
  for (const tokenId of approvedTokenIds) {
    const [category, name] = tokenId.split(".")
    if (category === "color" && ["bg", "text", "border", "ring", "fill", "stroke", "outline"].some((prefix) => utility === `${prefix}-${name}`)) result.add(tokenId)
    else if (tokenId === "font.heading" && utility === "font-heading") result.add(tokenId)
    else if (category === "font-size" && utility === `text-${name}`) result.add(tokenId)
    else if (category === "font-weight" && utility === `font-${name}`) result.add(tokenId)
    else if (category === "letter-spacing" && utility === `tracking-${name}`) result.add(tokenId)
    else if (category === "radius" && ["rounded", "rounded-s", "rounded-e", "rounded-t", "rounded-b"].some((prefix) => utility === `${prefix}-${name}`)) result.add(tokenId)
    else if (category === "line-height" && utility === `leading-${name}`) result.add(tokenId)
    else if (category === "shadow" && utility === `shadow-${name}`) result.add(tokenId)
  }
  return result
}

function independentImportedTokenDependencies(classSources: IndependentCvaClassSource[], preserveSourceContext = false): AnyRecord[] {
  const dependencies: AnyRecord[] = []
  const spacing = /^(-)?(?:size|h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|ps|pe|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|ms|me|space-x|space-y|inset|inset-x|inset-y|inset-s|inset-e|top|right|bottom|left|start|end)-([0-9]+(?:\.[0-9]+)?)$/
  for (const source of classSources) for (const rawUtility of source.classNames.split(/\s+/).filter(Boolean)) {
    const parsed = independentUtilityCondition(rawUtility, preserveSourceContext)
    if (!parsed) continue
    const condition = independentMergedCondition(source, parsed.atoms)
    if (!condition) continue
    for (const tokenId of independentTokenIdsForUtility(parsed.utility)) {
      if (tokenId !== "spacing.unit") dependencies.push({ tokenId, ...condition, ...(preserveSourceContext && (parsed.applicability.length || parsed.target) ? { sourceContext: { applicability: parsed.applicability, ...(parsed.target ? { target: parsed.target } : {}) } } : {}) })
    }
    const match = parsed.utility.match(spacing)
    if (match) dependencies.push({ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: Number(`${match[1] ?? ""}${match[2]}`) }, ...condition, ...(preserveSourceContext && (parsed.applicability.length || parsed.target) ? { sourceContext: { applicability: parsed.applicability, ...(parsed.target ? { target: parsed.target } : {}) } } : {}) })
  }
  return [...new Map(dependencies.map((dependency) => [independentStableKey(dependency), dependency])).values()]
}

function independentReferencedLocalRecipeSources(sourceFile: ts.SourceFile, componentSourceText: string): IndependentCvaClassSource[] {
  const sources: IndependentCvaClassSource[] = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)
        || declaration.initializer.expression.getText(sourceFile) !== "cva") continue
      const recipeName = declaration.name.text
      if (!new RegExp(`\\b${recipeName}\\b`).test(componentSourceText)) continue
      const call = declaration.initializer
      const addString = (expression: ts.Expression | undefined, propName?: string, equals?: string) => {
        if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))) {
          sources.push({ classNames: expression.text, sourcePath: sourceFile.fileName, ...(propName ? { propName, equals } : {}) })
        }
      }
      addString(call.arguments[0])
      const options = call.arguments[1]
      if (!options || !ts.isObjectLiteralExpression(options)) continue
      const variants = options.properties.find((property) => ts.isPropertyAssignment(property) && propertyName(property.name) === "variants")
      if (!variants || !ts.isPropertyAssignment(variants) || !ts.isObjectLiteralExpression(variants.initializer)) continue
      for (const variant of variants.initializer.properties) {
        if (!ts.isPropertyAssignment(variant) || !ts.isObjectLiteralExpression(variant.initializer)) continue
        const propName = propertyName(variant.name)
        if (!propName) continue
        for (const value of variant.initializer.properties) {
          if (!ts.isPropertyAssignment(value) || !ts.isStringLiteral(value.initializer) && !ts.isNoSubstitutionTemplateLiteral(value.initializer)) continue
          const equals = propertyName(value.name)
          if (equals) addString(value.initializer, propName, equals)
        }
      }
    }
  }
  return sources
}

function independentStableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(independentStableKey).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as AnyRecord
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${independentStableKey(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

type IndependentArithmeticEvidence = {
  tokenId: "spacing.unit"
  viaDerivedRule?: { id: "spacing.multiplier"; multiplier: number }
  when?: AnyRecord
  source: { sourcePath: string; start: number; end: number; expressionKind: string; sourceText: string }
}

type IndependentStaticScope = Map<string, ts.VariableDeclaration | undefined>

function independentStaticCssPrimitive(expression: ts.Expression, sourceFile: ts.SourceFile, scope: IndependentStaticScope, seen = new Set<string>()): string | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) || ts.isNumericLiteral(expression)) return expression.text
  if (ts.isPrefixUnaryExpression(expression) && (expression.operator === ts.SyntaxKind.PlusToken || expression.operator === ts.SyntaxKind.MinusToken) && ts.isNumericLiteral(expression.operand)) {
    return `${expression.operator === ts.SyntaxKind.MinusToken ? "-" : "+"}${expression.operand.text}`
  }
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return independentStaticCssPrimitive(expression.expression, sourceFile, scope, seen)
  if (!ts.isIdentifier(expression) || seen.has(expression.text)) return undefined
  const declaration = scope.get(expression.text)
  const list = declaration?.parent
  if (!declaration?.initializer || !list || !ts.isVariableDeclarationList(list) || (list.flags & ts.NodeFlags.Const) === 0) return undefined
  seen.add(expression.text)
  return independentStaticCssPrimitive(declaration.initializer, sourceFile, scope, seen)
}

function independentStaticCssText(expression: ts.Expression, sourceFile: ts.SourceFile, scope: IndependentStaticScope): { text?: string; error?: string } {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return { text: expression.text }
  if (!ts.isTemplateExpression(expression)) return { error: "Dynamic CSS token arithmetic operand." }
  let text = expression.head.text
  for (const span of expression.templateSpans) {
    const value = independentStaticCssPrimitive(span.expression, sourceFile, scope)
    if (value === undefined) return { error: "Dynamic CSS token arithmetic operand." }
    const preceding = text[text.length - 1]
    const following = span.literal.text[0]
    if ((preceding && /[A-Za-z0-9_.-]/.test(preceding)) || (following && /[A-Za-z0-9_.-]/.test(following))) return { error: "Ambiguous CSS token arithmetic interpolation." }
    text += value + span.literal.text
  }
  return { text }
}

function independentlyParseSpacingArithmetic(text: string): { multiplier?: number; error?: string; ignored?: true } {
  const references = [...text.matchAll(/var\s*\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)].map((match) => match[1])
  if (references.length !== 1) return { error: references.length > 1 ? "CSS token arithmetic must reference exactly one variable." : "CSS token arithmetic expression shape is not equivalent." }
  if (references[0] !== "--spacing") return /-(?:width|height|size|offset|inset)(?:-|$)/.test(references[0])
    ? { ignored: true }
    : { error: "CSS token arithmetic references an unapproved variable." }
  const exact = /^calc\s*\(\s*var\s*\(\s*--spacing\s*\)\s*\*\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/.exec(text)
  if (exact) {
    const parsed = Number(exact[1])
    if (!Number.isFinite(parsed)) return { error: "CSS token arithmetic operand is not a finite decimal." }
    return { multiplier: Object.is(parsed, -0) ? 0 : parsed }
  }
  if (/^calc\s*\(\s*var\s*\(\s*--spacing\s*\)\s*\/\s*[+-]?(?:0+(?:\.0*)?|\.0+)\s*\)$/.test(text)) return { error: "CSS token arithmetic divides by zero." }
  if (/^calc\s*\(\s*var\s*\(\s*--spacing\s*\)\s*\*\s*(?:[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+|Infinity)|NaN)\s*\)$/.test(text)) return { error: "CSS token arithmetic operand is not a finite decimal." }
  if (/^calc\s*\(\s*var\s*\(\s*--spacing\s*\)\s*\*\s*[^)]+\)$/.test(text)) return { error: "CSS token arithmetic operand is not numeric." }
  if (/^calc\s*\(.*\)\s*(?:\+|-|\/)\s*.*\)$/.test(text)) return { error: "Unsupported CSS token arithmetic operator." }
  return { error: "CSS token arithmetic expression shape is not equivalent." }
}

function independentSpacingArithmetic(sourceFile: ts.SourceFile, declaration: ts.Node): { facts: IndependentArithmeticEvidence[]; unresolved: Array<IndependentArithmeticEvidence["source"] & { reason: string }> } {
  const facts: IndependentArithmeticEvidence[] = []
  const unresolved: Array<IndependentArithmeticEvidence["source"] & { reason: string }> = []
  const identity = (expression: ts.Expression): IndependentArithmeticEvidence["source"] => ({
    sourcePath: sourceFile.fileName,
    start: expression.getStart(sourceFile),
    end: expression.getEnd(),
    expressionKind: ts.SyntaxKind[expression.kind],
    sourceText: expression.getText(sourceFile),
  })
  const inspect = (expression: ts.Expression, scope: IndependentStaticScope, when?: AnyRecord): void => {
    if (!expression.getText(sourceFile).includes("calc(") || !expression.getText(sourceFile).includes("var(")) return
    const source = identity(expression)
    const staticValue = independentStaticCssText(expression, sourceFile, scope)
    if (staticValue.error) {
      if (ts.isTemplateExpression(expression) && expression.templateSpans.length === 1) {
        const variable = /^calc\(\s*var\(\s*(--[A-Za-z0-9_-]+)\s*\)\s*\*\s*$/.exec(expression.head.text)?.[1]
        if (variable === "--spacing" && /^\s*\)$/.test(expression.templateSpans[0].literal.text)) {
          facts.push({ tokenId: "spacing.unit", ...(when ? { when } : {}), source })
          return
        }
      }
      unresolved.push({ ...source, reason: staticValue.error })
      return
    }
    const parsed = independentlyParseSpacingArithmetic(staticValue.text!)
    if (parsed.error) { unresolved.push({ ...source, reason: parsed.error }); return }
    if (parsed.ignored) return
    facts.push({ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: parsed.multiplier! }, ...(when ? { when } : {}), source })
  }
  const inspectClassExpression = (expression: ts.Expression): void => {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      for (const raw of expression.text.split(/\s+/).filter(Boolean)) {
        const utility = independentUtilityCondition(raw)
        const arbitrary = utility && /^[A-Za-z][A-Za-z0-9-]*-\[(.*)\]$/.exec(utility.utility)?.[1]
        if (!arbitrary || !arbitrary.includes("calc(") || !arbitrary.includes("var(")) continue
        const parsed = independentlyParseSpacingArithmetic(arbitrary)
        const source = identity(expression)
        if (parsed.error) unresolved.push({ ...source, reason: parsed.error })
        else if (!parsed.ignored) facts.push({ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: parsed.multiplier! }, ...(utility.atoms.length ? { when: utility.atoms.length === 1 ? utility.atoms[0] : { all: utility.atoms } } : {}), source })
      }
      return
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) { inspectClassExpression(expression.expression); return }
    if (ts.isConditionalExpression(expression)) { inspectClassExpression(expression.whenTrue); inspectClassExpression(expression.whenFalse); return }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { inspectClassExpression(expression.right); return }
    if (ts.isCallExpression(expression)) for (const argument of expression.arguments) inspectClassExpression(argument)
  }
  const reserveStatements = (parent: IndependentStaticScope, statements: readonly ts.Statement[]): IndependentStaticScope => {
    const scope = new Map(parent)
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations) {
        for (const name of independentBindingNames(item.name)) scope.set(name, undefined)
      }
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) scope.set(statement.name.text, undefined)
    }
    return scope
  }
  const activateDeclaration = (scope: IndependentStaticScope, declaration: ts.VariableDeclaration): void => {
    for (const name of independentBindingNames(declaration.name)) scope.set(name, ts.isIdentifier(declaration.name) ? declaration : undefined)
  }
  const activateStatement = (scope: IndependentStaticScope, statement: ts.Statement): void => {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) activateDeclaration(scope, declaration)
  }
  const visit = (node: ts.Node, scope: IndependentStaticScope): void => {
    if (ts.isSourceFile(node) || ts.isBlock(node)) {
      const nested = reserveStatements(scope, node.statements)
      for (const statement of node.statements) visit(statement, nested)
      return
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (declaration.initializer) visit(declaration.initializer, scope)
        activateDeclaration(scope, declaration)
      }
      return
    }
    if (ts.isFunctionLike(node)) {
      const nested = new Map(scope)
      for (const parameter of node.parameters) for (const name of independentBindingNames(parameter.name)) nested.set(name, undefined)
      if ("body" in node && node.body) visit(node.body, nested)
      return
    }
    if (ts.isCatchClause(node)) {
      const nested = new Map(scope)
      if (node.variableDeclaration) for (const name of independentBindingNames(node.variableDeclaration.name)) nested.set(name, undefined)
      visit(node.block, nested)
      return
    }
    if (ts.isForStatement(node)) {
      const nested = new Map(scope)
      if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
        for (const declaration of node.initializer.declarations) for (const name of independentBindingNames(declaration.name)) nested.set(name, undefined)
        for (const declaration of node.initializer.declarations) {
          if (declaration.initializer) visit(declaration.initializer, nested)
          activateDeclaration(nested, declaration)
        }
      } else if (node.initializer) visit(node.initializer, nested)
      if (node.condition) visit(node.condition, nested)
      if (node.incrementor) visit(node.incrementor, nested)
      visit(node.statement, nested)
      return
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      const nested = new Map(scope)
      if (ts.isVariableDeclarationList(node.initializer)) {
        for (const declaration of node.initializer.declarations) for (const name of independentBindingNames(declaration.name)) nested.set(name, undefined)
        visit(node.expression, nested)
        for (const declaration of node.initializer.declarations) activateDeclaration(nested, declaration)
      } else {
        visit(node.expression, nested)
        visit(node.initializer, nested)
      }
      visit(node.statement, nested)
      return
    }
    if (ts.isSwitchStatement(node)) {
      visit(node.expression, scope)
      const clauseStatements = node.caseBlock.clauses.flatMap((clause) => [...clause.statements])
      const reserved = reserveStatements(scope, clauseStatements)
      for (const clause of node.caseBlock.clauses) {
        const nested = new Map(reserved)
        if (ts.isCaseClause(clause)) visit(clause.expression, nested)
        for (const statement of clause.statements) visit(statement, nested)
      }
      return
    }
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      let expression = node.initializer.expression
      while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) expression = expression.expression
      if (ts.isObjectLiteralExpression(expression)) for (const property of expression.properties) if (ts.isPropertyAssignment(property)) inspect(property.initializer, scope)
      return
    }
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "className" && node.initializer) {
      const expression = ts.isStringLiteral(node.initializer) ? node.initializer : ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined
      if (expression) inspectClassExpression(expression)
      return
    }
    ts.forEachChild(node, (child) => visit(child, scope))
  }
  const topLevelScope = reserveStatements(new Map(), sourceFile.statements)
  let owner: ts.Node = declaration
  while (owner.parent && owner.parent !== sourceFile) owner = owner.parent
  for (const statement of sourceFile.statements) {
    if (statement === owner) {
      if (ts.isVariableStatement(statement) && ts.isVariableDeclaration(declaration)) {
        for (const item of statement.declarationList.declarations) {
          if (item === declaration) break
          activateDeclaration(topLevelScope, item)
        }
      }
      break
    }
    activateStatement(topLevelScope, statement)
  }
  visit(declaration, topLevelScope)
  return {
    facts: [...new Map(facts.map((fact) => [independentStableKey(fact), fact])).values()],
    unresolved: [...new Map(unresolved.map((fact) => [independentStableKey(fact), fact])).values()],
  }
}

function independentArithmeticEvidenceErrors(expected: IndependentArithmeticEvidence[], actual: IndependentArithmeticEvidence[]): string[] {
  const expectedFacts = new Map(expected.map((fact) => [independentStableKey(fact), fact]))
  const actualFacts = new Map(actual.map((fact) => [independentStableKey(fact), fact]))
  return [
    ...[...expectedFacts].filter(([key]) => !actualFacts.has(key)).map(([, fact]) => `missing ${independentStableKey(fact)}`),
    ...[...actualFacts].filter(([key]) => !expectedFacts.has(key)).map(([, fact]) => `invented ${independentStableKey(fact)}`),
  ]
}

function independentArithmeticFactErrors(
  label: string,
  contractTokenFacts: AnyRecord[],
  arithmetic: ReturnType<typeof independentSpacingArithmetic>,
  sourceUtilityFacts: AnyRecord[],
): string[] {
  const arithmeticTokenIds = new Set(arithmetic.facts.map((fact) => fact.tokenId))
  if (arithmetic.unresolved.some((fact) => fact.sourceText.includes("var(--spacing)"))) arithmeticTokenIds.add("spacing.unit")
  if (arithmeticTokenIds.size === 0) return []
  const sourceFacts = new Map<string, AnyRecord>([
    ...arithmetic.facts.map(({ source: _source, ...fact }) => fact),
    ...sourceUtilityFacts.filter((fact) => arithmeticTokenIds.has(fact.tokenId)),
  ].map((fact) => [independentStableKey(fact), fact]))
  const contractFacts = new Map<string, AnyRecord>(contractTokenFacts
    .filter((fact) => arithmeticTokenIds.has(fact.tokenId))
    .map((fact) => [independentStableKey(fact), fact]))
  return [
    ...[...sourceFacts].filter(([key]) => !contractFacts.has(key)).map(([, fact]) => `${label}: CSS token arithmetic fact differs (missing ${independentStableKey(fact)})`),
    ...[...contractFacts].filter(([key]) => !sourceFacts.has(key)).map(([, fact]) => `${label}: CSS token arithmetic fact differs (invented ${independentStableKey(fact)})`),
  ]
}

function independentImportedFactErrors(label: string, contractTokenFacts: AnyRecord[], sourceFile: ts.SourceFile, variants: ReturnType<typeof cvaFacts>): string[] {
  const importedTokenFacts = independentImportedTokenDependencies(variants.classSources.filter((fact) => fact.sourcePath !== sourceFile.fileName), true)
  const importedTokenIds = new Set(importedTokenFacts.map((fact) => fact.tokenId))
  const exactLocalFacts = independentImportedTokenDependencies([...variants.localClassSources, ...variants.classSources.filter((fact) => fact.sourcePath === sourceFile.fileName)], true)
    .filter((fact) => importedTokenIds.has(fact.tokenId))
  const sourceExactFacts = new Map<string, AnyRecord>([...importedTokenFacts, ...exactLocalFacts].map((fact) => [independentStableKey(fact), fact]))
  const contractExactFacts = new Map<string, AnyRecord>(contractTokenFacts.filter((fact) => importedTokenIds.has(fact.tokenId)).map((fact) => [independentStableKey(fact), fact]))
  return [
    ...[...sourceExactFacts].filter(([key]) => !contractExactFacts.has(key)).map(([, fact]) => `${label}: imported recipe token fact differs (missing ${independentStableKey(fact)})`),
    ...[...contractExactFacts].filter(([key]) => !sourceExactFacts.has(key)).map(([, fact]) => `${label}: imported recipe token fact differs (invented ${independentStableKey(fact)})`),
  ]
}

function independentConditionalUtilityFactErrors(label: string, contractTokenFacts: AnyRecord[], sourceFile: ts.SourceFile, variants: ReturnType<typeof cvaFacts>): string[] {
  const importedTokenIds = new Set(
    independentImportedTokenDependencies(variants.classSources.filter((fact) => fact.sourcePath !== sourceFile.fileName), true)
      .map((fact) => fact.tokenId),
  )
  const localTokenFacts = independentImportedTokenDependencies([
    ...variants.localClassSources,
    ...variants.classSources.filter((fact) => fact.sourcePath === sourceFile.fileName),
  ], true)
  const conditionalTokenIds = new Set(
    localTokenFacts
      .filter((fact) => fact.when && !importedTokenIds.has(fact.tokenId))
      .map((fact) => fact.tokenId),
  )
  const sourceExactFacts = new Map<string, AnyRecord>(
    localTokenFacts
      .filter((fact) => conditionalTokenIds.has(fact.tokenId))
      .map((fact) => [independentStableKey(fact), fact]),
  )
  const contractExactFacts = new Map<string, AnyRecord>(
    contractTokenFacts
      .filter((fact) => conditionalTokenIds.has(fact.tokenId))
      .map((fact) => [independentStableKey(fact), fact]),
  )
  return [
    ...[...sourceExactFacts].filter(([key]) => !contractExactFacts.has(key)).map(([, fact]) => `${label}: conditional utility token fact differs (missing ${independentStableKey(fact)})`),
    ...[...contractExactFacts].filter(([key]) => !sourceExactFacts.has(key)).map(([, fact]) => `${label}: conditional utility token fact differs (invented ${independentStableKey(fact)})`),
  ]
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
      const unresolvedKey = (finding: IndependentRenderUnresolved | AnyRecord) => {
        const source = "source" in finding && finding.source ? finding.source : finding
        return JSON.stringify({
        topic: "jsx-rendering",
        scope: exported.name,
        reason: finding.reason,
        sourcePath: source.sourcePath,
        start: source.start,
        end: source.end,
        expressionKind: source.expressionKind,
        sourceText: source.sourceText,
        })
      }
      const expectedRenderUnresolved = source.renderUnresolved.map((finding) => unresolvedKey({ ...finding, sourcePath: family.source.canonicalPath }))
      const actualRenderUnresolved = (family.unresolved ?? []).filter((finding: AnyRecord) => finding.topic === "jsx-rendering" && finding.scope === exported.name).map(unresolvedKey)
      if (JSON.stringify(actualRenderUnresolved.sort()) !== JSON.stringify(expectedRenderUnresolved.sort())) {
        errors.push(`${family.id}.${exported.name}: unresolved JSX render evidence differs from the canonical AST`)
      }
      if (source.propSurfaceError) errors.push(`${family.id}.${exported.name}: ${source.propSurfaceError}`)
      const variants = cvaFacts(sourceFile, source.sourceText, source.declaration)
      variants.localClassSources.push(...independentReferencedLocalRecipeSources(sourceFile, source.sourceText))
      const sourceProps = new Set([...source.bindings].filter((name) => !source.restBindings.has(name)).concat([...source.typeFacts.keys(), ...variants.variants.keys()]))
      const inheritedDefaults = new Set((exported.component.inheritedPropDefaults ?? []).map((defaultFact: AnyRecord) => defaultFact.propName))
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
      const contractedLocalProps = new Map<string, AnyRecord>((exported.component.localProps ?? []).map((prop: AnyRecord) => [prop.name, prop]))
      for (const [name, sourceFact] of source.localPropFacts) {
        if (inheritedDefaults.has(name)) continue
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
        if (inheritedProps.has(name)) errors.push(`${family.id}.${exported.name}: contract local prop ${name} duplicates an inherited prop`)
        else if (!source.localPropFacts.has(name)) errors.push(`${family.id}.${exported.name}: contract local prop ${name} is absent from the source-local signature`)
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
      const arithmetic = independentSpacingArithmetic(sourceFile, declaration)
      if (arithmetic.facts.length > 0) sourceTokenIds.add("spacing.unit")
      for (const finding of arithmetic.unresolved) errors.push(`${family.id}.${exported.name}: unresolved CSS token arithmetic at ${finding.sourcePath}:${finding.start}: ${finding.reason} (${finding.sourceText})`)
      for (const unresolved of variants.unresolved) errors.push(`${family.id}.${exported.name}: unresolved imported recipe evidence (${unresolved})`)
      const comparableContractTokens = (exported.component.tokenDependencies ?? []).map((dependency: AnyRecord) => ({
        tokenId: dependency.tokenId,
        ...(dependency.when ? { when: dependency.when } : {}),
        ...(dependency.viaDerivedRule ? { viaDerivedRule: dependency.viaDerivedRule } : {}),
        ...(dependency.sourceContext ? { sourceContext: dependency.sourceContext } : {}),
      }))
      const sourceUtilityFacts = independentImportedTokenDependencies([
        ...variants.localClassSources,
        ...variants.classSources,
      ], true)
      for (const fact of sourceUtilityFacts) sourceTokenIds.add(fact.tokenId)
      errors.push(...independentArithmeticFactErrors(`${family.id}.${exported.name}`, comparableContractTokens, arithmetic, sourceUtilityFacts))
      errors.push(...independentImportedFactErrors(`${family.id}.${exported.name}`, comparableContractTokens, sourceFile, variants))
      errors.push(...independentConditionalUtilityFactErrors(`${family.id}.${exported.name}`, comparableContractTokens, sourceFile, variants))
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
        if (attribute.expressionKind === "literal" && !matching.some((candidate) => candidate.value === attribute.value || candidate.source === "ordered-writes" && candidate.writes?.[0]?.value?.source === "literal" && candidate.writes[0].value.value === attribute.value)) {
          errors.push(`${family.id}.${exported.name}: literal ${attribute.name} value is omitted`)
        }
        if (attribute.expressionKind === "conditional" && !matching.some((candidate) => ["conditional-value", "derived-condition"].includes(candidate.source))) {
          errors.push(`${family.id}.${exported.name}: conditional ${attribute.name} fact is omitted`)
        }
        if (attribute.expressionKind === "identifier" && !matching.some((candidate) => ["prop", "primitive-state"].includes(candidate.source) || candidate.source === "ordered-writes" && ["prop", "nullish-coalesce"].includes(candidate.writes?.[0]?.value?.source))) {
          errors.push(`${family.id}.${exported.name}: derived ${attribute.name} target is omitted`)
        }
        if (attribute.expressionKind === "property-access" && !matching.some((candidate) => ["prop", "primitive-state"].includes(candidate.source) && candidate.prop === attribute.expression || candidate.source === "ordered-writes" && candidate.writes?.[0]?.value?.source === "context-field" && typeof attribute.expression === "string" && attribute.expression.endsWith(`.${candidate.writes[0].value.field}`))) {
          errors.push(`${family.id}.${exported.name}: derived ${attribute.name} property access target is omitted`)
        }
        if (attribute.expressionKind === "other" && !matching.some((candidate) => candidate.source === "derived-condition")) errors.push(`${family.id}.${exported.name}: unresolved data attribute expression ${attribute.name}`)
      }
      const directSlotValues = [...new Set(directDataAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.value))].sort()
      const contractSlotValues = [...new Set(contractAttributes.filter((attribute) => attribute.name === "data-slot").map((attribute) => attribute.source === "ordered-writes" ? attribute.writes?.[0]?.value?.value : attribute.value))].sort()
      if (JSON.stringify(directSlotValues) !== JSON.stringify(contractSlotValues)) {
        errors.push(`${family.id}.${exported.name}: data-slot values differ from the canonical JSX`)
      }

      const variantsToCheck = renderings(exported.component)
      if (!variantsToCheck.length) errors.push(`${family.id}.${exported.name}: render tree is missing`)
      if (source.renderAlternativePredicates.length || "alternatives" in exported.component.rendering) {
        const contractPredicates = "alternatives" in exported.component.rendering
          ? exported.component.rendering.alternatives.map((alternative: AnyRecord) => normalizedPredicate(alternative.when ?? { otherwise: true }))
          : []
        const sourcePredicates = source.renderUnresolved.length ? [] : source.renderAlternativePredicates.map(normalizedPredicate)
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
      } else if (source.renderBranches.length === 1) {
        const sourceTree = source.renderBranches[0]?.tree
        if (!sourceTree || !independentRenderTreeMatches(sourceTree, exported.component.rendering)) {
          errors.push(`${family.id}.${exported.name}: render tree differs from the canonical AST`)
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
    const recognizedUnresolved = new Set<string>()
    for (const exported of family.exports ?? []) {
      const declaration = declarationFor(sourceFacts(resolve(root, family.source.canonicalPath)).sourceFile, exported.name)
      if (!declaration || !exported.component) continue
      const source = componentSourceFacts(sourceFacts(resolve(root, family.source.canonicalPath)).sourceFile, declaration)
      for (const finding of source.renderUnresolved) recognizedUnresolved.add(JSON.stringify({ topic: "jsx-rendering", scope: exported.name, reason: finding.reason, sourcePath: family.source.canonicalPath, start: finding.start, end: finding.end, expressionKind: finding.expressionKind, sourceText: finding.sourceText }))
    }
    const modelLimitations: Record<string, { exportName: string; topic: string; scope: string; kind: string; anchor: string }> = {}
    const limitation = modelLimitations[family.id]
    if (limitation) {
      const file = sourceFacts(resolve(root, family.source.canonicalPath)).sourceFile
      const sourceText = file.text
      const declaration = declarationFor(file, limitation.exportName)
      for (const finding of family.unresolved ?? []) {
        if (finding.topic !== limitation.topic || finding.scope !== limitation.scope || finding.source?.expressionKind !== limitation.kind) continue
        const { start, end, sourceText: expressionText } = finding.source
        if (!declaration || start < declaration.getStart(file) || end > declaration.getEnd() || sourceText.slice(start, end) !== expressionText || !expressionText.startsWith(limitation.anchor)) continue
        recognizedUnresolved.add(JSON.stringify({ topic: finding.topic, scope: finding.scope, reason: finding.reason, sourcePath: finding.source.sourcePath, start, end, expressionKind: finding.source.expressionKind, sourceText: expressionText }))
      }
    }
    for (const finding of family.unresolved ?? []) {
      const key = finding.source ? JSON.stringify({ topic: finding.topic, scope: finding.scope, reason: finding.reason, sourcePath: finding.source.sourcePath, start: finding.source.start, end: finding.source.end, expressionKind: finding.source.expressionKind, sourceText: finding.source.sourceText }) : undefined
      if (!key || !recognizedUnresolved.has(key)) errors.push(`${family.id}: contract contains unresolved source facts the direct audit did not find`)
    }
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
    }, "pagination.PaginationPrevious: contract local prop href duplicates an inherited prop"],
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

  test("independent branch-tree oracle compares fixed-branch conditional and derived data facts", () => {
    const { sourceFile } = sourceFacts(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "ConditionalDataBranchFixture")!)
    const rendering: AnyRecord = {
      rootNodeId: "host",
      publicPropsTargetNodeId: "host",
      nodes: [{
        id: "host",
        host: { kind: "unresolved" },
        receivesPublicProps: true,
        dataAttributes: [
          {
            name: "data-state",
            source: "conditional-value",
            condition: { propName: "state", equals: "open" },
            whenTrue: { source: "literal", value: "visible" },
            whenFalse: { source: "literal", value: "hidden" },
          },
          { name: "data-open", source: "derived-condition", condition: { propName: "state", equals: "open" } },
        ],
        children: [],
      }],
      portalBoundaries: [],
    }

    expect(independentRenderTreeMatches(facts.renderBranches[1].tree!, rendering)).toBe(true)
    const wrongConditionalBranch = structuredClone(rendering)
    wrongConditionalBranch.nodes[0].dataAttributes[0].condition.equals = "closed"
    expect(independentRenderTreeMatches(facts.renderBranches[1].tree!, wrongConditionalBranch)).toBe(false)
    const wrongDerivedCondition = structuredClone(rendering)
    wrongDerivedCondition.nodes[0].dataAttributes[1].condition.equals = "closed"
    expect(independentRenderTreeMatches(facts.renderBranches[1].tree!, wrongDerivedCondition)).toBe(false)
  })

  test("independent render oracle preserves ToggleGroupItem property-access provenance", () => {
    const baseline = loadArtifacts()
    expect(directSourceErrors(baseline.families, baseline.interfaces)).toEqual([])

    const mutated = clone(baseline)
    const item = exportByName(familyById(mutated, "toggle-group"), "ToggleGroupItem").component
    item.rendering.nodes[0].dataAttributes.find((attribute: AnyRecord) => attribute.name === "data-spacing").writes[0].value.field = "spacingWrong"

    expect(directSourceErrors(mutated.families, mutated.interfaces)).toContain(
      "toggle-group.ToggleGroupItem: derived data-spacing property access target is omitted",
    )
  }, 30_000)

  test("independent render oracle accepts only imported useMemo dynamic children", () => {
    const { sourceFile } = sourceFacts(join(root, "tests/fixtures/component-analysis-completeness-fixture.tsx"))
    const imported = componentSourceFacts(sourceFile, declarationFor(sourceFile, "ImportedUseMemoChildFixture")!)
    const counterfeit = componentSourceFacts(sourceFile, declarationFor(sourceFile, "CounterfeitMemoChildFixture")!)

    expect(imported.renderUnresolved).toEqual([])
    expect(counterfeit.renderUnresolved).toEqual([
      expect.objectContaining({ expressionKind: "Identifier", sourceText: "content", reason: "Unsupported JSX child expression: content" }),
    ])
  })

  test("independent local-prop oracle rejects a ToggleGroup provider prop redeclared as local", () => {
    const baseline = loadArtifacts()
    const mutated = clone(baseline)
    const toggle = exportByName(familyById(mutated, "toggle-group"), "ToggleGroup").component
    toggle.localProps.push({
      name: "orientation",
      required: false,
      type: { kind: "enum", values: ["horizontal", "vertical"] },
      default: "horizontal",
      evidenceRefs: ["source"],
    })

    expect(directSourceErrors(mutated.families, mutated.interfaces)).toContain(
      "toggle-group.ToggleGroup: contract local prop orientation duplicates an inherited prop",
    )
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

  test("independently discovers all six Button render branches and their loading children", () => {
    const { sourceFile } = sourceFacts(join(root, "src/components/ui/button.tsx"))
    const facts = componentSourceFacts(sourceFile, declarationFor(sourceFile, "Button")!)
    const host = (asChild: boolean) => ({ propName: "asChild", equals: asChild })
    const state = (name: string, equals: boolean) => ({ source: "state", name, equals })

    expect(facts.renderAlternativePredicates).toEqual([
      { all: [host(true), state("isLoading", true), state("hasRawHtml", true)] },
      { all: [host(true), state("isLoading", true), state("hasRawHtml", false)] },
      { all: [host(true), state("isLoading", false)] },
      { all: [host(false), state("isLoading", true), state("hasRawHtml", true)] },
      { all: [host(false), state("isLoading", true), state("hasRawHtml", false)] },
      { all: [host(false), state("isLoading", false)] },
    ])
    const tags = (node: IndependentRenderNode): string[] => [node.resolvedTag ?? node.tag, ...node.children.flatMap(({ node: child }) => tags(child))]
    expect(facts.renderBranches.map(({ tree }) => tree && tags(tree))).toEqual([
      ["Slot.Root", "Fragment", "Spinner", "Slot.Slottable", "span"],
      ["Slot.Root", "Fragment", "Spinner", "Slot.Slottable"],
      ["Slot.Root"],
      ["button", "Fragment", "Spinner", "Slot.Slottable", "span"],
      ["button", "Fragment", "Spinner", "Slot.Slottable"],
      ["button"],
    ])
    expect(facts.renderUnresolved).toEqual([])
  })

  test("independently resolves the pinned aliased Toggle CVA recipe with conditions and provenance", () => {
    const toggleGroupPath = join(root, "src/components/ui/toggle-group.tsx")
    const togglePath = join(root, "src/components/ui/toggle.tsx")
    const { sourceFile } = sourceFacts(toggleGroupPath)
    const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, "ToggleGroupItem")!)
    const facts = cvaFacts(sourceFile, source.sourceText, source.declaration) as ReturnType<typeof cvaFacts> & {
      classSources?: Array<{ classNames: string; propName?: string; equals?: string; sourcePath: string }>
      unresolved?: string[]
    }

    expect(facts.unresolved).toEqual([])
    expect(facts.classSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ classNames: expect.stringContaining("group/toggle"), sourcePath: togglePath }),
      expect.objectContaining({ classNames: "border border-input bg-transparent hover:bg-muted", propName: "variant", equals: "outline", sourcePath: togglePath }),
      expect.objectContaining({ classNames: expect.stringContaining("rounded-md"), propName: "size", equals: "sm", sourcePath: togglePath }),
    ]))
  })

  test("independent imported-recipe audit rejects a condition mutation", () => {
    const artifacts = clone(loadArtifacts())
    const component = exportByName(familyById(artifacts, "toggle-group"), "ToggleGroupItem").component
    component.tokenDependencies.find((dependency: AnyRecord) => dependency.tokenId === "color.input").when.equals = "default"

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContainEqual(expect.stringContaining("toggle-group.ToggleGroupItem: imported recipe token fact differs"))
  }, 60_000)

  test("independent utility parser preserves exact data conditions and stacked conjunctions", () => {
    const facts = independentImportedTokenDependencies([
      { classNames: "data-[size=sm]:rounded-md", sourcePath: "fixture.tsx" },
      { classNames: "group-data-[orientation=vertical]/root:data-[spacing=0]:gap-2", sourcePath: "fixture.tsx" },
      { classNames: "data-[state=open]:bg-background", propName: "tone", equals: "default", sourcePath: "fixture.tsx" },
      { classNames: "aria-invalid:bg-destructive", sourcePath: "fixture.tsx" },
    ])

    expect(facts).toEqual(expect.arrayContaining([
      { tokenId: "radius.md", when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "sm" } },
      {
        tokenId: "spacing.unit",
        when: { all: [
          { subject: "data", path: [{ kind: "group", name: "root" }], propName: "orientation", equals: "vertical" },
          { subject: "data", path: [{ kind: "self" }], propName: "spacing", equals: 0 },
        ] },
        viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 },
      },
      {
        tokenId: "color.background",
        when: { all: [{ propName: "tone", equals: "default" }, { subject: "data", path: [{ kind: "self" }], propName: "state", equals: "open" }] },
      },
      { tokenId: "color.destructive", when: { subject: "aria", path: [{ kind: "self" }], propName: "invalid", equals: true } },
    ]))
  })

  test("independent context parser keeps selector applicability separate from data conditions", () => {
    expect(independentImportedTokenDependencies([{
      classNames: "group-data-[side=right]/root:data-[spacing=0]:first:after:-space-x-2",
      sourcePath: "fixture.tsx",
    }], true)).toEqual([{
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: -2 },
      when: { subject: "data", path: [{ kind: "self" }], propName: "spacing", equals: 0 },
      sourceContext: {
        applicability: ["group-data-[side=right]/root", "first"],
        target: { kind: "pseudo-element", name: "after" },
      },
    }])
  })

  test("independent utility grammar preserves scoped relations and rejects lexical ambiguity", () => {
    expect(independentImportedTokenDependencies([{
      classNames: "group-data-[size=sm]/root:data-[size=lg]:rounded-md group-aria-[expanded=true]/root:rounded-lg peer-aria-checked/item:rounded-lg in-aria-[busy=true]:rounded-lg has-aria-[label=x]:rounded-lg group-has-data-[slot=media]/root:rounded-lg data-[label=some\\_value]:rounded-lg placeholder:text-sm",
      sourcePath: "fixture.tsx",
    }])).toEqual(expect.arrayContaining([
      { tokenId: "radius.md", when: { all: [
        { subject: "data", path: [{ kind: "group", name: "root" }], propName: "size", equals: "sm" },
        { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "lg" },
      ] } },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "group", name: "root" }], propName: "expanded", equals: true } },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "peer", name: "item" }], propName: "checked", equals: true } },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "in" }], propName: "busy", equals: true } },
      { tokenId: "radius.lg", when: { subject: "aria", path: [{ kind: "has" }], propName: "label", equals: "x" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "has" }], propName: "slot", equals: "media" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "some_value" } },
      { tokenId: "font-size.sm" },
    ]))

    expect(independentImportedTokenDependencies([{
      classNames: "in-data-[state=open]/root:rounded-md not-data-[state=open]:rounded-md rounded-md\\",
      sourcePath: "fixture.tsx",
    }])).toEqual([])
  })

  test("independent utility grammar preserves compound relation order and escaped brackets", () => {
    expect(independentImportedTokenDependencies([{
      classNames: "has-group-data-[state=open]/root:rounded-lg group-has-data-[state=open]/root:rounded-lg has-peer-data-[state=open]/item:rounded-lg group-in-data-[state=open]/root:rounded-lg has-in-data-[state=open]:rounded-lg data-[label=a\\[b]:rounded-lg data-[label=a\\]b]:rounded-lg",
      sourcePath: "fixture.tsx",
    }])).toEqual([
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "group", name: "root" }], propName: "state", equals: "open" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "has" }], propName: "state", equals: "open" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "peer", name: "item" }], propName: "state", equals: "open" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "group", name: "root" }, { kind: "in" }], propName: "state", equals: "open" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "has" }, { kind: "in" }], propName: "state", equals: "open" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "a[b" } },
      { tokenId: "radius.lg", when: { subject: "data", path: [{ kind: "self" }], propName: "label", equals: "a]b" } },
    ])
  })

  test("independent token resolution matches complete utility identities", () => {
    expect(independentImportedTokenDependencies([{
      classNames: "content-['bg-primary'] content-['rounded-md']",
      sourcePath: "fixture.tsx",
    }])).toEqual([])
  })

  test("independent utility parser fails closed for malformed, dynamic, unsupported, ambiguous, and contradictory prefixes", () => {
    expect(independentImportedTokenDependencies([{
      classNames: "data-[size=sm:rounded-md data-[${dimension}=sm]:rounded-lg mystery-data-[size=sm]:bg-background [&:has([data-size=sm])]:bg-destructive data-[size=sm]:data-[size=lg]:rounded-md data-[size=sm]/named-self:rounded-md",
      sourcePath: "fixture.tsx",
    }])).toEqual([])
  })

  test("independently resolves CSS spacing arithmetic with exact conditions and provenance", () => {
    const fixturePath = join(root, "tests/fixtures/token-arithmetic-fixture.tsx")
    const sourceFile = sourceFacts(fixturePath).sourceFile
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "ExactArithmeticFixture")!)

    expect(facts.unresolved).toEqual([])
    expect(facts.facts.map((fact) => fact.viaDerivedRule?.multiplier)).toEqual(expect.arrayContaining([0, 2, -1.5, 0.25, 2.5]))
    expect(facts.facts).toContainEqual(expect.objectContaining({
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 2.5 },
      when: { subject: "data", path: [{ kind: "self" }], propName: "size", equals: "sm" },
    }))
    expect(facts.facts).toContainEqual(expect.objectContaining({
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 0.25 },
      source: {
        sourcePath: fixturePath,
        start: 350,
        end: 393,
        expressionKind: "TemplateExpression",
        sourceText: "`calc(var(--spacing) * ${STATIC_FRACTION})`",
      },
    }))
  })

  test.each([
    ["UnsupportedOperatorFixture", "Unsupported CSS token arithmetic operator."],
    ["MultipleVariablesFixture", "CSS token arithmetic must reference exactly one variable."],
    ["UnknownVariableFixture", "CSS token arithmetic references an unapproved variable."],
    ["NonnumericOperandFixture", "CSS token arithmetic operand is not numeric."],
    ["AmbiguousInterpolationFixture", "Ambiguous CSS token arithmetic interpolation."],
    ["DivisionByZeroFixture", "CSS token arithmetic divides by zero."],
    ["ReversedShapeFixture", "CSS token arithmetic expression shape is not equivalent."],
  ])("independent arithmetic parser rejects %s without partial facts", (exportName, reason) => {
    const sourceFile = sourceFacts(join(root, "tests/fixtures/token-arithmetic-fixture.tsx")).sourceFile
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, exportName)!)
    expect(facts.facts).toEqual([])
    expect(facts.unresolved).toHaveLength(1)
    expect(facts.unresolved[0]).toEqual(expect.objectContaining({ reason, sourceText: expect.stringContaining("calc(") }))
  })

  test("independently records approved dynamic spacing as a bare token fact and ignores component geometry", () => {
    const sourceFile = sourceFacts(join(root, "tests/fixtures/token-arithmetic-fixture.tsx")).sourceFile
    const dynamic = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "DynamicOperandFixture")!)
    expect(dynamic.unresolved).toEqual([])
    expect(dynamic.facts).toEqual([expect.objectContaining({
      tokenId: "spacing.unit",
      source: expect.objectContaining({ sourceText: "`calc(var(--spacing) * ${multiplier})`" }),
    })])
    expect(dynamic.facts[0]).not.toHaveProperty("viaDerivedRule")

    const trailing = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "DynamicTrailingContentFixture")!)
    expect(trailing.facts).toEqual([])
    expect(trailing.unresolved).toEqual([
      expect.objectContaining({ reason: "Dynamic CSS token arithmetic operand." }),
    ])

    const geometry = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "ComponentLayoutVariableFixture")!)
    expect(geometry).toEqual({ facts: [], unresolved: [] })
  })

  test.each([
    "OverflowNumericFixture",
    "ScientificNumericFixture",
    "NaNNumericFixture",
    "InfinityNumericFixture",
  ])("independent arithmetic parser rejects non-finite decimal form in %s", (exportName) => {
    const sourceFile = sourceFacts(join(root, "tests/fixtures/token-arithmetic-fixture.tsx")).sourceFile
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, exportName)!)
    expect(facts.facts).toEqual([])
    expect(facts.unresolved).toEqual([
      expect.objectContaining({ reason: "CSS token arithmetic operand is not a finite decimal." }),
    ])
  })

  test("independent arithmetic parser canonicalizes negative zero", () => {
    const sourceFile = sourceFacts(join(root, "tests/fixtures/token-arithmetic-fixture.tsx")).sourceFile
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "NegativeZeroFixture")!)
    expect(facts.unresolved).toEqual([])
    expect(facts.facts).toHaveLength(1)
    expect(facts.facts[0].viaDerivedRule!.multiplier).toBe(0)
    expect(Object.is(facts.facts[0].viaDerivedRule!.multiplier, -0)).toBe(false)
  })

  test("independent arithmetic mutations expose multiplier, operator, variable, and provenance drift", () => {
    const inspect = (sourceText: string) => {
      const sourceFile = ts.createSourceFile("/virtual/arithmetic-mutation.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      return independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "MutationFixture")!)
    }
    const multiplier = inspect('function MutationFixture() { return <div style={{ gap: "calc(var(--spacing) * 3)" }} /> }')
    expect(multiplier.facts).toEqual([expect.objectContaining({
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 3 },
      source: expect.objectContaining({ sourcePath: "/virtual/arithmetic-mutation.tsx", expressionKind: "StringLiteral", sourceText: '"calc(var(--spacing) * 3)"' }),
    })])
    expect(inspect('function MutationFixture() { return <div style={{ gap: "calc(var(--spacing) + 3)" }} /> }').unresolved[0]?.reason).toBe("Unsupported CSS token arithmetic operator.")
    expect(inspect('function MutationFixture() { return <div style={{ gap: "calc(var(--space) * 3)" }} /> }').unresolved[0]?.reason).toBe("CSS token arithmetic references an unapproved variable.")
    const shiftedProvenance = inspect('\nfunction MutationFixture() { return <div style={{ gap: "calc(var(--spacing) * 3)" }} /> }')
    expect(shiftedProvenance.facts[0]?.source.start).toBe(multiplier.facts[0]!.source.start + 1)
    expect(independentArithmeticEvidenceErrors(multiplier.facts, shiftedProvenance.facts)).toEqual([
      expect.stringContaining("missing"),
      expect.stringContaining("invented"),
    ])
  })

  test("independent arithmetic comparison rejects extra, multiplier, condition, and operator-derived facts", () => {
    const inspect = (sourceText: string) => {
      const sourceFile = ts.createSourceFile("/virtual/arithmetic-comparison.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      return independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "ComparisonFixture")!)
    }
    const exact = inspect('function ComparisonFixture() { return <div style={{ gap: "calc(var(--spacing) * 3)" }} /> }')
    const fact = (multiplier: number, when?: AnyRecord) => ({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier },
      ...(when ? { when } : {}),
    })
    expect(independentArithmeticFactErrors("fixture", [fact(3)], exact, [])).toEqual([])
    expect(independentArithmeticFactErrors("fixture", [fact(3), fact(4)], exact, [])).toContainEqual(expect.stringContaining("invented"))
    expect(independentArithmeticFactErrors("fixture", [fact(4)], exact, [])).toEqual(expect.arrayContaining([
      expect.stringContaining("missing"),
      expect.stringContaining("invented"),
    ]))
    expect(independentArithmeticFactErrors("fixture", [fact(3, { propName: "size", equals: "sm" })], exact, [])).toEqual(expect.arrayContaining([
      expect.stringContaining("missing"),
      expect.stringContaining("invented"),
    ]))
    const unsupported = inspect('function ComparisonFixture() { return <div style={{ gap: "calc(var(--spacing) + 3)" }} /> }')
    expect(independentArithmeticFactErrors("fixture", [fact(3)], unsupported, [])).toEqual([
      expect.stringContaining("invented"),
    ])
  })

  test("independent arithmetic lookup uses the nearest lexical binding only", () => {
    const fixturePath = join(root, "tests/fixtures/token-arithmetic-fixture.tsx")
    const sourceFile = sourceFacts(fixturePath).sourceFile
    const inspect = (exportName: string) => independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, exportName)!)

    expect(inspect("OutOfScopeBindingFixture").facts).toEqual([expect.objectContaining({ tokenId: "spacing.unit" })])
    expect(inspect("OutOfScopeBindingFixture").unresolved).toEqual([])
    expect(inspect("NestedShadowBindingFixture").facts).toEqual([
      expect.objectContaining({ viaDerivedRule: { id: "spacing.multiplier", multiplier: 6 } }),
    ])
    expect(inspect("SameNameOwnerTwo").facts).toEqual([
      expect.objectContaining({ viaDerivedRule: { id: "spacing.multiplier", multiplier: 9 } }),
    ])
  })

  test("independent arithmetic keeps a later block declaration unavailable before execution", () => {
    const sourceFile = ts.createSourceFile(
      "/virtual/arithmetic-use-before-declaration.tsx",
      'const MULTIPLIER = 2\nfunction UseBeforeDeclarationFixture() { const view = <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} />; const MULTIPLIER = 3; return view }',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "UseBeforeDeclarationFixture")!)
    expect(facts.facts).toEqual([expect.objectContaining({ tokenId: "spacing.unit" })])
    expect(facts.unresolved).toEqual([])
  })

  test.each([
    ["ForFixture", 'for (const MULTIPLIER = 3; false;) { return <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} /> }', 3],
    ["ForOfFixture", 'for (const MULTIPLIER of [3]) { return <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} /> }', undefined],
    ["ForInFixture", 'for (const MULTIPLIER in { 3: true }) { return <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} /> }', undefined],
  ] as const)("independent arithmetic applies the nearest loop binding in %s", (exportName, loop, multiplier) => {
    const sourceFile = ts.createSourceFile(
      `/virtual/arithmetic-${exportName}.tsx`,
      `const MULTIPLIER = 2\nfunction ${exportName}() { ${loop}; return null }`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const facts = independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, exportName)!)
    if (multiplier === undefined) {
      expect(facts.facts).toEqual([expect.objectContaining({ tokenId: "spacing.unit" })])
      expect(facts.unresolved).toEqual([])
    } else {
      expect(facts.unresolved).toEqual([])
      expect(facts.facts).toEqual([expect.objectContaining({ viaDerivedRule: { id: "spacing.multiplier", multiplier } })])
    }
  })

  test("independent arithmetic applies switch case scope and its temporal dead zone", () => {
    const inspect = (body: string) => {
      const sourceFile = ts.createSourceFile(
        "/virtual/arithmetic-switch.tsx",
        `const MULTIPLIER = 2\nfunction SwitchFixture(value: number) { switch (value) { case 1: ${body} } return null }`,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      return independentSpacingArithmetic(sourceFile, declarationFor(sourceFile, "SwitchFixture")!)
    }
    const afterDeclaration = inspect('const MULTIPLIER = 4; return <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} />')
    expect(afterDeclaration.unresolved).toEqual([])
    expect(afterDeclaration.facts).toEqual([expect.objectContaining({ viaDerivedRule: { id: "spacing.multiplier", multiplier: 4 } })])

    const beforeDeclaration = inspect('const view = <div style={{ gap: `calc(var(--spacing) * ${MULTIPLIER})` }} />; const MULTIPLIER = 4; return view')
    expect(beforeDeclaration.facts).toEqual([expect.objectContaining({ tokenId: "spacing.unit" })])
    expect(beforeDeclaration.unresolved).toEqual([])
  })

  test("independent arithmetic audit rejects invented exact spacing facts bidirectionally", () => {
    const artifacts = clone(loadArtifacts())
    const toggleGroup = exportByName(familyById(artifacts, "toggle-group"), "ToggleGroup").component
    toggleGroup.tokenDependencies.push({
      tokenId: "spacing.unit",
      viaDerivedRule: { id: "spacing.multiplier", multiplier: 999 },
      when: { propName: "spacing", equals: 999 },
      evidenceRefs: ["source", "tokens"],
    })

    expect(directSourceErrors(artifacts.families, artifacts.interfaces)).toContainEqual(expect.stringContaining(
      'toggle-group.ToggleGroup: CSS token arithmetic fact differs (invented {"tokenId":"spacing.unit","viaDerivedRule":{"id":"spacing.multiplier","multiplier":999},"when":{"equals":999,"propName":"spacing"}})',
    ))
  })

  test("independent family audit resolves canonical dynamic spacing without an exact multiplier", () => {
    const errors = directSourceErrors(loadArtifacts().families, loadArtifacts().interfaces)
    expect(errors).not.toContainEqual(expect.stringContaining("toggle-group.ToggleGroup: unresolved CSS token arithmetic"))
    expect(errors).not.toContainEqual(expect.stringContaining("toggle-group.ToggleGroup: CSS token arithmetic fact differs"))
  })

  test("independent family audit compares local utility conditions exactly", () => {
    const artifacts = clone(loadArtifacts())
    const checkbox = exportByName(familyById(artifacts, "checkbox"), "Checkbox").component
    checkbox.tokenDependencies.find((dependency: AnyRecord) => dependency.tokenId === "color.primary").when = { propName: "state", equals: "unchecked" }

    const errors = directSourceErrors(artifacts.families, artifacts.interfaces)
      .filter((error) => error.includes("checkbox.Checkbox: conditional utility token fact differs"))
    expect(errors).toContainEqual(expect.stringContaining('missing {"tokenId":"color.primary","when":{"equals":"checked","path":[{"kind":"self"}],"propName":"state","subject":"data"}}'))
    expect(errors).toContainEqual(expect.stringContaining('invented {"tokenId":"color.primary","when":{"equals":"unchecked","propName":"state"}}'))
  })

  test("independent imported-recipe parsing fails closed for invalid authority, selectors, invocation values, and lexical shadowing", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const wrongConsumerPath = join(root, "tests/fixtures/imported-cva-wrong-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const analyze = (sourcePath: string, exportName: string) => {
      const { sourceFile } = sourceFacts(sourcePath)
      const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      return cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)
    }

    for (const exportName of [
      "UnknownKeyFixture",
      "UnknownValueFixture",
      "AmbiguousInvocationFixture",
      "UnsupportedInvocationFixture",
      "ComputedElementSelectorFixture",
      "ArbitraryCallPropertyFixture",
      "ParameterShadowFixture",
      "LocalShadowFixture",
      "FunctionShadowFixture",
      "ReexportFixture",
    ]) {
      const facts = analyze(consumerPath, exportName)
      expect(facts.unresolved.length, exportName).toBeGreaterThan(0)
      expect(facts.classSources, exportName).toEqual([])
    }

    const wrongModule = analyze(wrongConsumerPath, "WrongSourceFixture")
    expect(wrongModule.unresolved).not.toEqual([])
    expect(wrongModule.classSources).toEqual([])

    const toggleSeed = independentSeedComponents.find((component) => component.canonicalPath === "src/components/ui/toggle.tsx")!
    const originalBlob = toggleSeed.canonicalBlobSha
    try {
      toggleSeed.canonicalBlobSha = "0000000000000000000000000000000000000000"
      const stale = analyze(join(root, "src/components/ui/toggle-group.tsx"), "ToggleGroupItem")
      expect(stale.unresolved).not.toEqual([])
      expect(stale.classSources).toEqual([])
    } finally {
      toggleSeed.canonicalBlobSha = originalBlob
    }
  })

  test("independent recipe discovery audits class-producing calls without treating unrelated body calls as token inputs", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const { sourceFile } = sourceFacts(consumerPath)
    const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, "UnrelatedBodyCallFixture")!)
    const facts = cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)

    expect(facts.unresolved).toEqual([])
    expect(facts.classSources).not.toEqual([])

    const wrongPath = join(root, "tests/fixtures/imported-cva-wrong-consumer.tsx")
    const wrongFile = sourceFacts(wrongPath).sourceFile
    const wrongSource = componentSourceFacts(wrongFile, declarationFor(wrongFile, "WrongSourceFixture")!)
    const wrongFacts = cvaFacts(wrongFile, wrongSource.sourceText, wrongSource.declaration)
    expect(wrongFacts.unresolved).not.toEqual([])
    expect(wrongFacts.classSources).toEqual([])
  })

  test("independent recipe authority follows nearest catch, loop, switch, and selector bindings", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const { sourceFile } = sourceFacts(consumerPath)
    for (const exportName of ["CatchShadowFixture", "ForShadowFixture", "ForOfShadowFixture", "ForInShadowFixture", "SwitchShadowFixture", "PublicPropLocalShadowFixture"]) {
      const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      const facts = cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)
      expect(facts.unresolved.length, exportName).toBeGreaterThan(0)
      expect(facts.classSources, exportName).toEqual([])
    }
  })

  test("independent discovery traces class roots through wrappers, default and namespace calls, and excludes off-root recipes", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const { sourceFile } = sourceFacts(consumerPath)
    const analyze = (exportName: string) => {
      const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      return cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)
    }

    const wrapped = analyze("WrappedRecipeFixture")
    expect(wrapped.unresolved).toEqual([])
    expect(wrapped.classSources).not.toEqual([])

    for (const exportName of ["DefaultImportFixture", "NamespaceImportFixture"]) {
      const facts = analyze(exportName)
      expect(facts.unresolved.length, exportName).toBeGreaterThan(0)
      expect(facts.classSources, exportName).toEqual([])
    }

    const outside = analyze("RecipeOutsideClassRootFixture")
    expect(outside.unresolved).toEqual([])
    expect(outside.classSources).toEqual([])
  })

  test("independent discovery traces mapped callbacks and invoked nested render functions", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const sourceFile = sourceFacts(consumerPath).sourceFile
    const exactFacts = [
      { tokenId: "radius.lg" },
      { tokenId: "font-size.sm" },
      { tokenId: "color.background" },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 } },
    ]
    for (const exportName of ["MappedImportedRecipeFixture", "NestedImportedRecipeFixture"]) {
      const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      const facts = cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)
      expect(facts.unresolved, exportName).toEqual([])
      expect(independentImportedFactErrors(exportName, exactFacts, sourceFile, facts), exportName).toEqual([])
      expect(facts.classSources.length, exportName).toBeGreaterThan(0)
    }
  })

  test("independent nested render discovery fails closed without leaking recipe facts", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const sourceFile = sourceFacts(consumerPath).sourceFile
    const analyze = (exportName: string, authority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)) => {
      const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, exportName)!)
      return cvaFacts(sourceFile, source.sourceText, source.declaration, authority)
    }

    for (const exportName of ["MappedWrongRecipeFixture", "NestedDefaultRecipeFixture", "MappedNamespaceRecipeFixture", "MappedShadowRecipeFixture"]) {
      const facts = analyze(exportName)
      expect(facts.unresolved.length, exportName).toBeGreaterThan(0)
      expect(facts.classSources, exportName).toEqual([])
    }
    const stale = analyze("MappedImportedRecipeFixture", () => undefined)
    expect(stale.unresolved.length).toBeGreaterThan(0)
    expect(stale.classSources).toEqual([])
  })

  test("independent nested render discovery excludes closure results used only as conditions", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const sourceFile = sourceFacts(consumerPath).sourceFile
    const source = componentSourceFacts(sourceFile, declarationFor(sourceFile, "UnusedNestedRecipeFixture")!)
    const facts = cvaFacts(sourceFile, source.sourceText, source.declaration, fixtureAuthority)
    expect(facts.unresolved).toEqual([])
    expect(facts.classSources).toEqual([])
  })

  test("independent imported-recipe comparison is exact, deduplicated, and key-order insensitive", () => {
    const consumerPath = join(root, "tests/fixtures/imported-cva-consumer.tsx")
    const fixtureProviderPath = join(root, "tests/fixtures/imported-cva-recipe.ts")
    const fixtureAuthority = (moduleSpecifier: string) => moduleSpecifier === "./imported-cva-recipe" ? fixtureProviderPath : independentRecipeSource(moduleSpecifier)
    const fixtureFile = sourceFacts(consumerPath).sourceFile
    const fixtureSource = componentSourceFacts(fixtureFile, declarationFor(fixtureFile, "LocalAndImportedFixture")!)
    const fixtureFacts = cvaFacts(fixtureFile, fixtureSource.sourceText, fixtureSource.declaration, fixtureAuthority)
    expect(independentImportedFactErrors("fixture", [
      { tokenId: "radius.lg" },
      { tokenId: "font-size.sm" },
      { tokenId: "color.background" },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 0 } },
      { tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: 2 } },
    ], fixtureFile, fixtureFacts)).toEqual([])

    const importedErrors = (artifacts: ReturnType<typeof loadArtifacts>) => directSourceErrors(artifacts.families, artifacts.interfaces)
      .filter((error) => error.includes("toggle-group.ToggleGroupItem: imported recipe token fact differs"))
    const baselineArtifacts = loadArtifacts()
    const baselineErrors = importedErrors(baselineArtifacts)
    expect(baselineErrors).toEqual([])

    const reordered = clone(baselineArtifacts)
    const reorderedComponent = exportByName(familyById(reordered, "toggle-group"), "ToggleGroupItem").component
    reorderedComponent.tokenDependencies.find((dependency: AnyRecord) => dependency.tokenId === "color.input").when = { equals: "outline", propName: "variant" }
    expect(importedErrors(reordered)).toEqual(baselineErrors)

    const inserted = clone(baselineArtifacts)
    exportByName(familyById(inserted, "toggle-group"), "ToggleGroupItem").component.tokenDependencies.push({
      tokenId: "color.input",
      when: { propName: "variant", equals: "default" },
      evidenceRefs: ["source", "tokens"],
    })
    expect(importedErrors(inserted)).toContainEqual(expect.stringContaining('invented {"tokenId":"color.input","when":{"equals":"default","propName":"variant"}}'))

    const omitted = clone(baselineArtifacts)
    const omittedComponent = exportByName(familyById(omitted, "toggle-group"), "ToggleGroupItem").component
    omittedComponent.tokenDependencies = omittedComponent.tokenDependencies.filter((dependency: AnyRecord) => dependency.tokenId !== "color.input")
    expect(importedErrors(omitted)).toContainEqual(expect.stringContaining('missing {"tokenId":"color.input","when":{"equals":"outline","propName":"variant"}}'))

    const derivationDrift = clone(baselineArtifacts)
    const driftComponent = exportByName(familyById(derivationDrift, "toggle-group"), "ToggleGroupItem").component
    driftComponent.tokenDependencies.find((dependency: AnyRecord) => dependency.tokenId === "spacing.unit" && dependency.viaDerivedRule?.multiplier === 7 && dependency.when?.propName === "size" && dependency.when?.equals === "sm").viaDerivedRule.multiplier = 8
    const driftErrors = importedErrors(derivationDrift)
    expect(driftErrors).toContainEqual(expect.stringContaining('missing {"tokenId":"spacing.unit","viaDerivedRule":{"id":"spacing.multiplier","multiplier":7},"when":{"equals":"sm","propName":"size"}}'))
    expect(driftErrors).toContainEqual(expect.stringContaining('invented {"tokenId":"spacing.unit","viaDerivedRule":{"id":"spacing.multiplier","multiplier":8},"when":{"equals":"sm","propName":"size"}}'))
  }, 60_000)

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

  test("independently recognizes only supported signed numeric spacing evidence", () => {
    const spacingOnly = new Set(["spacing.unit"])

    for (const utility of ["right-1", "-mx-1", "after:-inset-2", "group-data-[orientation=vertical]/tabs:after:-right-1"]) {
      expect(directTokenEvidence(utility, spacingOnly), utility).toEqual(spacingOnly)
    }
    for (const utility of ["-translate-x-1/2", "-rotate-45", "bottom-[-5px]", "-size-1", "-h-1", "-p-1", "-gap-1"]) {
      expect(directTokenEvidence(utility, spacingOnly), utility).toEqual(new Set())
    }
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
        const rendering = component.rendering.alternatives[0].rendering
        rendering.nodes[0].dataAttributes = rendering.nodes[0].dataAttributes.filter((item: AnyRecord) => item.name !== "data-size")
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
