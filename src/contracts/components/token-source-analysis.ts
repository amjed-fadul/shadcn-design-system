import { readFileSync } from "node:fs"
import ts from "typescript"

import type { SourceExpressionIdentity, TokenDependency } from "./types"

export type ClassSource = { classNames: string; propName?: string; equals?: string }
export type UnresolvedClassSource = SourceExpressionIdentity & { reason: string }
export type ComponentTokenSourceAnalysis = { resolved: ClassSource[]; unresolved: UnresolvedClassSource[] }
export type TokenUtilityResolution = Pick<TokenDependency, "tokenId" | "viaDerivedRule">
export type TokenCoverageFinding = { utility: string; classification: string; tokenId?: string; namespace?: string }
export type RecipeUnresolvedReason = "dynamicConfiguration" | "configurationProperty" | "dynamicVariants" | "variantProperty" | "dynamicVariantValues" | "variantValueProperty" | "dynamicCompoundVariants" | "compoundVariant" | "compoundVariantProperty"
export type TokenSourceAnalyzerConfig = Readonly<{
  resolveUtility: (utility: string) => TokenUtilityResolution | undefined
  classMergeFunctionNames?: readonly string[]
  recipeFunctionNames?: readonly string[]
  recipeVariantsProperty?: string
  recipeCompoundVariantsProperty?: string
  recipeClassPropertyNames?: readonly string[]
  recipeUnresolvedReasons?: Partial<Record<RecipeUnresolvedReason, string>>
  readSource?: (sourcePath: string) => string
}>

type Scope = { recipes: Map<string, ts.CallExpression>; publicClassBindings: Set<string> }
type SourceFunction = ts.FunctionDeclaration | ts.ArrowFunction

function unique<T>(items: T[]) { return items.filter((item, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index) }
function propertyName(property: ts.PropertyAssignment, file: ts.SourceFile) { return ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : property.name.getText(file) }
function nestedScope(scope: Scope): Scope { return { recipes: new Map(scope.recipes), publicClassBindings: new Set(scope.publicClassBindings) } }
function publicClassBindings(functionLike: Pick<ts.SignatureDeclarationBase, "parameters">) {
  const bindings = new Set<string>(); const parameter = functionLike.parameters[0]
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return bindings
  for (const element of parameter.name.elements) {
    const property = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined
    if (property === "className" && ts.isIdentifier(element.name)) bindings.add(element.name.text)
  }
  return bindings
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
    dynamicCompoundVariants: "Unsupported dynamic recipe compound variants.",
    compoundVariant: "Unsupported dynamic recipe compound variant.",
    compoundVariantProperty: "Unsupported recipe compound variant property.",
    ...config.recipeUnresolvedReasons,
  }
  const readSource = config.readSource ?? ((sourcePath: string) => readFileSync(sourcePath, "utf8"))
  const sourceFile = (sourcePath: string) => ts.createSourceFile(sourcePath, readSource(sourcePath), ts.ScriptTarget.Latest, true, sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const isNamedCall = (expression: ts.Expression, names: ReadonlySet<string>): expression is ts.CallExpression => ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && names.has(expression.expression.text)
  const recordUnresolved = (node: ts.Node, sourcePath: string, file: ts.SourceFile, output: ComponentTokenSourceAnalysis, reason: string) => output.unresolved.push({ sourcePath, start: node.getStart(file), end: node.getEnd(), expressionKind: ts.SyntaxKind[node.kind], sourceText: node.getText(file), reason })

  const classSourcesFromExpression = (expression: ts.Expression | undefined, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, context: Pick<ClassSource, "propName" | "equals"> = {}, resolving = new Set<ts.CallExpression>()): void => {
    if (!expression) return
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) { output.resolved.push({ classNames: expression.text, ...context }); return }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) { classSourcesFromExpression(expression.expression, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isConditionalExpression(expression)) { classSourcesFromExpression(expression.whenTrue, output, sourcePath, file, scope, context, resolving); classSourcesFromExpression(expression.whenFalse, output, sourcePath, file, scope, context, resolving); return }
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { classSourcesFromExpression(expression.right, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, classMergeNames)) { for (const argument of expression.arguments) classSourcesFromExpression(argument, output, sourcePath, file, scope, context, resolving); return }
    if (isNamedCall(expression, recipeNames)) { recipeClassSources(expression, output, sourcePath, file, scope, resolving); return }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && scope.recipes.has(expression.expression.text)) { recipeClassSources(scope.recipes.get(expression.expression.text)!, output, sourcePath, file, scope, resolving); return }
    if (ts.isIdentifier(expression) && scope.recipes.has(expression.text)) { recipeClassSources(scope.recipes.get(expression.text)!, output, sourcePath, file, scope, resolving); return }
    if (ts.isIdentifier(expression) && scope.publicClassBindings.has(expression.text)) return
    recordUnresolved(expression, sourcePath, file, output, ts.isTemplateExpression(expression) ? "Template interpolation prevents factual class resolution." : "Unsupported dynamic class expression.")
  }

  const recipeClassSources = (call: ts.CallExpression, output: ComponentTokenSourceAnalysis, sourcePath: string, file: ts.SourceFile, scope: Scope, resolving = new Set<ts.CallExpression>()): void => {
    if (resolving.has(call)) return
    resolving.add(call); classSourcesFromExpression(call.arguments[0], output, sourcePath, file, scope, {}, resolving)
    const definition = call.arguments[1]
    if (!definition) { resolving.delete(call); return }
    if (!ts.isObjectLiteralExpression(definition)) { recordUnresolved(definition, sourcePath, file, output, recipeUnresolvedReasons.dynamicConfiguration); resolving.delete(call); return }
    for (const property of definition.properties) if (!ts.isPropertyAssignment(property)) recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.configurationProperty)
    const assignment = (name: string) => definition.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && propertyName(property, file) === name)?.initializer
    const variants = assignment(variantsProperty)
    if (variants && !ts.isObjectLiteralExpression(variants)) recordUnresolved(variants, sourcePath, file, output, recipeUnresolvedReasons.dynamicVariants)
    if (variants && ts.isObjectLiteralExpression(variants)) for (const variant of variants.properties) {
      if (!ts.isPropertyAssignment(variant)) { recordUnresolved(variant, sourcePath, file, output, recipeUnresolvedReasons.variantProperty); continue }
      if (!ts.isObjectLiteralExpression(variant.initializer)) { recordUnresolved(variant.initializer, sourcePath, file, output, recipeUnresolvedReasons.dynamicVariantValues); continue }
      for (const value of variant.initializer.properties) {
        if (!ts.isPropertyAssignment(value)) { recordUnresolved(value, sourcePath, file, output, recipeUnresolvedReasons.variantValueProperty); continue }
        classSourcesFromExpression(value.initializer, output, sourcePath, file, scope, { propName: propertyName(variant, file), equals: propertyName(value, file) }, resolving)
      }
    }
    const compoundVariants = assignment(compoundVariantsProperty)
    if (compoundVariants && !ts.isArrayLiteralExpression(compoundVariants)) recordUnresolved(compoundVariants, sourcePath, file, output, recipeUnresolvedReasons.dynamicCompoundVariants)
    if (compoundVariants && ts.isArrayLiteralExpression(compoundVariants)) for (const variant of compoundVariants.elements) {
      if (!ts.isObjectLiteralExpression(variant)) { if (ts.isExpression(variant)) recordUnresolved(variant, sourcePath, file, output, recipeUnresolvedReasons.compoundVariant); continue }
      for (const property of variant.properties) {
        if (!ts.isPropertyAssignment(property)) { recordUnresolved(property, sourcePath, file, output, recipeUnresolvedReasons.compoundVariantProperty); continue }
        if (classPropertyNames.has(propertyName(property, file))) classSourcesFromExpression(property.initializer, output, sourcePath, file, scope, {}, resolving)
      }
    }
    resolving.delete(call)
  }

  const topLevelScope = (source: ts.SourceFile): Scope => {
    const recipes = new Map<string, ts.CallExpression>()
    for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer && isNamedCall(declaration.initializer, recipeNames)) recipes.set(declaration.name.text, declaration.initializer)
    return { recipes, publicClassBindings: new Set() }
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
    if (exportName && !declaration?.body) return { resolved: [], unresolved: [{ sourcePath, start: 0, end: 0, expressionKind: "SourceFile", sourceText: exportName, reason: "No component source found." }] }
    const output: ComponentTokenSourceAnalysis = { resolved: [], unresolved: [] }
    const visit = (node: ts.Node, scope: Scope): void => {
      if (ts.isSourceFile(node) || ts.isBlock(node)) { const nested = nestedScope(scope); for (const statement of node.statements) visit(statement, nested); return }
      if (ts.isFunctionLike(node) && node !== declaration) { const nested = nestedScope(scope); for (const binding of publicClassBindings(node)) nested.publicClassBindings.add(binding); if ("body" in node && node.body) visit(node.body, nested); return }
      if (ts.isVariableStatement(node)) { for (const child of node.declarationList.declarations) if (ts.isIdentifier(child.name) && child.initializer && isNamedCall(child.initializer, recipeNames)) scope.recipes.set(child.name.text, child.initializer); ts.forEachChild(node, (child) => visit(child, scope)); return }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) { if (ts.isStringLiteral(node.initializer)) output.resolved.push({ classNames: node.initializer.text }); else if (ts.isJsxExpression(node.initializer)) classSourcesFromExpression(node.initializer.expression, output, sourcePath, source, scope); return }
      if (isNamedCall(node as ts.Expression, classMergeNames)) { classSourcesFromExpression(node as ts.CallExpression, output, sourcePath, source, scope); return }
      ts.forEachChild(node, (child) => visit(child, scope))
    }
    const scope = topLevelScope(source)
    if (declaration) { for (const binding of publicClassBindings(declaration)) scope.publicClassBindings.add(binding); visit(declaration.body!, scope) } else visit(source, scope)
    return { resolved: unique(output.resolved), unresolved: unique(output.unresolved) }
  }
  const analyzeTailwindTokenDependencies = (classNames: string, evidenceRefs: string[] = ["source"]): TokenDependency[] => unique(classNames.split(/\s+/).filter(Boolean).flatMap((rawUtility) => {
    const utility = rawUtility.split(":").at(-1)!.replace(/!$/, "").replace(/\/(?:\d+|\d+\.\d+)$/, "")
    const resolution = config.resolveUtility(utility)
    return resolution ? [{ ...resolution, evidenceRefs }] : []
  }))
  const dependencies = (sourcePath: string, exportName?: string) => unique(analyze(sourcePath, exportName).resolved.flatMap((recipe) => analyzeTailwindTokenDependencies(recipe.classNames).map((dependency) => recipe.propName && recipe.equals ? { ...dependency, when: { propName: recipe.propName, equals: recipe.equals } } : dependency)))
  const key = ({ tokenId, when, viaDerivedRule }: Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">) => JSON.stringify({ tokenId, ...(when ? { when } : {}), ...(viaDerivedRule ? { viaDerivedRule } : {}) })
  const compare = (sourcePath: string, dependencies: Array<Pick<TokenDependency, "tokenId" | "when" | "viaDerivedRule">>, exportName?: string, includeUnresolved = true, analysis = analyze(sourcePath, exportName)) => {
    const expected = new Set((exportName ? dependenciesForExport(sourcePath, exportName) : dependenciesForSource(sourcePath)).map(key)); const actual = new Set(dependencies.map(key)); const suffix = exportName ? ` for ${exportName}` : ""
    return [...(includeUnresolved ? analysis.unresolved.map((item) => `Unresolved class evidence at ${sourcePath}:${item.start}: ${item.reason} (${item.sourceText})`) : []), ...[...expected].filter((value) => !actual.has(value)).map((value) => `Missing source token dependency${suffix}: ${value}`), ...[...actual].filter((value) => !expected.has(value)).map((value) => `Invented token dependency${suffix}: ${value}`)]
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
