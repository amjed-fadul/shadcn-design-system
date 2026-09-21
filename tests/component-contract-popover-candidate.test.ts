import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import tokenContract from "../contracts/tokens/token-contract.json"
import {
  validateComponentFamilyInvariants,
  validateInheritedInterfaceInvariants,
} from "../src/contracts/components/invariants"
import type {
  ComponentFamilyContract,
  InheritedInterfaceContract,
} from "../src/contracts/components/types"
import { createKnowledgeLoader } from "../src/contracts/knowledge"
import * as sourceAnalysis from "./helpers/component-source-analysis"
import * as tokenAnalysis from "./helpers/component-token-analysis"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(root, "src/components/ui/popover.tsx")
const familyPath = join(root, "contracts/components/families/popover.json")
const family = JSON.parse(readFileSync(familyPath, "utf8")) as ComponentFamilyContract

const interfaceDir = join(root, "contracts/components/interfaces")
const interfaces = readdirSync(interfaceDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(interfaceDir, file), "utf8")) as InheritedInterfaceContract)

const authority = {
  interfaceIds: new Set(interfaces.map((item) => item.id)),
  interfacePropNames: new Map(interfaces.map((item) => [item.id, new Set(item.props.map((prop) => prop.name))])),
  interfaceContracts: new Map(interfaces.map((item) => [item.id, item])),
  tokenIds: new Set(tokenContract.tokens.map((token) => token.id)),
  derivedTokenRuleIds: new Set(tokenContract.derivedRules.map((rule) => rule.id)),
  capabilityIds: new Set(["popover.context"]),
}

const popoverInterfaceIds = [
  "radix.popover.root",
  "radix.popover.trigger",
  "radix.popover.anchor",
  "radix.popover.portal",
  "radix.popover.content",
  "html.h2",
  "html.p",
]

describe("release.5 Popover candidate", () => {
  test("matches the canonical source identity and exact public exports", () => {
    expect(family.source.canonicalPath).toBe("src/components/ui/popover.tsx")
    expect(family.source.canonicalBlobSha).toBe(sourceAnalysis.readCanonicalSourceBlobSha(sourcePath))

    const expected = sourceAnalysis
      .listModuleExports(sourcePath)
      .map(({ name, declarationKind }) => [
        name,
        declarationKind === "FunctionDeclaration" ? "component" : "helper",
        declarationKind === "FunctionDeclaration",
      ])
      .sort()

    expect(
      family.exports
        .map(({ name, kind, authorableJsx }) => [name, kind, authorableJsx])
        .sort()
    ).toEqual(expected)
  })

  test("passes component and inherited-interface invariants", () => {
    expect(validateComponentFamilyInvariants(family, authority)).toEqual([])

    for (const id of popoverInterfaceIds) {
      const contract = interfaces.find((item) => item.id === id)
      expect(contract, id).toBeDefined()
      expect(validateInheritedInterfaceInvariants(contract!)).toEqual([])
    }
  })

  test("reconciles every export's render tree and approved token dependencies", () => {
    for (const entry of family.exports) {
      expect(entry.component, entry.name).toBeDefined()
      const component = entry.component!

      expect(
        sourceAnalysis.compareJsxRenderTree(
          component.rendering,
          sourceAnalysis.analyzeJsxRenderTree(sourcePath, entry.name)
        )
      ).toEqual([])

      expect(
        tokenAnalysis.compareComponentTokenDependenciesForExport(
          sourcePath,
          entry.name,
          component.tokenDependencies
        )
      ).toEqual([])

      expect(sourceAnalysis.analyzeJsxRenderTree(sourcePath, entry.name).unresolved).toEqual([])
      expect(tokenAnalysis.analyzeComponentTokenSourceForExport(sourcePath, entry.name).unresolved).toEqual([])
    }
  })

  test("records controlled open state, source defaults, slots, and context composition", () => {
    const byName = new Map(family.exports.map((entry) => [entry.name, entry.component!]))
    expect(byName.get("Popover")?.stateChannels).toEqual([
      {
        name: "open",
        controlledProp: "open",
        defaultProp: "defaultOpen",
        changeEventProp: "onOpenChange",
        evidenceRefs: ["declaration"],
      },
    ])
    expect(byName.get("Popover")?.composition).toEqual({
      requires: [],
      provides: ["popover.context"],
      hardConstraints: [],
    })
    expect(byName.get("PopoverContent")?.inheritedPropDefaults).toEqual([
      { propName: "align", value: "center", evidenceRefs: ["source"] },
      { propName: "sideOffset", value: 4, evidenceRefs: ["source"] },
    ])

    for (const name of ["PopoverTrigger", "PopoverAnchor", "PopoverContent"]) {
      expect(byName.get(name)?.slots).toEqual([
        expect.objectContaining({
          propName: "asChild",
          default: false,
          replacesHost: true,
          forwardsProps: true,
        }),
      ])
      expect(byName.get(name)?.composition.requires).toEqual(["popover.context"])
    }
  })

  test("keeps generated interface artifacts path-portable", () => {
    for (const id of popoverInterfaceIds) {
      const text = readFileSync(join(interfaceDir, id + ".json"), "utf8")
      expect(text).not.toContain("/home/runner/")
      expect(text).not.toContain("/Users/")
    }
  })

  test("loads Popover knowledge against the registered official reference", () => {
    const knowledge = JSON.parse(
      readFileSync(join(root, "contracts/knowledge/components/popover.json"), "utf8")
    )
    const references = JSON.parse(
      readFileSync(join(root, "contracts/knowledge/references.json"), "utf8")
    )

    const load = createKnowledgeLoader({
      source: {
        readJson(path) {
          if (path === "contracts/knowledge/knowledge-set.json") {
            return {
              schemaVersion: 1,
              id: "release-5-popover-knowledge",
              referenceFile: "contracts/knowledge/references.json",
              componentFiles: ["contracts/knowledge/components/popover.json"],
              patternFiles: [],
            }
          }
          if (path === "contracts/knowledge/references.json") return structuredClone(references)
          if (path === "contracts/knowledge/components/popover.json") return structuredClone(knowledge)
          throw new Error("Unexpected knowledge path: " + path)
        },
      },
    })

    const loaded = load()
    expect(loaded.components).toHaveLength(1)
    expect(loaded.components[0].subject).toEqual({ kind: "component", id: "popover" })
    expect(references.references).toContainEqual(
      expect.objectContaining({
        id: "shadcn.popover.docs",
        locator: "https://ui.shadcn.com/docs/components/radix/popover",
      })
    )
  })
})
