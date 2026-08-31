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
] as const) for (const prefix of ["bg", "text", "border", "ring", "outline", "decoration"]) direct.set(`${prefix}-${utility}`, token)
for (const [utility, token] of [["rounded-sm", "radius.sm"], ["rounded-md", "radius.md"], ["rounded-lg", "radius.lg"], ["rounded-xl", "radius.xl"], ["font-heading", "font.heading"], ["font-sans", "font.sans"], ["text-xs", "font-size.xs"], ["text-sm", "font-size.sm"], ["text-base", "font-size.base"], ["text-lg", "font-size.lg"], ["font-medium", "font-weight.medium"], ["font-normal", "font-weight.normal"], ["font-semibold", "font-weight.semibold"]] as const) direct.set(utility, token)

const approvedTokenIds = new Set(tokenContract.tokens.map((token) => token.id))
const contractedNamespaces = new Set(tokenContract.coverage.contracted)
const tokenCategory = new Map(tokenContract.tokens.map((token) => [token.id, token.category]))

const spacingUtility = /^(?:size|h|w|min-h|min-w|max-h|max-w|p|px|py|pt|pr|pb|pl|gap|gap-x|gap-y|m|mx|my|mt|mr|mb|ml|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-([0-9]+(?:\.[0-9]+)?)$/

function cvaClassSources(file: ts.SourceFile, identifier: string) {
  let call: ts.CallExpression | undefined
  file.forEachChild((node) => { if (!ts.isVariableStatement(node)) return; for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier && declaration.initializer && ts.isCallExpression(declaration.initializer)) call = declaration.initializer })
  const output: Array<{ classNames: string; propName?: string; equals?: string }> = []
  if (!call) return output
  const base = call.arguments[0]
  if (base && ts.isStringLiteral(base)) output.push({ classNames: base.text })
  const config = call.arguments[1]
  if (!config || !ts.isObjectLiteralExpression(config)) return output
  const variants = config.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(file) === "variants")?.initializer
  if (!variants || !ts.isObjectLiteralExpression(variants)) return output
  for (const variant of variants.properties) {
    if (!ts.isPropertyAssignment(variant) || !ts.isObjectLiteralExpression(variant.initializer)) continue
    for (const value of variant.initializer.properties) if (ts.isPropertyAssignment(value) && ts.isStringLiteral(value.initializer)) output.push({ classNames: value.initializer.text, propName: variant.name.getText(file), equals: ts.isStringLiteral(value.name) ? value.name.text : value.name.getText(file) })
  }
  return output
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

type ClassSource = { classNames: string; propName?: string; equals?: string }

function componentClassSources(sourcePath: string): ClassSource[] {
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const output: ClassSource[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cn") for (const argument of node.arguments) if (ts.isStringLiteral(argument)) output.push({ classNames: argument.text })
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "cva") output.push(...cvaClassSources(source, node.name.text))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return output
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
  if (/^(?:bg|text|border|ring|outline|decoration)-/.test(utility)) return "color"
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

/**
 * Audits utilities actually present in a component source. The approved token
 * contract supplies the namespace vocabulary and emitted-token authority;
 * the small syntax table above only translates canonical theme utilities.
 */
export function auditComponentTokenCoverage(sourcePath: string): TokenCoverageFinding[] {
  const findings: TokenCoverageFinding[] = []
  for (const source of componentClassSources(sourcePath)) for (const rawUtility of source.classNames.split(/\s+/).filter(Boolean)) {
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
    if (notContractedUtilities.has(utility) || utility === "border-transparent" || utility === "bg-transparent") {
      const notContractedNamespace = utility === "border-transparent" || utility === "bg-transparent" ? "primitive-color" : "border-width"
      findings.push({ utility, classification: "known-not-contracted-namespace", namespace: notContractedNamespace })
    } else if (utility === "leading-none" || utility === "rounded-full") {
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
  for (const recipe of componentClassSources(sourcePath)) add(recipe.classNames, recipe.propName && recipe.equals ? { propName: recipe.propName, equals: recipe.equals } : undefined)
  return dependencies.filter((dependency, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(dependency)) === index)
}
