import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import family from "../contracts/components/families/command.json"
import commandRoot from "../contracts/components/interfaces/cmdk.command.root.json"
import commandInput from "../contracts/components/interfaces/cmdk.command.input.json"
import commandList from "../contracts/components/interfaces/cmdk.command.list.json"
import commandEmpty from "../contracts/components/interfaces/cmdk.command.empty.json"
import commandGroup from "../contracts/components/interfaces/cmdk.command.group.json"
import commandSeparator from "../contracts/components/interfaces/cmdk.command.separator.json"
import commandItem from "../contracts/components/interfaces/cmdk.command.item.json"
import dialogRoot from "../contracts/components/interfaces/radix.dialog.root.json"
import htmlSpan from "../contracts/components/interfaces/html.span.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import knowledge from "../contracts/knowledge/components/command.json"
import references from "../contracts/knowledge/references.json"
import packageJson from "../package.json"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import {
  analyzeJsxRenderTree,
  compareJsxRenderTree,
  extractFunctionPropDefaults,
  listModuleExports,
} from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependenciesForExport } from "./helpers/component-token-analysis"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(repoRoot, "src/components/ui/command.tsx")
const cmdkDeclarationPath = join(repoRoot, "node_modules/cmdk/dist/index.d.ts")

const cmdkInterfaces = [
  commandRoot,
  commandInput,
  commandList,
  commandEmpty,
  commandGroup,
  commandSeparator,
  commandItem,
] as any[]

const eventNames = new Map<string, string[]>([
  ["Command", ["onValueChange"]],
  ["Command.Input", ["onValueChange"]],
  ["Command.Item", ["onSelect"]],
])

const commandRenderConventions = {
  ...canonicalRenderSourceAnalysisConventions,
  matchesInheritedInterface(
    sourceTag: string,
    interfaceId: string,
    normalizeRenderName: (name: string) => string
  ) {
    if (sourceTag === "CommandPrimitive" && interfaceId === "cmdk.command.root") {
      return true
    }
    if (sourceTag.startsWith("CommandPrimitive.")) {
      const member = sourceTag.split(".").at(-1)?.toLowerCase()
      if (member && interfaceId === `cmdk.command.${member}`) return true
    }
    return canonicalRenderSourceAnalysisConventions.matchesInheritedInterface!(
      sourceTag,
      interfaceId,
      normalizeRenderName
    )
  },
}

function schemaValid(schema: object, value: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value)
}

function expectedCmdk(contract: any) {
  const events = eventNames.get(contract.source.symbol) ?? []
  return analyzePackageComponentInterface(
    {
      declarationPath: cmdkDeclarationPath,
      symbol: contract.source.symbol,
    },
    {
      props: contract.props.map((prop: any) => prop.name),
      events,
    }
  )
}

describe("release.5 Command", () => {
  test(
    "pins cmdk 1.1.1 and exact dotted-export interface evidence",
    () => {
      expect(packageJson.dependencies.cmdk).toBe("1.1.1")
      expect(schemaValid(familySchema, family)).toBe(true)

      const declarationHash = createHash("sha256")
        .update(readFileSync(cmdkDeclarationPath))
        .digest("hex")

      for (const contract of cmdkInterfaces) {
        expect(schemaValid(interfaceSchema, contract)).toBe(true)
        expect(contract.source.package).toBe("cmdk")
        expect(contract.source.version).toBe("1.1.1")
        expect(contract.source.declarationSha256).toBe(declarationHash)
        expect(contract.unresolved).toEqual([])

        const expected = expectedCmdk(contract)
        expect({
          props: contract.props,
          events: contract.events ?? [],
          conditionalApi: contract.conditionalApi ?? [],
        }).toEqual(expected)
      }
    },
    60_000
  )

  test("resolves cmdk static component members without flattening them to root", () => {
    expect(commandInput.source.symbol).toBe("Command.Input")
    expect(commandItem.source.symbol).toBe("Command.Item")
    expect(commandInput.props.some((prop) => prop.name === "placeholder")).toBe(true)
    expect(commandItem.props.some((prop) => prop.name === "keywords")).toBe(true)
    expect(commandItem.events).toEqual([
      {
        propName: "onSelect",
        required: false,
        payload: { kind: "string" },
        payloadTypeText: "string",
        evidenceRefs: ["declaration"],
      },
    ])
  })

  test("keeps source and current shadcn upstream identity exact", () => {
    const blobSha = execFileSync("git", ["hash-object", "src/components/ui/command.tsx"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim()

    expect(family.source.canonicalBlobSha).toBe(blobSha)
    expect(family.source.canonicalBlobSha).toBe(
      "56b0f212aa627ddb0c650849a0cefc607e0a320c"
    )
    expect(family.source.upstreamPath).toBe(
      "apps/v4/registry/new-york-v4/ui/command.tsx"
    )
    expect(family.source.upstreamBlobSha).toBe(
      "1605b2f525140db07b1d0f267721e22c185bd43c"
    )
  })

  test("keeps all nine public exports and source render trees exact", () => {
    expect(listModuleExports(sourcePath).map((entry) => entry.name)).toEqual([
      "Command",
      "CommandDialog",
      "CommandEmpty",
      "CommandGroup",
      "CommandInput",
      "CommandItem",
      "CommandList",
      "CommandSeparator",
      "CommandShortcut",
    ])

    for (const entry of family.exports) {
      if (!entry.component) continue
      expect(
        compareJsxRenderTree(
          entry.component.rendering as any,
          analyzeJsxRenderTree(sourcePath, entry.name) as any,
          commandRenderConventions
        ),
        entry.name
      ).toEqual([])
    }
  })

  test("keeps Command token dependencies complete per export", () => {
    for (const entry of family.exports) {
      if (!entry.component) continue

      const sourceTokens = analyzeComponentTokenDependenciesForExport(sourcePath, entry.name)
        .map((dependency) => JSON.stringify(dependency))
        .sort()

      const contractTokens = entry.component.tokenDependencies
        .map((dependency) =>
          JSON.stringify({
            ...dependency,
            evidenceRefs: dependency.evidenceRefs.filter((ref) => ref !== "tokens"),
          })
        )
        .sort()

      expect(contractTokens, entry.name).toEqual(sourceTokens)
    }
  })

  test("models value/search selection state, item selection event, and Dialog defaults", () => {
    const root = family.exports.find((entry) => entry.name === "Command")!.component!
    const input = family.exports.find((entry) => entry.name === "CommandInput")!.component!
    const item = family.exports.find((entry) => entry.name === "CommandItem")!.component!
    const dialog = family.exports.find((entry) => entry.name === "CommandDialog")!.component!

    expect(root.stateChannels).toEqual([
      {
        name: "value",
        controlledProp: "value",
        defaultProp: "defaultValue",
        changeEventProp: "onValueChange",
        evidenceRefs: ["declaration"],
      },
    ])
    expect(input.stateChannels).toEqual([
      {
        name: "value",
        controlledProp: "value",
        defaultProp: "defaultValue",
        changeEventProp: "onValueChange",
        evidenceRefs: ["declaration"],
      },
    ])
    expect(item.events).toEqual([])
    expect(commandItem.events).toEqual([
      {
        propName: "onSelect",
        required: false,
        payload: { kind: "string" },
        payloadTypeText: "string",
        evidenceRefs: ["declaration"],
      },
    ])
    expect(dialog.stateChannels).toEqual([
      {
        name: "open",
        controlledProp: "open",
        defaultProp: "defaultOpen",
        changeEventProp: "onOpenChange",
        evidenceRefs: ["declaration"],
      },
    ])

    expect(Object.fromEntries(extractFunctionPropDefaults(sourcePath, "CommandDialog"))).toEqual({
      title: "Command Palette",
      description: "Search for a command to run...",
      showCloseButton: true,
    })
  })

  test("keeps cmdk slot/context composition and CommandInput wrapper structure", () => {
    const root = family.exports.find((entry) => entry.name === "Command")!.component!
    expect(root.composition).toEqual({
      requires: [],
      provides: ["command.context"],
      hardConstraints: [],
    })

    for (const name of [
      "Command",
      "CommandInput",
      "CommandList",
      "CommandEmpty",
      "CommandGroup",
      "CommandSeparator",
      "CommandItem",
    ]) {
      const component = family.exports.find((entry) => entry.name === name)!.component!
      expect(component.slots).toEqual([
        expect.objectContaining({
          propName: "asChild",
          default: false,
          replacesHost: true,
          forwardsProps: true,
        }),
      ])
    }

    for (const name of [
      "CommandInput",
      "CommandList",
      "CommandEmpty",
      "CommandGroup",
      "CommandSeparator",
      "CommandItem",
    ]) {
      const component = family.exports.find((entry) => entry.name === name)!.component!
      expect(component.composition.requires).toContain("command.context")
    }

    const input = family.exports.find((entry) => entry.name === "CommandInput")!.component!
    const rendering = input.rendering as any
    expect(rendering.rootNodeId).toBe("wrapper")
    expect(rendering.publicPropsTargetNodeId).toBe("input")
    expect(rendering.nodes.find((node: any) => node.id === "wrapper")?.host)
      .toEqual({ kind: "intrinsic", tag: "div" })
    expect(rendering.nodes.find((node: any) => node.id === "input")?.host)
      .toEqual({ kind: "inherited-interface", interfaceId: "cmdk.command.input" })
  })

  test("passes semantic invariants against cmdk, Dialog, and intrinsic authority", () => {
    const allInterfaces = [...cmdkInterfaces, dialogRoot, htmlSpan] as any[]
    const authority = {
      interfaceIds: new Set(allInterfaces.map((entry) => entry.id)),
      interfacePropNames: new Map(
        allInterfaces.map((entry) => [
          entry.id,
          new Set([
            ...entry.props.map((prop: any) => prop.name),
            ...(entry.events ?? []).map((event: any) => event.propName),
          ]),
        ])
      ),
      interfaceContracts: new Map(allInterfaces.map((entry) => [entry.id, entry])),
      tokenIds: new Set(tokenContract.tokens.map((token: any) => token.id)),
      derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule: any) => rule.id)),
      capabilityIds: new Set(["command.context"]),
      sourceIdentity: {
        canonicalPath: family.source.canonicalPath,
        canonicalBlobSha: family.source.canonicalBlobSha,
      },
    }

    expect(validateComponentFamilyInvariants(family as any, authority as any)).toEqual([])
  })

  test("keeps official Command knowledge registered and RTL-safe shortcut spacing", () => {
    expect(knowledge.guidanceStatus).toMatchObject({
      whatItIs: "available",
      whenToUse: "available",
      howToUse: "available",
      options: "available",
    })
    expect(references.references.some((reference) => reference.id === "shadcn.command.docs"))
      .toBe(true)

    const source = readFileSync(sourcePath, "utf8")
    expect(source).toContain('"ms-auto text-xs tracking-widest text-muted-foreground"')
    expect(source).not.toContain('"ml-auto text-xs tracking-widest text-muted-foreground"')
  })
})
