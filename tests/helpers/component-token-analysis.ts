import { readFileSync } from "node:fs"
import ts from "typescript"
import tokenContract from "../../contracts/tokens/token-contract.json"
import type { TokenDependency } from "../../src/contracts/components/types"

const direct = new Map<string, string>()
for (const [utility, token] of [
  ["background", "color.background"], ["foreground", "color.foreground"], ["card", "color.card"], ["card-foreground", "color.card-foreground"],
  ["popover", "color.popover"], ["popover-foreground", "color.popover-foreground"], ["primary", "color.primary"], ["primary-foreground", "color.primary-foreground"],
  ["secondary", "color.secondary"], ["secondary-foreground", "color.secondary-foreground"], ["muted", "color.muted"], ["muted-foreground", "color.muted-foreground"],
  ["accent", "color.accent"], ["accent-foreground", "color.accent-foreground"], ["destructive", "color.destructive"], ["border", "color.border"], ["input", "color.input"], ["ring", "color.ring"],
] as const) for (const prefix of ["bg", "text", "border", "ring", "outline", "decoration", "fill", "stroke"]) direct.set(`${prefix}-${utility}`, token)
for (const [utility, token] of [["rounded-sm", "radius.sm"], ["rounded-md", "radius.md"], ["rounded-lg", "radius.lg"], ["rounded-xl", "radius.xl"], ["shadow-sm", "shadow.sm"], ["shadow-md", "shadow.md"], ["font-heading", "font.heading"], ["font-sans", "font.sans"], ["text-xs", "font-size.xs"], ["text-sm", "font-size.sm"], ["text-base", "font-size.base"], ["text-lg", "font-size.lg"], ["font-medium", "font-weight.medium"], ["font-normal", "font-weight.normal"], ["font-semibold", "font-weight.semibold"]] as const) direct.set(utility, token)

const approvedTokenIds = new Set(tokenContract.tokens.map((token) => token.id))
const contractedNamespaces = new Set(tokenContract.coverage.contracted)
const tokenCategory = new Map(tokenContract.tokens.map((token) => [token.id, token.category]))

const spacingUtility = /^(?:size|h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-([0-9]+(?:\.[0-9]+)?)$/

export type ClassSource = { classNames: string; propName?: string; equals?: string }
export type UnresolvedClassSource = { sourcePath: string; start: number; end: number; expressionKind: string; sourceText: string; reason: string }
export type ComponentTokenSourceAnalysis = { resolved: ClassSource[]; unresolved: UnresolvedClassSource[] }

type Scope = { cva: Map<string, ts.CallExpression>; publicClassBindings: Set<string> }

function propertyName(property: ts.PropertyAssignment, file: ts.SourceFile) { return ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : property.name.getText(file) }
function isCallTo(expression: ts.Expression, name: string): expression is ts.CallExpression { return ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === name }
function nestedScope(scope: Scope): Scope { return { cva: new Map(scope.cva), publicClassBindings: new Set(scope.publicClassBindings) } }
function publicClassBindings(functionLike: Pick<ts.SignatureDeclarationBase, "parameters">) {
  const bindings = new Set<string>()
  const parameter = functionLike.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return bindings
  for (const element of parameter.name.elements) {
    const property = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined
    if (property === "className" && ts.isIdentifier(element.name)) bindings.add(element.name.text)
  }
  return bindings
}

function recordUnresolved(node: ts.Node, sourcePath: string, file: ts.SourceFile, output: ComponentTokenSourceAnalysis, reason: string) {
  output.unresolved.push({ sourcePath, start: node.getStart(file), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(file), reason })
}

function classSourcesFromExpression(expression: ts.Expression | undefined, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, context: Pick<ClassSource, "propName" | "equals"> = {}, resolving = new Set<ts.CallExpression>()) {
  if (!expression) return
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) { output.resolved.push({ classNames: expression.text, ...context }); return }
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) { classSourcesFromExpression(expression.expression, output, sourcePath, file, scope, context, resolving); return }
  if (ts.isConditionalExpression(expression)) { classSourcesFromExpression(expression.whenTrue, output, sourcePath, file, scope, context, resolving); classSourcesFromExpression(expression.whenFalse, output, sourcePath, file, scope, context, resolving); return }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { classSourcesFromExpression(expression.right, output, sourcePath, file, scope, context, resolving); return }
  if (isCallTo(expression, "cn")) { for (const argument of expression.arguments) classSourcesFromExpression(argument, output, sourcePath, file, scope, context, resolving); return }
  if (isCallTo(expression, "cva")) { cvaClassSources(expression, output, sourcePath, file, scope, resolving); return }
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && scope.cva.has(expression.expression.text)) { cvaClassSources(scope.cva.get(expression.expression.text)!, output, sourcePath, file, scope, resolving); return }
  if (ts.isIdentifier(expression) && scope.cva.has(expression.text)) { cvaClassSources(scope.cva.get(expression.text)!, output, sourcePath, file, scope, resolving); return }
  if (ts.isIdentifier(expression) && scope.publicClassBindings.has(expression.text)) return
  recordUnresolved(expression, sourcePath, file, output, ts.isTemplateExpression(expression) ? "Template interpolation prevents factual class resolution." : "Unsupported dynamic class expression.")
}

function cvaClassSources(call: ts.CallExpression, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, resolving = new Set<ts.CallExpression>()) {
  if (resolving.has(call)) return
  resolving.add(call)
  classSourcesFromExpression(call.arguments[0], output, sourcePath, file, scope, {}, resolving)
  const config = call.arguments[1]
  if (!config) { resolving.delete(call); return }
  if (!ts.isObjectLiteralExpression(config)) { recordUnresolved(config, sourcePath, file, output, "Unsupported dynamic CVA configuration."); resolving.delete(call); return }
  for (const property of config.properties) if (!ts.isPropertyAssignment(property)) recordUnresolved(property, sourcePath, file, output, "Unsupported CVA configuration property.")
  const assignment = (name: string) => config.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && propertyName(property, file) === name)?.initializer
  const variants = assignment("variants")
  if (variants && !ts.isObjectLiteralExpression(variants)) recordUnresolved(variants, sourcePath, file, output, "Unsupported dynamic CVA variants.")
  if (variants && ts.isObjectLiteralExpression(variants)) for (const variant of variants.properties) {
    if (!ts.isPropertyAssignment(variant)) { recordUnresolved(variant, sourcePath, file, output, "Unsupported CVA variant property."); continue }
    if (!ts.isObjectLiteralExpression(variant.initializer)) { recordUnresolved(variant.initializer, sourcePath, file, output, "Unsupported dynamic CVA variant values."); continue }
    for (const value of variant.initializer.properties) {
      if (!ts.isPropertyAssignment(value)) { recordUnresolved(value, sourcePath, file, output, "Unsupported CVA variant value property."); continue }
      classSourcesFromExpression(value.initializer, output, sourcePath, file, scope, { propName: propertyName(variant, file), equals: propertyName(value, file) }, resolving)
    }
  }
  const compoundVariants = assignment("compoundVariants")
  if (compoundVariants && !ts.isArrayLiteralExpression(compoundVariants)) recordUnresolved(compoundVariants, sourcePath, file, output, "Unsupported dynamic CVA compound variants.")
  if (compoundVariants && ts.isArrayLiteralExpression(compoundVariants)) for (const variant of compoundVariants.elements) {
    if (!ts.isObjectLiteralExpression(variant)) { if (ts.isExpression(variant)) recordUnresolved(variant, sourcePath, file, output, "Unsupported dynamic CVA compound variant."); continue }
    for (const property of variant.properties) {
      if (!ts.isPropertyAssignment(property)) { recordUnresolved(property, sourcePath, file, output, "Unsupported CVA compound variant property."); continue }
      if (["class", "className"].includes(propertyName(property, file))) classSourcesFromExpression(property.initializer, output, sourcePath, file, scope, {}, resolving)
    }
  }
  resolving.delete(call)
}

export function analyzeTailwindTokenDependencies(classNames: string, evidenceRefs: string[] = ["source"]): TokenDependency[] {
  const output: TokenDependency[] = []
  for (const utility of classNames.split(/\s+/).filter(Boolean)) {
    const normalized = utility.split(":").at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
    const tokenId = direct.get(normalized)
    if (tokenId && approvedTokenIds.has(tokenId)) output.push({ tokenId, evidenceRefs })
    else {
      const spacing = normalized.match(spacingUtility)
      if (spacing) output.push({ tokenId: "spacing.unit", viaDerivedRule: { id: "spacing.multiplier", multiplier: Number(spacing[1]) }, evidenceRefs })
    }
  }
  return output
}

export function analyzeComponentTokenSource(sourcePath: string): ComponentTokenSourceAnalysis {
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const output: ComponentTokenSourceAnalysis = { resolved: [], unresolved: [] }
  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isSourceFile(node) || ts.isBlock(node)) {
      const nested = nestedScope(scope)
      for (const statement of node.statements) visit(statement, nested)
      return
    }
    if (ts.isFunctionLike(node)) {
      const nested = nestedScope(scope)
      for (const binding of publicClassBindings(node)) nested.publicClassBindings.add(binding)
      if ("body" in node && node.body) visit(node.body, nested)
      return
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer && isCallTo(declaration.initializer, "cva")) {
        scope.cva.set(declaration.name.text, declaration.initializer)
      }
      ts.forEachChild(node, (child) => visit(child, scope))
      return
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) output.resolved.push({ classNames: node.initializer.text })
      else if (ts.isJsxExpression(node.initializer)) classSourcesFromExpression(node.initializer.expression, output, sourcePath, source, scope)
      return
    }
    if (isCallTo(node as ts.Expression, "cn")) { classSourcesFromExpression(node as ts.CallExpression, output, sourcePath, source, scope); return }
    ts.forEachChild(node, (child) => visit(child, scope))
  }
  visit(source, { cva: new Map(), publicClassBindings: new Set() })
  const unique = <T>(items: T[]) => items.filter((item, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index)
  return { resolved: unique(output.resolved), unresolved: unique(output.unresolved) }
}

export type TokenCoverageClassification =
  | "resolved-approved-token"
  | "known-non-token-implementation"
  | "known-not-contracted-namespace"
  | "recognized-no-approved-token"
  | "suspicious-contracted-namespace"

export type TokenCoverageFinding = {
  utility: string
  classification: TokenCoverageClassification
  tokenId?: string
  namespace?: string
}

const implementationUtilities = new Set([
  "align-middle", "animate-pulse", "bg-clip-padding", "flex", "flex-col", "flex-row", "grid", "group/card", "group/badge", "group/button",
  "inline-flex", "items-center", "justify-center", "justify-self-end", "overflow-auto", "overflow-hidden", "outline-none", "pointer-events-none",
  "relative", "select-none", "self-start", "shrink-0", "table", "transition-all", "transition-colors", "underline", "underline-offset-4",
  "whitespace-nowrap", "w-fit", "w-full", "h-full", "text-left", "text-center", "text-right", "text-justify", "text-start", "text-end",
  "border-transparent", "bg-transparent",
])
const notContractedUtilities = new Set(["border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-0", "border-2", "border-4", "border-8", "ring-3", "ring-0", "ring-2"])

function normalizedUtility(utility: string) {
  return utility.split(":").at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
}

function contractedNamespaceFor(utility: string): string | undefined {
  if (/^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(utility)) return "font-size"
  if (/^(?:bg|text|border|ring|outline|decoration|fill|stroke)-/.test(utility)) return "color"
  if (/^rounded-/.test(utility)) return "radius"
  if (/^font-/.test(utility)) {
    if (/^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(utility)) return "font-weight"
    return "font-family"
  }
  if (/^leading-/.test(utility)) return "line-height"
  if (/^tracking-/.test(utility)) return "letter-spacing"
  if (/^shadow-/.test(utility)) return "shadow"
  if (spacingUtility.test(utility)) return "spacing"
  return undefined
}

function isArbitraryValueUtility(utility: string) { return /-\[[^\]]+\]$/.test(utility) }
function hasCssKeywordValue(utility: string) { return /-(?:inherit|initial|unset|revert|revert-layer)$/.test(utility) }
function usesCurrentColor(utility: string, namespace: string | undefined) { return namespace === "color" && /-current$/.test(utility) }
function isRecognizedNoApprovedToken(utility: string, namespace: string | undefined) {
  return isArbitraryValueUtility(utility) || hasCssKeywordValue(utility) || usesCurrentColor(utility, namespace) || utility === "leading-none" || utility === "rounded-full"
}

/**
 * Audits utilities actually present in a component source. The approved token
 * contract supplies the namespace vocabulary and emitted-token authority;
 * the small syntax table above only translates canonical theme utilities.
 */
export function auditComponentTokenCoverage(sourcePath: string): TokenCoverageFinding[] {
  const findings: TokenCoverageFinding[] = []
  for (const source of analyzeComponentTokenSource(sourcePath).resolved) for (const rawUtility of source.classNames.split(/\s+/).filter(Boolean)) {
    const utility = normalizedUtility(rawUtility)
    const tokenId = direct.get(utility)
    if (tokenId && approvedTokenIds.has(tokenId)) {
      findings.push({ utility, classification: "resolved-approved-token", tokenId, namespace: tokenCategory.get(tokenId) })
      continue
    }
    if (spacingUtility.test(utility) && approvedTokenIds.has("spacing.unit")) {
      findings.push({ utility, classification: "resolved-approved-token", tokenId: "spacing.unit", namespace: "spacing" })
      continue
    }
    const namespace = contractedNamespaceFor(utility)
    if (notContractedUtilities.has(utility) || /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility)) {
      const notContractedNamespace = /^(?:border|bg)(?:-[a-z]+)?-transparent$/.test(utility) ? "primitive-color" : "border-width"
      findings.push({ utility, classification: "known-not-contracted-namespace", namespace: notContractedNamespace })
    } else if (isRecognizedNoApprovedToken(utility, namespace)) {
      findings.push({ utility, classification: "recognized-no-approved-token", namespace })
    } else if (implementationUtilities.has(utility) || utility.startsWith("data-") || utility.startsWith("has-") || utility.startsWith("in-data-")) {
      findings.push({ utility, classification: "known-non-token-implementation" })
    } else if (namespace && contractedNamespaces.has(namespace)) {
      findings.push({ utility, classification: "suspicious-contracted-namespace", namespace })
    } else {
      findings.push({ utility, classification: "known-non-token-implementation" })
    }
  }
  return findings.filter((finding, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(finding)) === index)
}

export function analyzeComponentTokenDependencies(sourcePath: string): TokenDependency[] {
  const dependencies: TokenDependency[] = []
  const add = (classNames: string, when?: { propName: string; equals: string }) => dependencies.push(...analyzeTailwindTokenDependencies(classNames).map((dependency) => when ? { ...dependency, when } : dependency))
  for (const recipe of analyzeComponentTokenSource(sourcePath).resolved) add(recipe.classNames, recipe.propName && recipe.equals ? { propName: recipe.propName, equals: recipe.equals } : undefined)
  return dependencies.filter((dependency, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(dependency)) === index)
}

/** Compares a contract's normalized dependency set to the class-bearing utilities found in source. */
export function compareComponentTokenDependencies(sourcePath: string, dependencies: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>): string[] {
  const key = ({ tokenId, when, viaDerivedRule }: Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">) => JSON.stringify({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })
  const analysis = analyzeComponentTokenSource(sourcePath)
  const expected = new Set(analyzeTailwindTokenDependencies("").map(key))
  for (const source of analysis.resolved) for (const dependency of analyzeTailwindTokenDependencies(source.classNames)) expected.add(key(source.propName && source.equals ? { ...dependency, when: { propName: source.propName, equals: source.equals } } : dependency))
  const actual = new Set(dependencies.map(key))
  return [
    ...analysis.unresolved.map((item) => `Unresolved class evidence at ${sourcePath}:${item.start}: ${item.reason} (${item.sourceText})`),
    ...[...expected].filter((item) => !actual.has(item)).map((item) => `Missing source token dependency: ${item}`),
    ...[...actual].filter((item) => !expected.has(item)).map((item) => `Invented token dependency: ${item}`),
  ]
}
