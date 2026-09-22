import { readFileSync } from "node:fs"
import ts from "typescript"

import type { SourceExpressionIdentity, TokenCondition, TokenConditionAtom, TokenConditionPath, TokenConditionRelationshipSegment, TokenDependency } from "./types"

export type ClassSource = { classNames: string; propName?: string; equals?: string; source: SourceExpressionIdentity }
export type UnresolvedClassSource = SourceExpressionIdentity & { reason: string }
export type TokenUtilityResolution = Pick<TokenDependency, "tokenId" | "viaDerivedRule">
export type TokenExpressionSource = TokenUtilityResolution & { when?: TokenCondition; source: SourceExpressionIdentity }
export type ComponentTokenSourceAnalysis = { resolved: ClassSource[]; tokenExpressions: TokenExpressionSource[]; unresolved: UnresolvedClassSource[] }
export type TokenCoverageFinding = { utility: string; classification: string; tokenId?: string; namespace?: string }
export type ImportedRecipeRequest = Readonly<{ sourcePath: string; moduleSpecifier: string; importedName: string }>
export type ImportedRecipeResolution = Readonly<{ sourcePath: string; exportName: string }>
export type RecipeUnresolvedReason = "dynamicConfiguration" | "configurationProperty" | "dynamicVariants" | "variantProperty" | "dynamicVariantValues" | "variantValueProperty" | "dynamicDefaultVariants" | "defaultVariantProperty" | "defaultVariantValue" | "dynamicCompoundVariants" | "compoundVariant" | "compoundVariantProperty" | "dynamicInvocation" | "invocationProperty" | "unknownVariant" | "unknownVariantValue" | "importAuthority" | "importedExport"
export type TokenSourceAnalyzerConfig = Readonly<{
  resolveUtility: (utility: string) => TokenUtilityResolution | undefined
  classMergeFunctionNames?: readonly string[]
  recipeFunctionNames?: readonly string[]
  recipeVariantsProperty?: string
  recipeCompoundVariantsProperty?: string
  recipeClassPropertyNames?: readonly string[]
  recipeUnresolvedReasons?: Partial<Record<RecipeUnresolvedReason, string>>
  resolveImportedRecipe?: (request: ImportedRecipeRequest) => ImportedRecipeResolution | undefined
  resolveCssVariable?: (cssVariable: string, multiplier: number) => TokenUtilityResolution | undefined
  readSource?: (sourcePath: string) => string
}>

type RecipeDefinition = { call: ts.CallExpression; sourcePath: string; sourceFile: ts.SourceFile }
type ImportedBinding = { importedName: string; moduleSpecifier: string }
type ValueBinding = { declaration: ts.VariableDeclaration; initializer?: ts.Expression; immutable: boolean; written: boolean }
type Scope = { recipes: Map<string, RecipeDefinition>; importedBindings: Map<string, ImportedBinding>; namespaceBindings: Map<string, string>; values: Map<string, ValueBinding>; publicPropBindings: Set<string>; publicClassBindings: Set<string> }
type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction

function unique<T>(items: T[]) { return items.filter((item, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index) }
function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}
function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return undefined
}
function literalValue(expression: ts.Expression): string | number | boolean | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}
function nestedScope(scope: Scope): Scope { return { recipes: new Map(scope.recipes), importedBindings: new Map(scope.importedBindings), namespaceBindings: new Map(scope.namespaceBindings), values: new Map(scope.values), publicPropBindings: new Set(scope.publicPropBindings), publicClassBindings: new Set(scope.publicClassBindings) } }
function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : bindingNames(element.name))
}
function publicPropBindings(functionLike: Pick<ts.SignatureDeclarationBase, "parameters">) {
  return new Set(functionLike.parameters[0] ? bindingNames(functionLike.parameters[0].name) : [])
}

type StaticCssText = { text: string } | { reason: "dynamic" | "ambiguous" }

function staticCssPrimitive(expression: ts.Expression, scope: Scope, visited = new Set<string>()): string | number | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) || ts.isNumericLiteral(expression)) return expression.text
  if (ts.isPrefixUnaryExpression(expression) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(expression.operator)) {
    const operand = staticCssPrimitive(expression.operand, scope, visited)
    if (typeof operand !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(operand)) return undefined
    return `${expression.operator === ts.SyntaxKind.MinusToken ? "-" : "+"}${operand}`
  }
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return staticCssPrimitive(expression.expression, scope, visited)
  if (!ts.isIdentifier(expression) || scope.publicPropBindings.has(expression.text) || visited.has(expression.text)) return undefined
  const binding = scope.values.get(expression.text)
  if (!binding?.initializer || !binding.immutable || binding.written) return undefined
  visited.add(expression.text)
  return staticCssPrimitive(binding.initializer, scope, visited)
}

function staticCssText(expression: ts.Expression, scope: Scope): StaticCssText {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return { text: expression.text }
  if (!ts.isTemplateExpression(expression)) return { reason: "dynamic" }
  let text = expression.head.text
  for (const span of expression.templateSpans) {
    const value = staticCssPrimitive(span.expression, scope)
    if (value === undefined) return { reason: "dynamic" }
    const before = text.at(-1)
    const after = span.literal.text[0]
    if ((before && /[A-Za-z0-9_.-]/.test(before)) || (after && /[A-Za-z0-9_.-]/.test(after))) return { reason: "ambiguous" }
    text += String(value) + span.literal.text
  }
  return { text }
}

function arbitraryUtilityExpression(utility: string): string | undefined {
  const match = /^[A-Za-z][A-Za-z0-9-]*-\[(.*)\]$/.exec(utility)
  return match?.[1]
}

const operationalVariant = /^(?:\*|\*\*|dark|rtl|ltr|portrait|landscape|print|motion-safe|motion-reduce|contrast-more|contrast-less|forced-colors|sm|md|lg|xl|2xl|first|last|only|odd|even|first-of-type|last-of-type|only-of-type|empty|hover|focus|focus-within|focus-visible|active|visited|target|disabled|enabled|checked|indeterminate|default|required|valid|invalid|in-range|out-of-range|placeholder|placeholder-shown|autofill|read-only|open|before|after|first-letter|first-line|marker|selection|file|backdrop|(?:group|peer)-(?:hover|focus|focus-within|focus-visible|active|visited|disabled|enabled|checked|open)(?:\/[A-Za-z0-9_-]+)?|@[a-z][A-Za-z0-9_-]*(?:\/[A-Za-z0-9_-]+)?)$/

function conditionValue(value: string | undefined): string | number | boolean | undefined {
  if (value === undefined) return true
  if (!value) return undefined
  let decoded = ""
  let escaped = false
  for (const character of value) {
    if (escaped) { decoded += character; escaped = false; continue }
    if (character === "\\") { escaped = true; continue }
    if (character === "_" || character === ":") return undefined
    decoded += character
  }
  if (escaped || /[\s{}$`'"]/.test(decoded)) return undefined
  if (decoded === "true") return true
  if (decoded === "false") return false
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decoded)) return Number(decoded)
  return decoded
}

function attributeCondition(prefix: string): TokenConditionAtom | undefined {
  const root = /^(?:((?:(?:group|peer|in|has)-)+))?(data|aria)-(.+)$/.exec(prefix)
  if (!root) return undefined
  const suffix = root[3]
  let propName: string
  let rawValue: string | undefined
  let name: string | undefined

  if (suffix.startsWith("[")) {
    let closing = -1
    let escaped = false
    for (let index = 1; index < suffix.length; index += 1) {
      const character = suffix[index]
      if (escaped) { escaped = false; continue }
      if (character === "\\") { escaped = true; continue }
      if (character === "[") return undefined
      if (character === "]") { closing = index; break }
    }
    if (escaped || closing < 0) return undefined
    const tail = suffix.slice(closing + 1)
    if (tail) {
      const nameMatch = /^\/([A-Za-z0-9_-]+)$/.exec(tail)
      if (!nameMatch) return undefined
      name = nameMatch[1]
    }
    const content = suffix.slice(1, closing)
    let separator = -1
    escaped = false
    for (let index = 0; index < content.length; index += 1) {
      const character = content[index]
      if (escaped) { escaped = false; continue }
      if (character === "\\") { escaped = true; continue }
      if (character === "=" && separator < 0) separator = index
    }
    if (escaped) return undefined
    propName = separator < 0 ? content : content.slice(0, separator)
    rawValue = separator < 0 ? undefined : content.slice(separator + 1)
  } else {
    const shorthand = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\/([A-Za-z0-9_-]+))?$/.exec(suffix)
    if (!shorthand) return undefined
    propName = shorthand[1]
    name = shorthand[2]
  }
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(propName)) return undefined

  let path: TokenConditionPath
  if (!root[1]) {
    if (name) return undefined
    path = [{ kind: "self" }]
  } else {
    const relationKinds = root[1].slice(0, -1).split("-") as Array<TokenConditionRelationshipSegment["kind"]>
    const segments = relationKinds.map((kind): TokenConditionRelationshipSegment => ({ kind }))
    if (name) {
      const namedIndex = segments.findIndex(({ kind }) => kind === "group" || kind === "peer")
      if (namedIndex < 0) return undefined
      segments[namedIndex] = { kind: segments[namedIndex].kind as "group" | "peer", name }
    }
    path = [segments[0], ...segments.slice(1)]
  }
  const equals = conditionValue(rawValue)
  if (equals === undefined) return undefined
  return { subject: root[2] as "data" | "aria", path, propName, equals }
}

function conditionSubjectKey({ equals: _equals, ...identity }: TokenConditionAtom): string {
  return stableSerialize(identity)
}

function conditionAtoms(condition: TokenCondition | undefined): TokenConditionAtom[] {
  if (!condition) return []
  return condition.all ?? [condition as TokenConditionAtom]
}

function combineConditions(...conditions: Array<TokenCondition | undefined>): TokenCondition | undefined | false {
  const atoms: TokenConditionAtom[] = []
  for (const atom of conditions.flatMap(conditionAtoms)) {
    const identity = conditionSubjectKey(atom)
    const existing = atoms.find((candidate) => conditionSubjectKey(candidate) === identity)
    if (existing && existing.equals !== atom.equals) return false
    if (!existing) atoms.push(atom)
  }
  if (atoms.length === 0) return undefined
  return atoms.length === 1 ? atoms[0] : { all: [atoms[0], atoms[1], ...atoms.slice(2)] }
}

function variantSegments(rawUtility: string): string[] | undefined {
  const segments: string[] = []
  let start = 0
  let squareDepth = 0
  let parenthesisDepth = 0
  let escaped = false
  for (let index = 0; index < rawUtility.length; index += 1) {
    const character = rawUtility[index]
    if (escaped) { escaped = false; continue }
    if (character === "\\") { escaped = true; continue }
    if (character === "[") squareDepth += 1
    else if (character === "]") { squareDepth -= 1; if (squareDepth < 0) return undefined }
    else if (character === "(") parenthesisDepth += 1
    else if (character === ")") { parenthesisDepth -= 1; if (parenthesisDepth < 0) return undefined }
    else if (character === ":" && squareDepth === 0 && parenthesisDepth === 0) { segments.push(rawUtility.slice(start, index)); start = index + 1 }
  }
  if (escaped || squareDepth !== 0 || parenthesisDepth !== 0) return undefined
  segments.push(rawUtility.slice(start))
  return segments.every(Boolean) ? segments : undefined
}

export function parseTailwindTokenUtility(rawUtility: string): { utility: string; when?: TokenCondition } | undefined {
  const segments = variantSegments(rawUtility)
  if (!segments) return undefined
  const utility = segments.at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
  const conditions: TokenCondition[] = []
  for (const prefix of segments.slice(0, -1)) {
    const condition = attributeCondition(prefix)
    if (condition) {
      conditions.push(condition)
      continue
    }
    if (prefix.includes("data-") || prefix.includes("aria-") || prefix.includes("${") || prefix.startsWith("[") || !operationalVariant.test(prefix)) return undefined
  }
  const when = combineConditions(...conditions)
  return when === false ? undefined : { utility, ...(when ? { when } : {}) }
}

/** Builds a source analyzer from caller-owned syntax and utility-token rules. */
export function createTokenSourceAnalyzer(config: TokenSourceAnalyzerConfig) {
  const classMergeNames = new Set(config.classMergeFunctionNames ?? [])
  const recipeNames = new Set(config.recipeFunctionNames ?? [])
  const variantsProperty = config.recipeVariantsProperty ?? "variants"
  const compoundVariantsProperty = config.recipeCompoundVariantsProperty ?? "compoundVariants"
  const classPropertyNames = new Set(config.recipeClassPropertyNames ?? ["class", "className"])
  const recipeUnresolvedReasons: Record<RecipeUnresolvedReason, string> = {
    dynamicConfiguration: "Unsupported dynamic recipe configuration.",
    configurationProperty: "Unsupported recipe configuration property.",
    dynamicVariants: "Unsupported dynamic recipe variants.",
    variantProperty: "Unsupported recipe variant property.",
    dynamicVariantValues: "Unsupported dynamic recipe variant values.",
    variantValueProperty: "Unsupported recipe variant value property.",
    dynamicDefaultVariants: "Unsupported dynamic recipe defaults.",
    defaultVariantProperty: "Unsupported recipe default property.",
    defaultVariantValue: "Unsupported dynamic recipe default value.",
    dynamicCompoundVariants: "Unsupported dynamic recipe compound variants.",
    compoundVariant: "Unsupported dynamic recipe compound variant.",
    compoundVariantProperty: "Unsupported recipe compound variant property.",
    dynamicInvocation: "Unsupported dynamic recipe invocation.",
    invocationProperty: "Unsupported recipe invocation property.",
    unknownVariant: "Recipe invocation references an unknown variant.",
    unknownVariantValue: "Recipe invocation references an unknown variant value.",
    importAuthority: "Imported recipe source is not approved.",
    importedExport: "Imported recipe export is not a static CVA recipe.",
    ...config.recipeUnresolvedReasons,
  }
  const readSource = config.readSource ?? ((sourcePath: string) => readFileSync(sourcePath, "utf8"))
  const valueBindings = new WeakMap<ts.VariableDeclaration, ValueBinding>()
  const valueBinding = (declaration: ts.VariableDeclaration): ValueBinding => {
    const existing = valueBindings.get(declaration)
    if (existing) return existing
    const list = declaration.parent
    const binding = {
      declaration,
      initializer: declaration.initializer,
      immutable: ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0,
      written: false,
    }
    valueBindings.set(declaration, binding)
    return binding
  }
  const sourceFile = (sourcePath: string) => ts.createSourceFile(sourcePath, readSource(sourcePath), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const isNamedCall = (expression: ts.Expression, names: ReadonlySet<string>): expression is ts.CallExpression => ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && names.has(expression.expression.text)
  const sourceIdentity = (node: ts.Node, sourcePath: string, file: ts.SourceFile): SourceExpressionIdentity => ({ sourcePath, start: node.getStart(file), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(file) })
  const recordUnresolved = (node: ts.Node, sourcePath: string, file: ts.SourceFile, output: ComponentTokenSourceAnalysis, reason: string) => output.unresolved.push({ ...sourceIdentity(node, sourcePath, file), reason })
  const recordIdentityUnresolved = (source: SourceExpressionIdentity, output: ComponentTokenSourceAnalysis, reason: string) => output.unresolved.push({ ...source, reason })

  const resolveCssArithmeticText = (text: string): TokenUtilityResolution | string | undefined => {
    if (!config.resolveCssVariable || !text.includes("calc(") || !text.includes("var(")) return undefined
    const variables = [...text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)]
    if (variables.length !== 1) return variables.length > 1
      ? "CSS token arithmetic must reference exactly one variable."
      : "CSS token arithmetic expression shape is not equivalent."
    const variable = variables[0][1]
    const exact = /^calc\(\s*var\(\s*(--[A-Za-z0-9_-]+)\s*\)\s*\*\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/.exec(text)
    if (exact) {
      const parsedMultiplier = Number(exact[2])
      if (!Number.isFinite(parsedMultiplier)) return "CSS token arithmetic operand is not a finite decimal."
      const multiplier = Object.is(parsedMultiplier, -0) ? 0 : parsedMultiplier
      const resolution = config.resolveCssVariable(exact[1], multiplier)
      return resolution ?? "CSS token arithmetic references an unapproved variable."
    }
    if (new RegExp(`^calc\\(\\s*var\\(\\s*${variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\)\\s*\\/\\s*[+-]?(?:0+(?:\\.0*)?|\\.0+)\\s*\\)$`).test(text)) return "CSS token arithmetic divides by zero."
    if (!config.resolveCssVariable(variable, 1)) return "CSS token arithmetic references an unapproved variable."
    if (/^calc\(\s*var\(\s*--[A-Za-z0-9_-]+\s*\)\s*\*\s*(?:[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+|Infinity)|NaN)\s*\)$/.test(text)) return "CSS token arithmetic operand is not a finite decimal."
    if (/^calc\(\s*var\(\s*--[A-Za-z0-9_-]+\s*\)\s*\*\s*[^)]+\)$/.test(text)) return "CSS token arithmetic operand is not numeric."
    if (/^calc\(.*\)\s*(?:\+|-|\/)\s*.*\)$/.test(text)) return "Unsupported CSS token arithmetic operator."
    return "CSS token arithmetic expression shape is not equivalent."
  }

  const resolveCssArithmeticExpression = (expression: ts.Expression, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, when?: TokenCondition): void => {
    if (!config.resolveCssVariable || !expression.getText(file).includes("calc(") || !expression.getText(file).includes("var(")) return
    const source = sourceIdentity(expression, sourcePath, file)
    const staticText = staticCssText(expression, scope)
    if ("reason" in staticText) {
      recordIdentityUnresolved(source, output, staticText.reason === "ambiguous" ? "Ambiguous CSS token arithmetic interpolation." : "Dynamic CSS token arithmetic operand.")
      return
    }
    const resolution = resolveCssArithmeticText(staticText.text)
    if (!resolution) return
    if (typeof resolution === "string") { recordIdentityUnresolved(source, output, resolution); return }
    output.tokenExpressions.push({ ...resolution, ...(when ? { when } : {}), source })
  }

  const exportedLocalRecipeName = (source: ts.SourceFile, exportName: string): string | undefined => {
    const candidates: string[] = []
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) candidates.push(exportName)
      }
      if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier) continue
      for (const element of statement.exportClause.elements) if (element.name.text === exportName) candidates.push(element.propertyName?.text ?? element.name.text)
    }
    return candidates.length === 1 ? candidates[0] : undefined
  }

  const importedRecipe = (localName: string, invocation: ts.CallExpression, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope): RecipeDefinition | undefined => {
    const binding = scope.importedBindings.get(localName)
    if (!binding) return undefined
    const resolution = config.resolveImportedRecipe?.({ sourcePath, ...binding })
    if (!resolution || resolution.exportName !== binding.importedName) {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importAuthority)
      return undefined
    }
    let importedFile: ts.SourceFile
    try { importedFile = sourceFile(resolution.sourcePath) }
    catch {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importAuthority)
      return undefined
    }
    const declarationName = exportedLocalRecipeName(importedFile, resolution.exportName)
    const declarations = importedFile.statements.flatMap((statement) => ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.filter((declaration): declaration is ts.VariableDeclaration & { name: ts.Identifier; initializer: ts.CallExpression } => ts.isIdentifier(declaration.name) && declaration.name.text === declarationName && !!declaration.initializer && isNamedCall(declaration.initializer, recipeNames))
      : [])
    if (declarations.length !== 1) {
      recordUnresolved(invocation, sourcePath, file, output, recipeUnresolvedReasons.importedExport)
      return undefined
    }
    return { call: declarations[0].initializer, sourcePath: resolution.sourcePath, sourceFile: importedFile }
  }

  const isRecognizedContextCall = (expression: ts.Expression, scope: Scope): boolean => {
    if (!ts.isCallExpression(expression) || expression.arguments.length !== 1) return false
    if (ts.isPropertyAccessExpression(expression.expression)) {
      return ts.isIdentifier(expression.expression.expression)
        && expression.expression.name.text === "useContext"
        && scope.namespaceBindings.get(expression.expression.expression.text) === "react"
    }
    if (!ts.isIdentifier(expression.expression)) return false
    const binding = scope.importedBindings.get(expression.expression.text)
    return binding?.moduleSpecifier === "react" && binding.importedName === "useContext"
  }

  const isSafeSelectorExpression = (expression: ts.Expression, scope: Scope, visited = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) return isSafeSelectorExpression(expression.expression, scope, visited)
    if (ts.isPropertyAccessExpression(expression)) return isSafeSelectorExpression(expression.expression, scope, new Set(visited))
    if (ts.isElementAccessExpression(expression)) {
      return !!expression.argumentExpression
        && (ts.isStringLiteral(expression.argumentExpression) || ts.isNumericLiteral(expression.argumentExpression))
        && isSafeSelectorExpression(expression.expression, scope, new Set(visited))
    }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return isSafeSelectorExpression(expression.left, scope, new Set(visited)) && isSafeSelectorExpression(expression.right, scope, new Set(visited))
    if (isRecognizedContextCall(expression, scope)) return true
    if (!ts.isIdentifier(expression)) return false
    if (scope.publicPropBindings.has(expression.text)) return true
    if (visited.has(expression.text)) return false
    const binding = scope.values.get(expression.text)
    if (!binding?.initializer) return false
    visited.add(expression.text)
    return isSafeSelectorExpression(binding.initializer, scope, visited)
  }

  const classSourcesFromExpression = (expression: ts.Expression | undefined, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, context: Pick<ClassSource, "propName" | "equals"> = {}, resolving = new Set<ts.CallExpression>()): void => {
    if (!expression) return
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) { output.resolved.push({ classNames: expression.text, ...context, source: sourceIdentity(expression, sourcePath, file) }); return }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) { classSourcesFromExpression(expression.expression, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isConditionalExpression(expression)) { classSourcesFromExpression(expression.whenTrue, output, sourcePath, file, scope, context, resolving); classSourcesFromExpression(expression.whenFalse, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { classSourcesFromExpression(expression.right, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, classMergeNames)) { for (const argument of expression.arguments) classSourcesFromExpression(argument, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, recipeNames)) { recipeClassSources({ call: expression, sourcePath, sourceFile: file }, output, scope, undefined, resolving); return }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      const definition = scope.recipes.get(expression.expression.text) ?? importedRecipe(expression.expression.text, expression, output, sourcePath, file, scope)
      if (definition) recipeClassSources(definition, output, scope, expression, resolving)
      else if (!scope.importedBindings.has(expression.expression.text)) recordUnresolved(expression, sourcePath, file, output, "Unsupported dynamic class expression.")
      return
    }
    if (ts.isIdentifier(expression) && scope.recipes.has(expression.text)) { recipeClassSources(scope.recipes.get(expression.text)!, output, scope, undefined, resolving); return }
    if (ts.isIdentifier(expression) && scope.publicClassBindings.has(expression.text)) return
    recordUnresolved(expression, sourcePath, file, output, ts.isTemplateExpression(expression) ? "Template interpolation prevents factual class resolution." : "Unsupported dynamic class expression.")
  }

  const recipeClassSources = (definitionRecord: RecipeDefinition, output: ComponentTokenSourceAnalysis, scope: Scope, invocation?: ts.CallExpression, resolving = new Set<ts.CallExpression>()): void => {
    const { call, sourcePath, sourceFile: file } = definitionRecord
    if (resolving.has(call)) return
    const buffered: ComponentTokenSourceAnalysis = { resolved: [], tokenExpressions: [], unresolved: [] }
    const finish = () => {
      resolving.delete(call)
      output.unresolved.push(...buffered.unresolved)
      if (buffered.unresolved.length === 0) {
        output.resolved.push(...buffered.resolved)
        output.tokenExpressions.push(...buffered.tokenExpressions)
      }
    }
    resolving.add(call); classSourcesFromExpression(call.arguments[0], buffered, sourcePath, file, scope, {}, resolving)
    const definition = call.arguments[1]
    if (!definition) { finish(); return }
    if (!ts.isObjectLiteralExpression(definition)) { recordUnresolved(definition, sourcePath, file, buffered, recipeUnresolvedReasons.dynamicConfiguration); finish(); return }
    for (const property of definition.properties) if (!ts.isPropertyAssignment(property)) recordUnresolved(property, sourcePath, file, buffered, recipeUnresolvedReasons.configurationProperty)
    for (const property of definition.properties) if (ts.isPropertyAssignment(property) && !staticPropertyName(property.name)) recordUnresolved(property, sourcePath, file, buffered, recipeUnresolvedReasons.configurationProperty)
    const assignment = (name: string) => definition.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && staticPropertyName(property.name) === name)?.initializer
    const variants = assignment(variantsProperty)
    if (variants && !ts.isObjectLiteralExpression(variants)) recordUnresolved(variants, sourcePath, file, buffered, recipeUnresolvedReasons.dynamicVariants)
    const variantNames = new Set<string>()
    const variantValues = new Map<string, Set<string>>()
    const defaults = new Map<string, string | number | boolean>()
    const defaultVariants = assignment("defaultVariants")
    if (defaultVariants && !ts.isObjectLiteralExpression(defaultVariants)) recordUnresolved(defaultVariants, sourcePath, file, buffered, recipeUnresolvedReasons.dynamicDefaultVariants)
    if (defaultVariants && ts.isObjectLiteralExpression(defaultVariants)) for (const property of defaultVariants.properties) {
      if (!ts.isPropertyAssignment(property) || !staticPropertyName(property.name)) { recordUnresolved(property, sourcePath, file, buffered, recipeUnresolvedReasons.defaultVariantProperty); continue }
      const value = literalValue(property.initializer)
      if (value === undefined) { recordUnresolved(property.initializer, sourcePath, file, buffered, recipeUnresolvedReasons.defaultVariantValue); continue }
      defaults.set(staticPropertyName(property.name)!, value)
    }
    type Selection = { kind: "dynamic" } | { kind: "literal"; value: string | number | boolean }
    const selections = new Map<string, Selection>()
    let invocationValid = true
    if (invocation) {
      if (invocation.arguments.length > 1 || (invocation.arguments[0] && !ts.isObjectLiteralExpression(invocation.arguments[0]))) {
        recordUnresolved(invocation.arguments[0] ?? invocation, invocation.getSourceFile().fileName, invocation.getSourceFile(), buffered, recipeUnresolvedReasons.dynamicInvocation)
        invocationValid = false
      } else if (invocation.arguments[0] && ts.isObjectLiteralExpression(invocation.arguments[0])) {
        for (const property of invocation.arguments[0].properties) {
          if ((!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) || !staticPropertyName(property.name)) {
            recordUnresolved(property, invocation.getSourceFile().fileName, invocation.getSourceFile(), buffered, recipeUnresolvedReasons.invocationProperty)
            invocationValid = false
            continue
          }
          const name = staticPropertyName(property.name)!
          if (classPropertyNames.has(name)) continue
          const initializer = ts.isPropertyAssignment(property) ? property.initializer : property.name
          const value = literalValue(initializer)
          if (value === undefined && !isSafeSelectorExpression(initializer, scope)) {
            recordUnresolved(initializer, invocation.getSourceFile().fileName, invocation.getSourceFile(), buffered, recipeUnresolvedReasons.dynamicInvocation)
            invocationValid = false
          } else selections.set(name, value === undefined ? { kind: "dynamic" } : { kind: "literal", value })
        }
      }
    }
    if (variants && ts.isObjectLiteralExpression(variants)) for (const variant of variants.properties) {
      const variantName = ts.isPropertyAssignment(variant) ? staticPropertyName(variant.name) : undefined
      if (!ts.isPropertyAssignment(variant) || !variantName) { recordUnresolved(variant, sourcePath, file, buffered, recipeUnresolvedReasons.variantProperty); continue }
      variantNames.add(variantName)
      variantValues.set(variantName, new Set())
      if (!ts.isObjectLiteralExpression(variant.initializer)) { recordUnresolved(variant.initializer, sourcePath, file, buffered, recipeUnresolvedReasons.dynamicVariantValues); continue }
      for (const value of variant.initializer.properties) {
        const valueName = ts.isPropertyAssignment(value) ? staticPropertyName(value.name) : undefined
        if (!ts.isPropertyAssignment(value) || !valueName) { recordUnresolved(value, sourcePath, file, buffered, recipeUnresolvedReasons.variantValueProperty); continue }
        variantValues.get(variantName)!.add(valueName)
        if (!invocation) classSourcesFromExpression(value.initializer, buffered, sourcePath, file, scope, { propName: variantName, equals: valueName }, resolving)
        else if (invocationValid) {
          const selected = selections.get(variantName)
          if (selected?.kind === "dynamic") classSourcesFromExpression(value.initializer, buffered, sourcePath, file, scope, { propName: variantName, equals: valueName }, resolving)
          else {
            const selectedValue = selected?.value ?? defaults.get(variantName)
            if (String(selectedValue) === valueName) classSourcesFromExpression(value.initializer, buffered, sourcePath, file, scope, {}, resolving)
          }
        }
      }
    }
    if (invocation && invocationValid) for (const [name] of selections) if (!variantNames.has(name)) {
      recordUnresolved(invocation.arguments[0]!, invocation.getSourceFile().fileName, invocation.getSourceFile(), buffered, recipeUnresolvedReasons.unknownVariant)
      invocationValid = false
    }
    if (invocation && invocationValid) for (const [name, selection] of selections) {
      if (selection.kind === "literal" && !variantValues.get(name)?.has(String(selection.value))) {
        recordUnresolved(invocation.arguments[0]!, invocation.getSourceFile().fileName, invocation.getSourceFile(), buffered, recipeUnresolvedReasons.unknownVariantValue)
        invocationValid = false
      }
    }
    for (const [name, value] of defaults) {
      if (!variantNames.has(name)) recordUnresolved(defaultVariants!, sourcePath, file, buffered, recipeUnresolvedReasons.unknownVariant)
      else if (!variantValues.get(name)?.has(String(value))) recordUnresolved(defaultVariants!, sourcePath, file, buffered, recipeUnresolvedReasons.unknownVariantValue)
    }
    const compoundVariants = assignment(compoundVariantsProperty)
    if (compoundVariants && !ts.isArrayLiteralExpression(compoundVariants)) recordUnresolved(compoundVariants, sourcePath, file, buffered, recipeUnresolvedReasons.dynamicCompoundVariants)
    if (compoundVariants && ts.isArrayLiteralExpression(compoundVariants)) for (const variant of compoundVariants.elements) {
      if (!ts.isObjectLiteralExpression(variant)) { if (ts.isExpression(variant)) recordUnresolved(variant, sourcePath, file, buffered, recipeUnresolvedReasons.compoundVariant); continue }
      for (const property of variant.properties) {
        if (!ts.isPropertyAssignment(property)) { recordUnresolved(property, sourcePath, file, buffered, recipeUnresolvedReasons.compoundVariantProperty); continue }
        const name = staticPropertyName(property.name)
        if (!name) { recordUnresolved(property, sourcePath, file, buffered, recipeUnresolvedReasons.compoundVariantProperty); continue }
        if (classPropertyNames.has(name)) classSourcesFromExpression(property.initializer, buffered, sourcePath, file, scope, {}, resolving)
      }
    }
    finish()
  }

  const topLevelScope = (source: ts.SourceFile, sourcePath: string): Scope => {
    const recipes = new Map<string, RecipeDefinition>()
    const importedBindings = new Map<string, ImportedBinding>()
    const namespaceBindings = new Map<string, string>()
    const values = new Map<string, ValueBinding>()
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        values.set(declaration.name.text, valueBinding(declaration))
        if (isNamedCall(declaration.initializer, recipeNames)) recipes.set(declaration.name.text, { call: declaration.initializer, sourcePath, sourceFile: source })
      }
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause?.namedBindings) continue
      if (ts.isNamedImports(statement.importClause.namedBindings)) for (const element of statement.importClause.namedBindings.elements) importedBindings.set(element.name.text, { importedName: element.propertyName?.text ?? element.name.text, moduleSpecifier: statement.moduleSpecifier.text })
      else namespaceBindings.set(statement.importClause.namedBindings.name.text, statement.moduleSpecifier.text)
    }
    return { recipes, importedBindings, namespaceBindings, values, publicPropBindings: new Set(), publicClassBindings: new Set() }
  }
  const findTopLevelFunction = (source: ts.SourceFile, exportName: string): SourceFunction | undefined => {
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === exportName) return statement
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName || !declaration.initializer) continue
        if (ts.isArrowFunction(declaration.initializer)) return declaration.initializer
        let nested: ts.ArrowFunction | undefined
        const findArrow = (node: ts.Node): void => {
          if (nested) return
          if (ts.isArrowFunction(node)) nested = node
          else ts.forEachChild(node, findArrow)
        }
        findArrow(declaration.initializer)
        if (nested) return nested
      }
    }
    return undefined
  }
  const analyze = (sourcePath: string, exportName?: string): ComponentTokenSourceAnalysis => {
    const source = sourceFile(sourcePath); const declaration = exportName ? findTopLevelFunction(source, exportName) : undefined
    if (exportName && !declaration?.body) return { resolved: [], tokenExpressions: [], unresolved: [{ sourcePath, start: 0, end: 0, expressionKind: "SourceFile", sourceText: exportName, reason: "No component source found." }] }
    const output: ComponentTokenSourceAnalysis = { resolved: [], tokenExpressions: [], unresolved: [] }
    const invalidateBindings = (scope: Scope, names: Iterable<string>) => {
      for (const name of names) {
        scope.importedBindings.delete(name)
        scope.namespaceBindings.delete(name)
        scope.recipes.delete(name)
        scope.values.delete(name)
        scope.publicPropBindings.delete(name)
        scope.publicClassBindings.delete(name)
      }
    }
    const statementBindings = (statements: ts.NodeArray<ts.Statement>): string[] => statements.flatMap((statement) => {
      if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((item) => bindingNames(item.name))
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) return [statement.name.text]
      return []
    })
    const bindStatementValues = (scope: Scope, statements: ts.NodeArray<ts.Statement>) => {
      for (const statement of statements) if (ts.isVariableStatement(statement)) {
        for (const item of statement.declarationList.declarations) if (ts.isIdentifier(item.name)) scope.values.set(item.name.text, valueBinding(item))
      }
    }
    const markWritten = (expression: ts.Expression, scope: Scope) => {
      if (ts.isIdentifier(expression)) {
        const binding = scope.values.get(expression.text)
        if (binding) binding.written = true
      }
    }
    const scanWrites = (node: ts.Node, scope: Scope): void => {
      if (ts.isSourceFile(node) || ts.isBlock(node)) {
        const nested = nestedScope(scope)
        if (ts.isBlock(node)) invalidateBindings(nested, statementBindings(node.statements))
        bindStatementValues(nested, node.statements)
        for (const statement of node.statements) scanWrites(statement, nested)
        return
      }
      if (ts.isCatchClause(node)) {
        const nested = nestedScope(scope)
        if (node.variableDeclaration) invalidateBindings(nested, bindingNames(node.variableDeclaration.name))
        scanWrites(node.block, nested)
        return
      }
      if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        const nested = nestedScope(scope)
        const initializer = node.initializer
        if (initializer && ts.isVariableDeclarationList(initializer)) {
          invalidateBindings(nested, initializer.declarations.flatMap((item) => bindingNames(item.name)))
          for (const item of initializer.declarations) if (ts.isIdentifier(item.name)) nested.values.set(item.name.text, valueBinding(item))
        }
        ts.forEachChild(node, (child) => scanWrites(child, nested))
        return
      }
      if (ts.isSwitchStatement(node)) {
        const nested = nestedScope(scope)
        invalidateBindings(nested, node.caseBlock.clauses.flatMap((clause) => statementBindings(clause.statements)))
        for (const clause of node.caseBlock.clauses) bindStatementValues(nested, clause.statements)
        scanWrites(node.expression, nested)
        for (const clause of node.caseBlock.clauses) for (const statement of clause.statements) scanWrites(statement, nested)
        return
      }
      if (ts.isFunctionLike(node) && node !== declaration) {
        const nested = nestedScope(scope)
        invalidateBindings(nested, node.parameters.flatMap((parameter) => bindingNames(parameter.name)))
        if ("body" in node && node.body) scanWrites(node.body, nested)
        return
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) markWritten(node.left, scope)
      if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) markWritten(node.operand, scope)
      ts.forEachChild(node, (child) => scanWrites(child, scope))
    }
    const visit = (node: ts.Node, scope: Scope): void => {
      if (ts.isSourceFile(node) || ts.isBlock(node)) { const nested = nestedScope(scope); if (ts.isBlock(node)) invalidateBindings(nested, statementBindings(node.statements)); for (const statement of node.statements) visit(statement, nested); return }
      if (ts.isCatchClause(node)) {
        const nested = nestedScope(scope)
        if (node.variableDeclaration) invalidateBindings(nested, bindingNames(node.variableDeclaration.name))
        visit(node.block, nested)
        return
      }
      if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        const nested = nestedScope(scope)
        const initializer = node.initializer
        if (initializer && ts.isVariableDeclarationList(initializer)) invalidateBindings(nested, initializer.declarations.flatMap((item) => bindingNames(item.name)))
        ts.forEachChild(node, (child) => visit(child, nested))
        return
      }
      if (ts.isSwitchStatement(node)) {
        const nested = nestedScope(scope)
        invalidateBindings(nested, node.caseBlock.clauses.flatMap((clause) => statementBindings(clause.statements)))
        visit(node.expression, nested)
        for (const clause of node.caseBlock.clauses) for (const statement of clause.statements) visit(statement, nested)
        return
      }
      if (ts.isFunctionLike(node) && node !== declaration) { const nested = nestedScope(scope); invalidateBindings(nested, node.parameters.flatMap((parameter) => bindingNames(parameter.name))); for (const binding of publicPropBindings(node)) { nested.publicPropBindings.add(binding); if (binding === "className") nested.publicClassBindings.add(binding) } if ("body" in node && node.body) visit(node.body, nested); return }
      if (ts.isVariableStatement(node)) { for (const child of node.declarationList.declarations) if (ts.isIdentifier(child.name)) { scope.values.set(child.name.text, valueBinding(child)); if (child.initializer && isNamedCall(child.initializer, recipeNames)) scope.recipes.set(child.name.text, { call: child.initializer, sourcePath, sourceFile: source }) } ts.forEachChild(node, (child) => visit(child, scope)); return }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "style" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        let styleExpression = node.initializer.expression
        while (ts.isParenthesizedExpression(styleExpression) || ts.isAsExpression(styleExpression) || ts.isTypeAssertionExpression(styleExpression) || ts.isNonNullExpression(styleExpression)) styleExpression = styleExpression.expression
        if (ts.isObjectLiteralExpression(styleExpression)) for (const property of styleExpression.properties) {
          if (ts.isPropertyAssignment(property)) resolveCssArithmeticExpression(property.initializer, output, sourcePath, source, scope)
        }
        return
      }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) { if (ts.isStringLiteral(node.initializer)) output.resolved.push({ classNames: node.initializer.text, source: sourceIdentity(node.initializer, sourcePath, source) }); else if (ts.isJsxExpression(node.initializer)) classSourcesFromExpression(node.initializer.expression, output, sourcePath, source, scope); return }
      if (isNamedCall(node as ts.Expression, classMergeNames)) { classSourcesFromExpression(node as ts.CallExpression, output, sourcePath, source, scope); return }
      ts.forEachChild(node, (child) => visit(child, scope))
    }
    const scope = topLevelScope(source, sourcePath)
    if (declaration) { invalidateBindings(scope, declaration.parameters.flatMap((parameter) => bindingNames(parameter.name))); for (const binding of publicPropBindings(declaration)) { scope.publicPropBindings.add(binding); if (binding === "className") scope.publicClassBindings.add(binding) } scanWrites(declaration.body!, scope); visit(declaration.body!, scope) } else { scanWrites(source, scope); visit(source, scope) }
    for (const classSource of output.resolved) for (const rawUtility of classSource.classNames.split(/\s+/).filter(Boolean)) {
      const parsed = parseTailwindTokenUtility(rawUtility)
      const expression = parsed && arbitraryUtilityExpression(parsed.utility)
      if (!expression || !expression.includes("calc(") || !expression.includes("var(")) continue
      const recipeCondition = classSource.propName && classSource.equals !== undefined ? { propName: classSource.propName, equals: classSource.equals } satisfies TokenConditionAtom : undefined
      const when = combineConditions(recipeCondition, parsed.when)
      if (when === false) continue
      const resolution = resolveCssArithmeticText(expression)
      if (!resolution) continue
      if (typeof resolution === "string") recordIdentityUnresolved(classSource.source, output, resolution)
      else output.tokenExpressions.push({ ...resolution, ...(when ? { when } : {}), source: classSource.source })
    }
    return { resolved: unique(output.resolved), tokenExpressions: unique(output.tokenExpressions), unresolved: unique(output.unresolved) }
  }
  const analyzeTailwindTokenDependencies = (classNames: string, evidenceRefs: string[] = ["source"]): TokenDependency[] => unique(classNames.split(/\s+/).filter(Boolean).flatMap((rawUtility) => {
    const parsed = parseTailwindTokenUtility(rawUtility)
    if (!parsed) return []
    const resolution = config.resolveUtility(parsed.utility)
    return resolution ? [{ ...resolution, ...(parsed.when ? { when: parsed.when } : {}), evidenceRefs }] : []
  }))
  const dependencies = (sourcePath: string, exportName?: string) => {
    const analysis = analyze(sourcePath, exportName)
    const classDependencies = analysis.resolved.flatMap((recipe) => analyzeTailwindTokenDependencies(recipe.classNames).flatMap((dependency) => {
      const recipeCondition = recipe.propName && recipe.equals ? { propName: recipe.propName, equals: recipe.equals } satisfies TokenConditionAtom : undefined
      const when = combineConditions(recipeCondition, dependency.when)
      return when === false ? [] : [{ ...dependency, ...(when ? { when } : {}) }]
    }))
    const expressionDependencies = analysis.tokenExpressions.map(({ source: _source, ...dependency }) => ({ ...dependency, evidenceRefs: ["source"] }))
    return unique([...classDependencies, ...expressionDependencies])
  }
  const comparable = ({ tokenId, when, viaDerivedRule }: Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">) => ({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })
  const key = (dependency: Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">) => stableSerialize(comparable(dependency))
  const compare = (sourcePath: string, dependencies: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, exportName?: string, includeUnresolved = true, analysis = analyze(sourcePath, exportName)) => {
    const expected = new Map((exportName ? dependenciesForExport(sourcePath, exportName) : dependenciesForSource(sourcePath)).map((dependency) => [key(dependency), comparable(dependency)])); const actual = new Map(dependencies.map((dependency) => [key(dependency), comparable(dependency)])); const suffix = exportName ? ` for ${exportName}` : ""
    return [...(includeUnresolved ? analysis.unresolved.map((item) => `Unresolved class evidence at ${sourcePath}:${item.start}: ${item.reason} (${item.sourceText})`) : []), ...[...expected].filter(([value]) => !actual.has(value)).map(([, value]) => `Missing source token dependency${suffix}: ${JSON.stringify(value)}`), ...[...actual].filter(([value]) => !expected.has(value)).map(([, value]) => `Invented token dependency${suffix}: ${JSON.stringify(value)}`)]
  }
  const dependenciesForSource = (sourcePath: string) => dependencies(sourcePath)
  const dependenciesForExport = (sourcePath: string, exportName: string) => dependencies(sourcePath, exportName)
  return {
    analyzeTailwindTokenDependencies,
    analyzeComponentTokenSource: (sourcePath: string) => analyze(sourcePath),
    analyzeComponentTokenSourceForExport: (sourcePath: string, exportName: string) => analyze(sourcePath, exportName),
    analyzeComponentTokenDependencies: dependenciesForSource,
    analyzeComponentTokenDependenciesForExport: dependenciesForExport,
    compareComponentTokenDependencies: (sourcePath: string, contract: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, includeUnresolved = true) => compare(sourcePath, contract, undefined, includeUnresolved),
    compareComponentTokenDependenciesForExport: (sourcePath: string, exportName: string, contract: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, includeUnresolved = true, analysis = analyze(sourcePath, exportName)) => compare(sourcePath, contract, exportName, includeUnresolved, analysis),
  }
}
