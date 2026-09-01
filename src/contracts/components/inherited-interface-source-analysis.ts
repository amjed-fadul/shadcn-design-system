import ts from "typescript"

import type { ConditionalApiCase, InheritedInterfaceEvent, InheritedInterfaceProp, StructuredPropType } from "./types"

const packagePrograms = new Map<string, { checker: ts.TypeChecker; file: ts.SourceFile }>()

export type InterfacePropEvidence = { name: string; required: boolean; typeText: string }

export function classifyTypeText(typeText: string): StructuredPropType {
  if (typeText === "boolean") return { kind: "boolean" }
  if (typeText === "string") return { kind: "string" }
  if (typeText === "number") return { kind: "number" }
  return { kind: "typescript", typeText }
}

export function analyzeIntrinsicReactInterface(tag: keyof React.JSX.IntrinsicElements): InterfacePropEvidence[] {
  const declarationPath = ts.resolveTypeReferenceDirective("react", import.meta.filename, { moduleResolution: ts.ModuleResolutionKind.Node10 }, ts.sys).resolvedTypeReferenceDirective?.resolvedFileName
  if (!declarationPath) throw new Error("Unable to resolve the pinned React declaration source.")
  const program = ts.createProgram([declarationPath], { target: ts.ScriptTarget.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10, skipLibCheck: true, types: [] })
  const checker = program.getTypeChecker(); const file = program.getSourceFile(declarationPath)!; let buttonType: ts.Type | undefined
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "IntrinsicElements") {
      const property = node.members.find((member): member is ts.PropertySignature => ts.isPropertySignature(member) && member.name && ts.isStringLiteral(member.name) ? member.name.text === tag : ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) && member.name.text === tag)
      if (property) buttonType = checker.getTypeAtLocation(property)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!buttonType) throw new Error(`Unable to resolve React.JSX.IntrinsicElements[${String(tag)}].`)
  return checker.getPropertiesOfType(buttonType).map((symbol) => { const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? file; const type = checker.getTypeOfSymbolAtLocation(symbol, declaration); return { name: symbol.getName(), required: !(symbol.getFlags() & ts.SymbolFlags.Optional), typeText: checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation) } }).sort((a, b) => a.name.localeCompare(b.name))
}

function structuredType(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): StructuredPropType {
  if (type.isStringLiteral()) return { kind: "literal", value: type.value }
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { kind: "literal", value: checker.typeToString(type, location, ts.TypeFormatFlags.NoTruncation) === "true" }
  if (type.flags & ts.TypeFlags.String) return { kind: "string" }
  if (type.flags & ts.TypeFlags.Boolean) return { kind: "boolean" }
  if (type.flags & ts.TypeFlags.Number) return { kind: "number" }
  if (checker.isArrayType(type)) return { kind: "array", item: structuredType(checker, checker.getTypeArguments(type as ts.TypeReference)[0], location) }
  if (type.isUnion()) return mergeStructuredTypes(type.types.map((member) => structuredType(checker, member, location)))
  return { kind: "typescript", typeText: checker.typeToString(type, location, ts.TypeFormatFlags.NoTruncation) }
}

function mergeStructuredTypes(types: StructuredPropType[]): StructuredPropType {
  const unique = types.filter((type, index) => types.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(type)) === index)
  if (unique.length === 1) return unique[0]
  if (unique.every((type): type is Extract<StructuredPropType, { kind: "literal" }> => type.kind === "literal" && typeof type.value === "string")) return { kind: "enum", values: unique.map((type) => (type as Extract<StructuredPropType, { kind: "literal" }>).value as string) }
  return { kind: "union", members: unique as [StructuredPropType, StructuredPropType, ...StructuredPropType[]] }
}

function mergedTypeText(checker: ts.TypeChecker, types: ts.Type[], location: ts.Node): string {
  const unique = types.filter((type, index) => types.findIndex((candidate) => checker.typeToString(candidate, location, ts.TypeFormatFlags.NoTruncation) === checker.typeToString(type, location, ts.TypeFormatFlags.NoTruncation)) === index)
  return unique.map((type) => checker.typeToString(type, location, ts.TypeFormatFlags.NoTruncation)).join(" | ")
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

export function analyzePackageComponentInterface(source: { declarationPath: string; symbol: string }, factNames?: { props: readonly string[]; events: readonly string[] }): Pick<{ props: InheritedInterfaceProp[]; events: InheritedInterfaceEvent[]; conditionalApi: ConditionalApiCase[] }, "props" | "events" | "conditionalApi"> {
  let program = packagePrograms.get(source.declarationPath)
  if (!program) {
    const created = ts.createProgram([source.declarationPath], { target: ts.ScriptTarget.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10, skipLibCheck: true })
    const file = created.getSourceFile(source.declarationPath)
    if (!file) throw new Error(`Unable to read declaration: ${source.declarationPath}.`)
    program = { checker: created.getTypeChecker(), file }
    packagePrograms.set(source.declarationPath, program)
  }
  const { checker, file } = program
  const intrinsic = intrinsicPropsType(checker, file, source.symbol)
  const moduleSymbol = checker.getSymbolAtLocation(file)
  const exported = intrinsic ? undefined : moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.getName() === source.symbol)
  const declaration = exported?.valueDeclaration ?? exported?.declarations?.[0] ?? file
  if (!intrinsic && !exported) throw new Error(`Unable to resolve package export: ${source.symbol}.`)
  const exportedType = exported && checker.getTypeOfSymbolAtLocation(exported, declaration)
  const parameter = exportedType?.getCallSignatures()[0]?.parameters[0]
  const propsType = intrinsic ?? (parameter ? checker.getTypeOfSymbolAtLocation(parameter, declaration) : exported ? checker.getDeclaredTypeOfSymbol(exported) : undefined)
  if (!propsType) throw new Error(`Package export ${source.symbol} does not expose component props.`)
  const branches = propsType.isUnion() ? propsType.types : [propsType]
  const evidenceRefs = ["declaration"]
  const memberNames = factNames ?? { props: checker.getPropertiesOfType(propsType).map((symbol) => symbol.getName()).sort((left, right) => left.localeCompare(right)), events: [] }
  const propFacts = memberNames.props.map((name) => {
    const symbols = branches.map((branch) => checker.getPropertyOfType(branch, name)).filter((symbol): symbol is ts.Symbol => Boolean(symbol))
    if (symbols.length === 0) throw new Error(`Package export ${source.symbol} is missing requested prop: ${name}.`)
    const types = symbols.map((symbol) => checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? declaration))
    return { name, required: symbols.length === branches.length && symbols.every((symbol) => !(symbol.getFlags() & ts.SymbolFlags.Optional)), type: mergeStructuredTypes(types.map((type) => structuredType(checker, type, declaration))), typeText: mergedTypeText(checker, types, declaration), evidenceRefs }
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
  const discriminator = branches.length > 1 ? propFacts.find((prop) => prop.type.kind === "enum") : undefined
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
