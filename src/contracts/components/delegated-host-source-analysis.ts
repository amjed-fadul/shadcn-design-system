import { readFileSync } from "node:fs"

import ts from "typescript"

import type { SourceOwnedSlotFact } from "./source-reconciliation"

export type DelegatedHostSourceAnalysisConventions = {
  matchesReplacementHost(expression: ts.Expression): boolean
  /** Resolves a selected primitive to the source that defines its child behavior. */
  resolveReplacementHostSource?: (expression: ts.Expression, sourcePath: string) => string | undefined
}

export type DelegatedHostSourceAnalysis = {
  facts: SourceOwnedSlotFact[]
  errors: string[]
}

type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression

function sourceFunction(file: ts.SourceFile, exportName: string): SourceFunction | undefined {
  let result: SourceFunction | undefined
  const visit = (node: ts.Node) => {
    if (result) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === exportName) result = node
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === exportName && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) result = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

function sourceRestProps(declaration: SourceFunction): Set<string> {
  const props = new Set<string>()
  const parameter = declaration.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return props
  for (const element of parameter.name.elements) if (element.dotDotDotToken && ts.isIdentifier(element.name)) props.add(element.name.text)
  return props
}

function forwardsPublicProps(declaration: SourceFunction, hostName: string, restProps: ReadonlySet<string>): boolean {
  let forwards = false
  const visit = (node: ts.Node) => {
    if (forwards) return
    const matchesHost = (tagName: ts.JsxTagNameExpression) => ts.isIdentifier(tagName) && tagName.text === hostName
    const hasPublicSpread = (attributes: ts.JsxAttributes) => attributes.properties.some((attribute) => ts.isJsxSpreadAttribute(attribute) && ts.isIdentifier(attribute.expression) && restProps.has(attribute.expression.text))
    if (ts.isJsxSelfClosingElement(node) && matchesHost(node.tagName)) { forwards = hasPublicSpread(node.attributes); return }
    if (ts.isJsxOpeningElement(node) && matchesHost(node.tagName)) { forwards = hasPublicSpread(node.attributes); return }
    ts.forEachChild(node, visit)
  }
  if (declaration.body) visit(declaration.body)
  return forwards
}

function sourceFile(sourcePath: string): ts.SourceFile {
  return ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function isReactChildrenMember(expression: ts.Expression, member: string): boolean {
  return ts.isPropertyAccessExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && ts.isIdentifier(expression.expression.expression)
    && expression.expression.expression.text === "React"
    && expression.expression.name.text === "Children"
    && expression.name.text === member
}

type ChildCardinality = { min: number; max: number }

const unrestrictedChildCardinality: ChildCardinality = { min: 0, max: Number.MAX_SAFE_INTEGER }

function isChildrenArgument(expression: ts.Expression | undefined): boolean {
  return Boolean(expression && ts.isIdentifier(expression) && expression.text === "children")
}

function isChildrenCountCall(expression: ts.Expression): expression is ts.CallExpression {
  return ts.isCallExpression(expression) && isReactChildrenMember(expression.expression, "count") && isChildrenArgument(expression.arguments[0])
}

function countComparison(expression: ts.Expression): { count: number; acceptsOnlyMatch: boolean } | undefined {
  if (!ts.isBinaryExpression(expression)) return undefined
  const operators = [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]
  if (!operators.includes(expression.operatorToken.kind) || !isChildrenCountCall(expression.left) || !ts.isNumericLiteral(expression.right)) return undefined
  const count = Number(expression.right.text)
  if (!Number.isSafeInteger(count) || count < 0) return undefined
  return { count, acceptsOnlyMatch: [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(expression.operatorToken.kind) }
}

function rejectsInvalidChildren(statement: ts.Statement): boolean {
  if (ts.isThrowStatement(statement)) return true
  return ts.isBlock(statement) && statement.statements.length > 0 && rejectsInvalidChildren(statement.statements[statement.statements.length - 1])
}

function exactCardinalityFromRejectingCountGuard(node: ts.Node): ChildCardinality | undefined {
  let result: ChildCardinality | undefined
  const visit = (candidate: ts.Node) => {
    if (result) return
    if (ts.isFunctionLike(candidate) && candidate !== node) return
    if (ts.isIfStatement(candidate)) {
      const comparison = countComparison(candidate.expression)
      if (comparison && ((comparison.acceptsOnlyMatch && rejectsInvalidChildren(candidate.thenStatement)) || (!comparison.acceptsOnlyMatch && candidate.elseStatement && rejectsInvalidChildren(candidate.elseStatement)))) {
        result = { min: comparison.count, max: comparison.count }
        return
      }
    }
    // An identifier named `assert` does not establish a rejection path. Its
    // implementation could be a no-op, logging helper, or a caller-supplied
    // function. Callers that need assertion semantics must configure or
    // resolve the actual guard implementation before using it as evidence.
    ts.forEachChild(candidate, visit)
  }
  visit(node)
  return result
}

function hasUnconditionalChildrenOnlyCall(node: ts.Node): boolean {
  let result = false
  const visit = (candidate: ts.Node) => {
    if (result) return
    if (ts.isFunctionLike(candidate) && candidate !== node) return
    if (ts.isIfStatement(candidate) || ts.isConditionalExpression(candidate) || ts.isSwitchStatement(candidate) || ts.isTryStatement(candidate) || ts.isForStatement(candidate) || ts.isForInStatement(candidate) || ts.isForOfStatement(candidate) || ts.isWhileStatement(candidate) || ts.isDoStatement(candidate)) return
    if (ts.isCallExpression(candidate) && isReactChildrenMember(candidate.expression, "only") && isChildrenArgument(candidate.arguments[0])) {
      result = true
      return
    }
    ts.forEachChild(candidate, visit)
  }
  visit(node)
  return result
}

/**
 * Derives a host's factual cardinality from enforcement semantics, not from a
 * count expression that merely observes or selects children. Without an
 * unconditional rejection path, source establishes no upper or lower bound.
 */
function sourceOwnedChildCardinality(node: ts.Node): ChildCardinality {
  if (hasUnconditionalChildrenOnlyCall(node)) return { min: 1, max: 1 }
  return exactCardinalityFromRejectingCountGuard(node) ?? unrestrictedChildCardinality
}

function hostImplementation(file: ts.SourceFile, sourcePath: string, expression: ts.Expression, conventions: DelegatedHostSourceAnalysisConventions): ts.Node | undefined {
  if (ts.isIdentifier(expression)) return sourceFunction(file, expression.text)
  const implementationPath = conventions.resolveReplacementHostSource?.(expression, sourcePath)
  return implementationPath ? sourceFile(implementationPath) : undefined
}

/**
 * Extracts delegated-host facts from source runtime semantics using
 * caller-provided primitive identity conventions. Cardinality is never
 * supplied by the caller: it is derived from the selected host's source.
 */
export function analyzeConfiguredDelegatedHostFacts(sourcePath: string, exportName: string, conventions: DelegatedHostSourceAnalysisConventions): DelegatedHostSourceAnalysis {
  const file = sourceFile(sourcePath)
  const declaration = sourceFunction(file, exportName)
  if (!declaration) return { facts: [], errors: [] }
  const restProps = sourceRestProps(declaration)
  const facts: SourceOwnedSlotFact[] = []
  const errors: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isConditionalExpression(node.initializer) && ts.isIdentifier(node.initializer.condition)) {
      const replacementExpression = conventions.matchesReplacementHost(node.initializer.whenTrue)
        ? node.initializer.whenTrue
        : conventions.matchesReplacementHost(node.initializer.whenFalse)
          ? node.initializer.whenFalse
          : undefined
      if (replacementExpression) {
        const cardinality = sourceOwnedChildCardinality(hostImplementation(file, sourcePath, replacementExpression, conventions) ?? replacementExpression)
        facts.push({
          propName: node.initializer.condition.text,
          replacesHost: replacementExpression === node.initializer.whenTrue,
          forwardsProps: forwardsPublicProps(declaration, node.name.text, restProps),
          childCardinality: cardinality,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  if (declaration.body) visit(declaration.body)
  return { facts, errors }
}
