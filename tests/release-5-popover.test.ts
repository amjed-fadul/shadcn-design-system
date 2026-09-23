import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import { describe, expect, expectTypeOf, test } from "vitest"
import type * as React from "react"
import { PopoverTitle } from "../src/components/ui/popover"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import popover from "../contracts/components/families/popover.json"
import popoverRoot from "../contracts/components/interfaces/radix.popover.root.json"
import popoverTrigger from "../contracts/components/interfaces/radix.popover.trigger.json"
import popoverAnchor from "../contracts/components/interfaces/radix.popover.anchor.json"
import popoverPortal from "../contracts/components/interfaces/radix.popover.portal.json"
import popoverContent from "../contracts/components/interfaces/radix.popover.content.json"
import htmlDiv from "../contracts/components/interfaces/html.div.json"
import htmlP from "../contracts/components/interfaces/html.p.json"
import tokenContract from "../contracts/tokens/token-contract.json"
import knowledge from "../contracts/knowledge/components/popover.json"
import references from "../contracts/knowledge/references.json"
import {
  analyzeIntrinsicReactInterface,
  analyzePackageComponentInterface,
} from "./helpers/typescript-interface-analysis"
import { validateComponentFamilyInvariants } from "../src/contracts/components/invariants"
import {
  analyzeJsxRenderTree,
  extractFunctionPropDefaults,
  listModuleExports,
} from "./helpers/component-source-analysis"
import { analyzeComponentTokenDependencies } from "./helpers/component-token-analysis"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(repoRoot, "src/components/ui/popover.tsx")
const radixDeclarationPath = join(
  repoRoot,
  "node_modules/@radix-ui/react-popover/dist/index.d.ts"
)
const reactDeclarationPath = join(repoRoot, "node_modules/@types/react/index.d.ts")

const radixHash = createHash("sha256")
  .update(readFileSync(radixDeclarationPath))
  .digest("hex")
const reactHash = createHash("sha256")
  .update(readFileSync(reactDeclarationPath))
  .digest("hex")

const radixSource = (symbol: string) => ({
  declarationPath: radixDeclarationPath,
  symbol,
})

function expectedRadix(symbol: string, eventNames: string[] = []) {
  const full = analyzePackageComponentInterface(radixSource(symbol))
  const events = eventNames.length
    ? analyzePackageComponentInterface(radixSource(symbol), {
        props: [],
        events: eventNames,
      }).events
    : []

  return {
    props: full.props.filter((prop) => !eventNames.includes(prop.name)),
    events,
    conditionalApi: full.conditionalApi,
  }
}

function schemaValid(schema: object, value: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value)
}

function normalizeMachineSpecificTypePaths<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, current) => {
    if (typeof current !== "string") return current
    return current.replace(
      /import\("[^"]*\/node_modules\/@radix-ui\/rect\/dist\/index"\)/g,
      'import("@radix-ui/rect/dist/index")'
    )
  }) as T
}

describe("release.5 Popover", () => {
  test(
    "keeps the family and inherited interfaces schema-valid and source-pinned",
    () => {
      expect(schemaValid(familySchema, popover)).toBe(true)
      for (const contract of [
        popoverRoot,
        popoverTrigger,
        popoverAnchor,
        popoverPortal,
        popoverContent,
        htmlDiv,
      ]) {
        expect(schemaValid(interfaceSchema, contract)).toBe(true)
      }

      const blobSha = execFileSync("git", ["hash-object", "src/components/ui/popover.tsx"], {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim()

      expect(popover.source.canonicalBlobSha).toBe(blobSha)
      expect(popover.source.canonicalBlobSha).toBe(
        "1131a8154243aecccf705c4140596b32e3f2ac41"
      )
      expect(popover.source.upstreamPath).toBe(
        "apps/v4/registry/bases/radix/ui/popover.tsx"
      )
      expect(popoverRoot.source.declarationSha256).toBe(radixHash)
      expect(htmlDiv.source.declarationSha256).toBe(reactHash)
    },
    60_000
  )

  test(
    "reconciles every new Radix interface against the pinned declaration",
    () => {
      const cases = [
        [popoverRoot, "Root", ["onOpenChange"]],
        [popoverTrigger, "Trigger", []],
        [popoverAnchor, "Anchor", []],
        [popoverPortal, "Portal", []],
        [popoverContent, "Content", []],
      ] as const

      for (const [contract, symbol, events] of cases) {
        const expected = expectedRadix(symbol, [...events])
        expect(normalizeMachineSpecificTypePaths(contract.props)).toEqual(
          normalizeMachineSpecificTypePaths(expected.props)
        )
        expect(contract.events).toEqual(expected.events)
        expect(contract.conditionalApi).toEqual(expected.conditionalApi)
        expect(contract.unresolved).toEqual([])
      }

      expect(htmlDiv.props.map(({ name, required, typeText }) => ({ name, required, typeText })))
        .toEqual(analyzeIntrinsicReactInterface("div"))
      expect(htmlDiv.unresolved).toEqual([])
    },
    60_000
  )


  test("passes semantic family invariants against the real interface and token authority", () => {
    const interfaces = [
      popoverRoot,
      popoverTrigger,
      popoverAnchor,
      popoverPortal,
      popoverContent,
      htmlDiv,
      htmlP,
    ] as any[]

    const authority = {
      interfaceIds: new Set(interfaces.map((entry) => entry.id)),
      interfacePropNames: new Map(
        interfaces.map((entry) => [
          entry.id,
          new Set([
            ...entry.props.map((prop: any) => prop.name),
            ...(entry.events ?? []).map((event: any) => event.propName),
          ]),
        ])
      ),
      interfaceContracts: new Map(interfaces.map((entry) => [entry.id, entry])),
      tokenIds: new Set(tokenContract.tokens.map((token: any) => token.id)),
      derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule: any) => rule.id)),
      capabilityIds: new Set(["popover.context"]),
      sourceIdentity: {
        canonicalPath: popover.source.canonicalPath,
        canonicalBlobSha: popover.source.canonicalBlobSha,
      },
    }

    expect(validateComponentFamilyInvariants(popover as any, authority as any)).toEqual([])
  })

  test("keeps the seven public exports and source rendering facts exact", () => {
    expect(listModuleExports(sourcePath).map((entry) => entry.name)).toEqual([
      "Popover",
      "PopoverAnchor",
      "PopoverContent",
      "PopoverDescription",
      "PopoverHeader",
      "PopoverTitle",
      "PopoverTrigger",
    ])

    const content = analyzeJsxRenderTree(sourcePath, "PopoverContent")
    if (!content.root) throw new Error("PopoverContent render root is unresolved.")
    expect(content.root.tag).toBe("PopoverPrimitive.Portal")
    expect(content.root.portal).toBe(true)
    expect(content.root.children[0]?.tag).toBe("PopoverPrimitive.Content")
    expect(content.root.children[0]?.receivesPublicProps).toBe(true)

    const title = analyzeJsxRenderTree(sourcePath, "PopoverTitle")
    if (!title.root) throw new Error("PopoverTitle render root is unresolved.")
    expect(title.root.tag).toBe("div")
    expect(title.root.receivesPublicProps).toBe(true)

    const titleComponent = popover.exports.find((entry) => entry.name === "PopoverTitle")?.component
    expect(titleComponent?.inherits).toEqual(["html.div"])
    expect(titleComponent?.rendering.publicPropsTargetNodeId).toBe("host")
    expect(titleComponent?.rendering.nodes.find((node) => node.id === "host")).toMatchObject({
      host: { kind: "intrinsic", tag: "div" },
      receivesPublicProps: true,
    })
    expectTypeOf<React.ComponentProps<typeof PopoverTitle>>()
      .toEqualTypeOf<React.ComponentProps<"div">>()

    expect(Object.fromEntries(extractFunctionPropDefaults(sourcePath, "PopoverContent"))).toEqual({
      align: "center",
      sideOffset: 4,
    })
  })

  test("records inherited slot behavior and Popover context composition", () => {
    const root = popover.exports.find((entry) => entry.name === "Popover")?.component
    expect(root?.composition).toEqual({
      requires: [],
      provides: ["popover.context"],
      hardConstraints: [],
    })

    for (const name of ["PopoverTrigger", "PopoverAnchor", "PopoverContent"]) {
      const component = popover.exports.find((entry) => entry.name === name)?.component
      expect(component?.composition).toEqual({
        requires: ["popover.context"],
        provides: [],
        hardConstraints: [],
      })
      expect(component?.slots).toEqual([
        expect.objectContaining({
          propName: "asChild",
          default: false,
          replacesHost: true,
          forwardsProps: true,
        }),
      ])
    }
  })

  test("keeps generated Popover interface artifacts path-portable", () => {
    for (const contract of [
      popoverRoot,
      popoverTrigger,
      popoverAnchor,
      popoverPortal,
      popoverContent,
      htmlDiv,
    ]) {
      const serialized = JSON.stringify(contract)
      expect(serialized).not.toContain("/home/runner/")
      expect(serialized).not.toContain("/Users/")
    }
  })

  test("keeps Popover token dependencies complete and guidance registered", () => {
    const sourceTokens = analyzeComponentTokenDependencies(sourcePath).map((entry) =>
      JSON.stringify(entry)
    )
    const contractTokens = popover.exports.flatMap((entry) =>
      entry.component ? entry.component.tokenDependencies : []
    ).map((entry) => JSON.stringify({
      ...entry,
      evidenceRefs: entry.evidenceRefs.filter((ref) => ref !== "tokens"),
    }))

    expect(contractTokens.sort()).toEqual(sourceTokens.sort())

    const root = popover.exports.find((entry) => entry.name === "Popover")
    expect(root?.component?.stateChannels).toEqual([
      {
        name: "open",
        controlledProp: "open",
        defaultProp: "defaultOpen",
        changeEventProp: "onOpenChange",
        evidenceRefs: ["declaration"],
      },
    ])

    expect(knowledge.guidanceStatus).toMatchObject({
      whatItIs: "available",
      whenToUse: "available",
      howToUse: "available",
      options: "available",
    })
    expect(references.references.some((reference) => reference.id === "shadcn.popover.docs"))
      .toBe(true)
  })
})
