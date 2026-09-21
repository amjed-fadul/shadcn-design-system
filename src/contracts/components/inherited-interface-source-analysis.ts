import ts from "typescript"

import type { ConditionalApiCase, InheritedInterfaceEvent, InheritedInterfaceProp, StructuredPropType } from "./types"

const packagePrograms = new Map<string, { checker: ts.TypeChecker; file: ts.SourceFile }>()

export type InterfacePropEvidence = { name: string; required: boolean; typeText: string }
export type InterfaceMemberSelection = { props?: readonly string[]; events: readonly string[] }

function declarationTypeText(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): string {
  return checker.typeToString(type, location, ts.TypeFormatFlags.NoTruncation)
    .replace(/import\("[^"]*\/node_modules\/([^"]+)"\)/g, 'import("$1")')
}

export function classifyTypeText(typeText: string): StructuredPropType {
  if (typeText === "boolean") return { kind: "boolean" }
  if (typeText === "string") return { kind: "string" }
  if (typeText === "number") return { kind: "number" }
  return { kind: "typescript", typeText }
}

export function analyzeIntrinsicReactInterface(tag: keyof React.JSX.IntrinsicElements): InterfacePropEvidence[] {
  const declarationPath = ts.resolveTypeReferenceDirective("react", import.meta.filename, { moduleResolution: ts.ModuleResolutionKind.Node10 }, ts.sys).resolvedTypeReferenceDirective?.resolvedFileName
  if (!declarationPath) throw new Error("Unable to resolve the pinned React declaration source.")
  return analyzePackageComponentInterface({ declarationPath, symbol: `React.JSX.IntrinsicElements["${tag}"]` }).props
    .map(({ name, required, typeText }) => ({ name, required, typeText }))
}

function structuredType(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): StructuredPropType {
  if (type.isStringLiteral()) return { kind: "literal", value: type.value }
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { kind: "literal", value: declarationTypeText(checker, type, location) === "true" }
  if (type.flags & ts.TypeFlags.String) return { kind: "string" }
  if (type.flags & ts.TypeFlags.Boolean) return { kind: "boolean" }
  if (type.flags & ts.TypeFlags.Number) return { kind: "number" }
  if (checker.isArrayType(type)) return { kind: "array", item: structuredType(checker, checker.getTypeArguments(type as ts.TypeReference)[0], location) }
  if (type.isUnion()) return mergeStructuredTypes(type.types.map((member) => structuredType(checker, member, location)))
  return { kind: "typescript", typeText: declarationTypeText(checker, type, location) }
}

function mergeStructuredTypes(types: StructuredPropType[]): StructuredPropType {
  const unique = types.filter((type, index) => types.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(type)) === index)
  if (unique.length === 1) return unique[0]
  if (unique.every((type): type is Extract<StructuredPropType, { kind: "literal" }> => type.kind === "literal" && typeof type.value === "string")) return { kind: "enum", values: unique.map((type) => (type as Extract<StructuredPropType, { kind: "literal" }>).value as string) }
  return { kind: "union", members: unique as [StructuredPropType, StructuredPropType, ...StructuredPropType[]] }
}

function mergedTypeText(checker: ts.TypeChecker, types: ts.Type[], location: ts.Node): string {
  const unique = types.filter((type, index) => types.findIndex((candidate) => declarationTypeText(checker, candidate, location) === declarationTypeText(checker, type, location)) === index)
  return unique.map((type) => declarationTypeText(checker, type, location)).join(" | ")
}

function intrinsicPropsType(checker: ts.TypeChecker, file: ts.SourceFile, symbol: string): ts.Type | undefined {
  const match = symbol.match(/^React\.JSX\.IntrinsicElements\["([a-z][a-z0-9-]*)"\]$/)
  if (!match) return undefined
  let result: ts.Type | undefined
  const visit = (node: ts.Node) => {
    if (result) return
    if (ts.isInterfaceDeclaration(node) && node.name.text === "IntrinsicElements") {
      const property = node.members.find((member): member is ts.PropertySignature => ts.isPropertySignature(member) && member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) && member.name.text === match[1])
      if (property) result = checker.getTypeAtLocation(property)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

export function analyzePackageComponentInterface(source: { declarationPath: string; symbol: string }, factNames?: InterfaceMemberSelection): Pick<{ props: InheritedInterfaceProp[]; events: InheritedInterfaceEvent[]; conditionalApi: ConditionalApiCase[] }, "props" | "events" | "conditionalApi"> {
  let program = packagePrograms.get(source.declarationPath)
  if (!program) {
    const created = ts.createProgram([source.declarationPath], { target: ts.ScriptTarget.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10, skipLibCheck: true, esModuleInterop: true })
    const file = created.getSourceFile(source.declarationPath)
    if (!file) throw new Error(`Unable to read declaration: ${source.declarationPath}.`)
    program = { checker: created.getTypeChecker(), file }
    packagePrograms.set(source.declarationPath, program)
  }
  const { checker, file } = program
  const intrinsic = intrinsicPropsType(checker, file, source.symbol)
  const moduleSymbol = checker.getSymbolAtLocation(file)
  const symbolPath = source.symbol.split(".")
  let exported = intrinsic ? undefined : moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.getName() === symbolPath[0])
  let declaration = exported?.valueDeclaration ?? exported?.declarations?.[0] ?? file
  if (!intrinsic && !exported) throw new Error(`Unable to resolve package export: ${source.symbol}.`)
  let exportedType = exported && checker.getTypeOfSymbolAtLocation(exported, declaration)

  for (const memberName of intrinsic ? [] : symbolPath.slice(1)) {
    const member = exportedType && checker.getPropertyOfType(exportedType, memberName)
    if (!member) throw new Error(`Unable to resolve package export member: ${source.symbol}.`)
    exported = member
    declaration = member.valueDeclaration ?? member.declarations?.[0] ?? declaration
    exportedType = checker.getTypeOfSymbolAtLocation(member, declaration)
  }

  const parameter = exportedType?.getCallSignatures()[0]?.parameters[0]
  const typeSymbol = exported && (exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported)
  const declaredType = typeSymbol && (typeSymbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) ? checker.getDeclaredTypeOfSymbol(typeSymbol) : undefined
  const propsType = intrinsic ?? (parameter ? checker.getTypeOfSymbolAtLocation(parameter, declaration) : declaredType ?? exportedType)
  if (!propsType) throw new Error(`Package export ${source.symbol} does not expose component props.`)
  const branches = propsType.isUnion() ? propsType.types : [propsType]
  const evidenceRefs = ["declaration"]
  const events = factNames?.events ?? []
  const memberNames = {
    props: factNames?.props ?? checker.getPropertiesOfType(propsType).map((symbol) => symbol.getName()).filter((name) => !events.includes(name)).sort((left, right) => left.localeCompare(right)),
    events,
  }
  const propFacts = memberNames.props.map((name) => {
    const symbols = branches.map((branch) => checker.getPropertyOfType(branch, name)).filter((symbol): symbol is ts.Symbol => Boolean(symbol))
    if (symbols.length === 0) throw new Error(`Package export ${source.symbol} is missing requested prop: ${name}.`)
    const types = symbols.map((symbol) => checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration))
    const location = intrinsic ? symbols[0].valueDeclaration ?? symbols[0].declarations?.[0] ?? declaration : declaration
    return { name, required: symbols.length === branches.length && symbols.every((symbol) => !(symbol.getFlags() & ts.SymbolFlags.Optional)), type: mergeStructuredTypes(types.map((type) => structuredType(checker, type, location))), typeText: mergedTypeText(checker, types, location), evidenceRefs }
  })
  const eventFacts = memberNames.events.map((propName) => {
    const symbols = branches.map((branch) => checker.getPropertyOfType(branch, propName)).filter((symbol): symbol is ts.Symbol => Boolean(symbol))
    if (symbols.length === 0) throw new Error(`Package export ${source.symbol} is missing requested event: ${propName}.`)
    const payloadTypes = symbols.map((symbol) => {
      const eventType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration)
      const payload = eventType.getCallSignatures()[0]?.parameters[0]
      if (!payload) throw new Error(`Package event ${propName} does not expose a payload.`)
      return checker.getTypeOfSymbolAtLocation(payload, declaration)
    })
    return { propName, required: symbols.length === branches.length && symbols.every((symbol) => !(symbol.getFlags() & ts.SymbolFlags.Optional)), payload: mergeStructuredTypes(payloadTypes.map((type) => structuredType(checker, type, declaration))), payloadTypeText: mergedTypeText(checker, payloadTypes, declaration), evidenceRefs }
  })
  const discriminator = branches.length > 1 ? propFacts.find((prop) => {
    const branchTypes = branches.map((branch) => {
      const symbol = checker.getPropertyOfType(branch, prop.name)
      return symbol ? checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration) : undefined
    })
    return branchTypes.length === branches.length
      && branchTypes.every((type): type is ts.StringLiteralType => Boolean(type?.isStringLiteral()))
      && new Set(branchTypes.map((type) => type.value)).size > 1
  }) : undefined
  const conditionalApi = discriminator ? branches.map((branch) => {
    const typeSymbol = checker.getPropertyOfType(branch, discriminator.name)
    const type = typeSymbol && checker.getTypeOfSymbolAtLocation(typeSymbol, typeSymbol.valueDeclaration ?? declaration)
    if (!type?.isStringLiteral()) throw new Error(`Package export ${source.symbol} has a non-literal discriminator branch.`)
    const propRefinements = propFacts.filter((prop) => prop.name !== discriminator.name).map((prop) => {
      const symbol = checker.getPropertyOfType(branch, prop.name)
      if (!symbol) return { propName: prop.name, availability: "unavailable" as const, evidenceRefs }
      const valueType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration)
      const required = !(symbol.getFlags() & ts.SymbolFlags.Optional); const type = structuredType(checker, valueType, declaration)
      return JSON.stringify(type) === JSON.stringify(prop.type) && required === prop.required ? undefined : { propName: prop.name, availability: "available" as const, required, type, evidenceRefs }
    }).filter((refinement): refinement is NonNullable<typeof refinement> => Boolean(refinement))
    const eventRefinements = eventFacts.map((event) => {
      const symbol = checker.getPropertyOfType(branch, event.propName)
      if (!symbol) throw new Error(`Package export ${source.symbol} branch is missing event: ${event.propName}.`)
      const eventType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration)
      const payload = eventType.getCallSignatures()[0]?.parameters[0]
      if (!payload) throw new Error(`Package event ${event.propName} does not expose a payload.`)
      return { eventPropName: event.propName, payload: structuredType(checker, checker.getTypeOfSymbolAtLocation(payload, declaration), declaration), evidenceRefs }
    })
    return { when: { propName: discriminator.name, equals: type.value }, propRefinements, eventRefinements, stateChannels: [], evidenceRefs }
  }) : []
  return { props: propFacts, events: eventFacts, conditionalApi }
}
