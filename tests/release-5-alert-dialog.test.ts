import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import family from "../contracts/components/families/alert-dialog.json"
import rootInterface from "../contracts/components/interfaces/radix.alert-dialog.root.json"
import triggerInterface from "../contracts/components/interfaces/radix.alert-dialog.trigger.json"
import portalInterface from "../contracts/components/interfaces/radix.alert-dialog.portal.json"
import overlayInterface from "../contracts/components/interfaces/radix.alert-dialog.overlay.json"
import contentInterface from "../contracts/components/interfaces/radix.alert-dialog.content.json"
import titleInterface from "../contracts/components/interfaces/radix.alert-dialog.title.json"
import descriptionInterface from "../contracts/components/interfaces/radix.alert-dialog.description.json"
import actionInterface from "../contracts/components/interfaces/radix.alert-dialog.action.json"
import cancelInterface from "../contracts/components/interfaces/radix.alert-dialog.cancel.json"
import htmlDiv from "../contracts/components/interfaces/html.div.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import knowledge from "../contracts/knowledge/components/alert-dialog.json"
import references from "../contracts/knowledge/references.json"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import {
  analyzeJsxRenderTree,
  compareJsxRenderTree,
  extractCvaVariantLiterals,
  extractFunctionPropDefaults,
  listModuleExports,
} from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependenciesForExport } from "./helpers/component-token-analysis"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(repoRoot, "src/components/ui/alert-dialog.tsx")
const buttonPath = join(repoRoot, "src/components/ui/button.tsx")
const radixDeclarationPath = join(
  repoRoot,
  "node_modules/@radix-ui/react-alert-dialog/dist/index.d.ts"
)

const interfaces = [
  rootInterface,
  triggerInterface,
  portalInterface,
  overlayInterface,
  contentInterface,
  titleInterface,
  descriptionInterface,
  actionInterface,
  cancelInterface,
] as any[]

function schemaValid(schema: object, value: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value)
}

function normalizeMachineSpecificTypePaths<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, current) => {
    if (typeof current !== "string") return current
    return current.replace(
      /import\("[^"]*\/node_modules\/(@radix-ui\/[^"]+)"\)/g,
      'import("$1")'
    )
  }) as T
}

function expectedInterface(contract: any) {
  const analyzed = analyzePackageComponentInterface({
    declarationPath: radixDeclarationPath,
    symbol: contract.source.symbol,
  })
  if (contract.source.symbol !== "Root") return analyzed

  const events = analyzePackageComponentInterface(
    { declarationPath: radixDeclarationPath, symbol: "Root" },
    { props: [], events: ["onOpenChange"] }
  ).events
  return {
    props: analyzed.props.filter((prop) => prop.name !== "onOpenChange"),
    events,
    conditionalApi: analyzed.conditionalApi,
  }
}

describe("release.5 Alert Dialog", () => {
  test(
    "keeps the family and inherited interfaces schema-valid and source-pinned",
    () => {
      expect(schemaValid(familySchema, family)).toBe(true)
      for (const contract of interfaces) {
        expect(schemaValid(interfaceSchema, contract)).toBe(true)
      }

      const blobSha = execFileSync("git", ["hash-object", "src/components/ui/alert-dialog.tsx"], {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim()

      expect(family.source.canonicalBlobSha).toBe(blobSha)
      expect(family.source.canonicalBlobSha).toBe(
        "8f52a23d78dcba8c5226d4e375c03335399520b2"
      )
      expect(family.source.upstreamPath).toBe(
        "apps/v4/registry/bases/radix/ui/alert-dialog.tsx"
      )
      expect(family.source.upstreamBlobSha).toBe(
        "9726776cda43f26e624e88a3dc54ec22eaefdcb3"
      )

      const declarationHash = createHash("sha256")
        .update(readFileSync(radixDeclarationPath))
        .digest("hex")
      for (const contract of interfaces) {
        expect(contract.source.declarationSha256).toBe(declarationHash)
        expect(contract.source.package).toBe("@radix-ui/react-alert-dialog")
        expect(contract.source.version).toBe("1.1.23")
      }
    },
    60_000
  )

  test(
    "reconciles every Alert Dialog interface against the pinned declaration",
    () => {
      for (const contract of interfaces) {
        const expected = expectedInterface(contract)
        expect(normalizeMachineSpecificTypePaths(contract.props)).toEqual(
          normalizeMachineSpecificTypePaths(expected.props)
        )
        expect(contract.events ?? []).toEqual(expected.events ?? [])
        expect(contract.conditionalApi ?? []).toEqual(expected.conditionalApi ?? [])
        expect(contract.unresolved).toEqual([])
        expect(JSON.stringify(contract)).not.toContain("/home/runner/")
        expect(JSON.stringify(contract)).not.toContain("/Users/")
      }
    },
    60_000
  )

  test("keeps all twelve public exports and rendering facts exact", () => {
    const exports = listModuleExports(sourcePath).map((entry) => entry.name)
    expect(exports).toEqual([
      "AlertDialog",
      "AlertDialogAction",
      "AlertDialogCancel",
      "AlertDialogContent",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogMedia",
      "AlertDialogOverlay",
      "AlertDialogPortal",
      "AlertDialogTitle",
      "AlertDialogTrigger",
    ])

    for (const entry of family.exports) {
      const component = entry.component
      if (!component) continue
      expect(
        compareJsxRenderTree(
          component.rendering as any,
          analyzeJsxRenderTree(sourcePath, entry.name) as any
        )
      ).toEqual([])
    }
  })

  test("keeps Alert Dialog token dependencies complete per export", () => {
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

  test("keeps size and Button-derived action options exact", () => {
    expect(Object.fromEntries(extractFunctionPropDefaults(sourcePath, "AlertDialogContent")))
      .toEqual({ size: "default" })
    expect(Object.fromEntries(extractFunctionPropDefaults(sourcePath, "AlertDialogAction")))
      .toEqual({ variant: "default", size: "default" })
    expect(Object.fromEntries(extractFunctionPropDefaults(sourcePath, "AlertDialogCancel")))
      .toEqual({ variant: "outline", size: "default" })

    const buttonVariants = extractCvaVariantLiterals(buttonPath, "buttonVariants")
    const action = family.exports.find((entry) => entry.name === "AlertDialogAction")!.component!
    const cancel = family.exports.find((entry) => entry.name === "AlertDialogCancel")!.component!
    const content = family.exports.find((entry) => entry.name === "AlertDialogContent")!.component!

    expect(content.localProps).toEqual([
      {
        name: "size",
        required: false,
        type: { kind: "enum", values: ["default", "sm"] },
        default: "default",
        evidenceRefs: ["source"],
      },
    ])

    for (const component of [action, cancel]) {
      expect(component.localProps.find((prop) => prop.name === "variant")?.type).toEqual({
        kind: "enum",
        values: buttonVariants.variants.variant,
      })
      expect(component.localProps.find((prop) => prop.name === "size")?.type).toEqual({
        kind: "enum",
        values: buttonVariants.variants.size,
      })
    }
  })

  test("models open state, context, slots, portal, and Button wrappers", () => {
    const root = family.exports.find((entry) => entry.name === "AlertDialog")!.component!
    expect(root.stateChannels).toEqual([
      {
        name: "open",
        controlledProp: "open",
        defaultProp: "defaultOpen",
        changeEventProp: "onOpenChange",
        evidenceRefs: ["declaration"],
      },
    ])
    expect(root.composition).toEqual({
      requires: [],
      provides: ["alert-dialog.context"],
      hardConstraints: [],
    })

    for (const name of [
      "AlertDialogTrigger",
      "AlertDialogOverlay",
      "AlertDialogContent",
      "AlertDialogTitle",
      "AlertDialogDescription",
      "AlertDialogAction",
      "AlertDialogCancel",
    ]) {
      const component = family.exports.find((entry) => entry.name === name)!.component!
      expect(component.composition.requires).toContain("alert-dialog.context")
      expect(component.slots).toEqual([
        expect.objectContaining({
          propName: "asChild",
          default: false,
          replacesHost: true,
          forwardsProps: true,
        }),
      ])
    }

    const content = family.exports.find((entry) => entry.name === "AlertDialogContent")!.component!
    expect((content.rendering as any).portalBoundaries).toEqual([
      { nodeId: "portal", evidenceRefs: ["source"] },
    ])

    for (const name of ["AlertDialogAction", "AlertDialogCancel"]) {
      const component = family.exports.find((entry) => entry.name === name)!.component!
      const rendering = component.rendering as any
      expect(rendering.nodes.find((node: any) => node.id === "button")?.host)
        .toEqual({ kind: "unresolved" })
    }
  })

  test("passes semantic invariants against the real authority", () => {
    const authorityInterfaces = [...interfaces, htmlDiv] as any[]
    const authority = {
      interfaceIds: new Set(authorityInterfaces.map((entry) => entry.id)),
      interfacePropNames: new Map(
        authorityInterfaces.map((entry) => [
          entry.id,
          new Set([
            ...entry.props.map((prop: any) => prop.name),
            ...(entry.events ?? []).map((event: any) => event.propName),
          ]),
        ])
      ),
      interfaceContracts: new Map(authorityInterfaces.map((entry) => [entry.id, entry])),
      tokenIds: new Set(tokenContract.tokens.map((token: any) => token.id)),
      derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule: any) => rule.id)),
      capabilityIds: new Set(["alert-dialog.context"]),
      sourceIdentity: {
        canonicalPath: family.source.canonicalPath,
        canonicalBlobSha: family.source.canonicalBlobSha,
      },
    }

    expect(validateComponentFamilyInvariants(family as any, authority as any)).toEqual([])
  })

  test("keeps official authoring guidance registered", () => {
    expect(knowledge.guidanceStatus).toMatchObject({
      whatItIs: "available",
      whenToUse: "available",
      howToUse: "available",
      options: "available",
    })
    expect(
      references.references.some((reference) => reference.id === "shadcn.alert-dialog.docs")
    ).toBe(true)
  })
})
