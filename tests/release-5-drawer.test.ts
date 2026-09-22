import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import family from "../contracts/components/families/drawer.json"
import vaulRoot from "../contracts/components/interfaces/vaul.drawer.root.json"
import vaulOverlay from "../contracts/components/interfaces/vaul.drawer.overlay.json"
import vaulContent from "../contracts/components/interfaces/vaul.drawer.content.json"
import vaulPortal from "../contracts/components/interfaces/vaul.drawer.portal.json"
import radixTrigger from "../contracts/components/interfaces/radix.dialog.trigger.json"
import radixClose from "../contracts/components/interfaces/radix.dialog.close.json"
import radixOverlay from "../contracts/components/interfaces/radix.dialog.overlay.json"
import radixContent from "../contracts/components/interfaces/radix.dialog.content.json"
import radixPortal from "../contracts/components/interfaces/radix.dialog.portal.json"
import radixTitle from "../contracts/components/interfaces/radix.dialog.title.json"
import radixDescription from "../contracts/components/interfaces/radix.dialog.description.json"
import htmlDiv from "../contracts/components/interfaces/html.div.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import knowledge from "../contracts/knowledge/components/drawer.json"
import references from "../contracts/knowledge/references.json"
import packageJson from "../package.json"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import { validateComponentFamilyInvariants, validateInheritedInterfaceInvariants } from "../src/contracts/components/invariants"
import {
  analyzeJsxRenderTree,
  compareJsxRenderTree,
  listModuleExports,
} from "./helpers/component-source-analysis"
import { canonicalRenderSourceAnalysisConventions } from "../src/contracts/components/canonical-render-source-conventions"
import { analyzeComponentTokenDependenciesForExport } from "./helpers/component-token-analysis"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(repoRoot, "src/components/ui/drawer.tsx")
const vaulDeclarationPath = join(repoRoot, "node_modules/vaul/dist/index.d.ts")

const vaulInterfaces = [vaulRoot, vaulOverlay, vaulContent, vaulPortal] as any[]
const allInterfaces = [
  ...vaulInterfaces,
  radixTrigger,
  radixClose,
  radixOverlay,
  radixContent,
  radixPortal,
  radixTitle,
  radixDescription,
  htmlDiv,
] as any[]

function schemaValid(schema: object, value: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value)
}

function expectedVaulInterface(contract: any) {
  if (contract.source.symbol !== "Root") {
    return analyzePackageComponentInterface({
      declarationPath: vaulDeclarationPath,
      symbol: contract.source.symbol,
    })
  }

  const props = analyzePackageComponentInterface(
    { declarationPath: vaulDeclarationPath, symbol: "Root" },
    {
      props: contract.props.map((prop: any) => prop.name),
      events: [],
    }
  )
  const events = analyzePackageComponentInterface(
    { declarationPath: vaulDeclarationPath, symbol: "Root" },
    { props: [], events: ["onOpenChange"] }
  ).events

  return {
    props: props.props,
    events,
    conditionalApi: props.conditionalApi,
  }
}

describe("release.5 Drawer", () => {
  test(
    "pins Vaul 1.1.2 and exact generated interface evidence",
    () => {
      expect(packageJson.dependencies.vaul).toBe("1.1.2")
      expect(schemaValid(familySchema, family)).toBe(true)

      const declarationHash = createHash("sha256")
        .update(readFileSync(vaulDeclarationPath))
        .digest("hex")

      for (const contract of vaulInterfaces) {
        expect(schemaValid(interfaceSchema, contract)).toBe(true)
        expect(contract.source.package).toBe("vaul")
        expect(contract.source.version).toBe("1.1.2")
        expect(contract.source.declarationSha256).toBe(declarationHash)

        const analyzed = expectedVaulInterface(contract)

        expect({
          props: contract.props,
          events: contract.events ?? [],
          conditionalApi: contract.conditionalApi ?? [],
        }).toEqual(analyzed)
      }

      expect(vaulRoot.unresolved).toEqual([])
      expect(vaulOverlay.unresolved).toEqual([])
      expect(vaulContent.unresolved).toEqual([])
      expect(vaulPortal.unresolved).toEqual([])
    },
    60_000
  )

  test("models the declaration's fadeFromIndex presence union without inventing direction as a discriminator", () => {
    expect(vaulRoot.conditionalApi).toEqual([
      {
        when: { propName: "fadeFromIndex", presence: "present" },
        propRefinements: [
          { propName: "fadeFromIndex", availability: "available", required: true, type: { kind: "number" }, evidenceRefs: ["declaration"] },
          { propName: "snapPoints", availability: "available", required: true, type: { kind: "array", item: { kind: "union", members: [{ kind: "string" }, { kind: "number" }] } }, evidenceRefs: ["declaration"] },
        ],
        eventRefinements: [],
        stateChannels: [],
        evidenceRefs: ["declaration"],
      },
      {
        when: { propName: "fadeFromIndex", presence: "absent" },
        propRefinements: [
          { propName: "fadeFromIndex", availability: "unavailable", evidenceRefs: ["declaration"] },
        ],
        eventRefinements: [],
        stateChannels: [],
        evidenceRefs: ["declaration"],
      },
    ])
    expect(vaulRoot.props.find((prop) => prop.name === "direction")?.type).toEqual({
      kind: "enum",
      values: ["top", "bottom", "left", "right"],
    })
    expect(vaulRoot.props.find((prop) => prop.name === "snapPoints")?.type).toEqual({
      kind: "array",
      item: {
        kind: "union",
        members: [{ kind: "string" }, { kind: "number" }],
      },
    })

    const missingBranch = structuredClone(vaulRoot) as any
    missingBranch.conditionalApi.pop()
    expect(validateInheritedInterfaceInvariants(missingBranch)).toContain(
      "Inherited interface vaul.drawer.root presence discriminator fadeFromIndex must define exactly one present and one absent case.",
    )

    const forgedBranch = structuredClone(vaulRoot) as any
    forgedBranch.conditionalApi[0].propRefinements.find((prop: any) => prop.propName === "snapPoints").required = false
    expect({ props: forgedBranch.props, events: forgedBranch.events ?? [], conditionalApi: forgedBranch.conditionalApi }).not.toEqual(expectedVaulInterface(vaulRoot))
  })

  test("keeps source and current shadcn upstream identity exact", () => {
    const blobSha = execFileSync("git", ["hash-object", "src/components/ui/drawer.tsx"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim()

    expect(family.source.canonicalBlobSha).toBe(blobSha)
    expect(family.source.canonicalBlobSha).toBe(
      "629fb9a98d658839e30d6cb186c5e9c307f65430"
    )
    expect(family.source.upstreamPath).toBe(
      "apps/v4/registry/new-york-v4/ui/drawer.tsx"
    )
    expect(family.source.upstreamBlobSha).toBe(
      "4e416683964bdef2c52c5dcd597ab0cb8f4c015b"
    )
  })

  test("keeps all ten public exports and source render trees exact", () => {
    expect(listModuleExports(sourcePath).map((entry) => entry.name)).toEqual([
      "Drawer",
      "DrawerClose",
      "DrawerContent",
      "DrawerDescription",
      "DrawerFooter",
      "DrawerHeader",
      "DrawerOverlay",
      "DrawerPortal",
      "DrawerTitle",
      "DrawerTrigger",
    ])

    for (const entry of family.exports) {
      if (!entry.component) continue
      expect(
        compareJsxRenderTree(
          entry.component.rendering as any,
          analyzeJsxRenderTree(sourcePath, entry.name) as any,
          canonicalRenderSourceAnalysisConventions
        ),
        entry.name
      ).toEqual([])
    }
  })

  test("keeps Drawer token dependencies complete per export", () => {
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

  test("models Drawer open state, direction API, context, slots, and portal structure", () => {
    const root = family.exports.find((entry) => entry.name === "Drawer")!.component!
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
      provides: ["drawer.context"],
      hardConstraints: [],
    })

    for (const name of [
      "DrawerTrigger",
      "DrawerClose",
      "DrawerOverlay",
      "DrawerContent",
      "DrawerTitle",
      "DrawerDescription",
    ]) {
      const component = family.exports.find((entry) => entry.name === name)!.component!
      expect(component.composition.requires).toContain("drawer.context")
      expect(component.slots).toEqual([
        expect.objectContaining({
          propName: "asChild",
          default: false,
          replacesHost: true,
          forwardsProps: true,
        }),
      ])
    }

    const content = family.exports.find((entry) => entry.name === "DrawerContent")!.component!
    const rendering = content.rendering as any
    expect(rendering.portalBoundaries).toEqual([
      { nodeId: "portal", evidenceRefs: ["source"] },
    ])
    expect(rendering.nodes.find((node: any) => node.id === "portal")?.dataAttributes).toEqual([
      {
        name: "data-slot",
        source: "literal",
        value: "drawer-portal",
        evidenceRefs: ["source"],
      },
    ])
    expect(rendering.nodes.find((node: any) => node.id === "handle")?.host)
      .toEqual({ kind: "intrinsic", tag: "div" })
  })

  test("passes semantic invariants against the mixed Vaul and Radix authority", () => {
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
      capabilityIds: new Set(["drawer.context"]),
      sourceIdentity: {
        canonicalPath: family.source.canonicalPath,
        canonicalBlobSha: family.source.canonicalBlobSha,
      },
    }

    expect(validateComponentFamilyInvariants(family as any, authority as any)).toEqual([])
  })

  test("keeps official Drawer knowledge with no unresolved snap-point boundary", () => {
    expect(knowledge.guidanceStatus).toMatchObject({
      whatItIs: "available",
      whenToUse: "available",
      howToUse: "available",
      options: "available",
    })
    expect(references.references.some((reference) => reference.id === "shadcn.drawer.docs"))
      .toBe(true)
    expect(family.unresolved).toEqual([])
  })
})
