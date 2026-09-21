import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import Ajv2020 from "ajv/dist/2020"
import { describe, expect, test } from "vitest"

import familySchema from "../contracts/components/component-family.schema.json"
import interfaceSchema from "../contracts/components/inherited-interface.schema.json"
import knowledgeSchema from "../contracts/knowledge/component-knowledge.schema.json"
import { analyzePackageComponentInterface } from "./helpers/typescript-interface-analysis"
import {
  analyzeJsxRenderTree,
  compareJsxRenderTree,
  listModuleExports,
} from "./helpers/component-source-analysis"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = join(repoRoot, "src/components/ui/collapsible.tsx")
const declarationPath = join(
  repoRoot,
  "node_modules/@radix-ui/react-collapsible/dist/index.d.ts"
)
const artifactPaths = [
  sourcePath,
  join(repoRoot, "src/components/ui/collapsible.stories.tsx"),
  join(repoRoot, "contracts/components/families/collapsible.json"),
  join(repoRoot, "contracts/components/interfaces/radix.collapsible.root.json"),
  join(repoRoot, "contracts/components/interfaces/radix.collapsible.trigger.json"),
  join(repoRoot, "contracts/components/interfaces/radix.collapsible.content.json"),
  join(repoRoot, "contracts/knowledge/components/collapsible.json"),
] as const
const artifactsPresent = artifactPaths.every(existsSync)
const testWithArtifacts = artifactsPresent ? test : test.skip

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as any
}

function schemaValid(schema: object, value: unknown) {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value)
}

function expectedRadix(symbol: string, eventNames: string[] = []) {
  const full = analyzePackageComponentInterface({ declarationPath, symbol })
  const events = eventNames.length
    ? analyzePackageComponentInterface(
        { declarationPath, symbol },
        { props: [], events: eventNames }
      ).events
    : []

  return {
    props: full.props.filter((prop) => !eventNames.includes(prop.name)),
    events,
    conditionalApi: full.conditionalApi,
  }
}

describe("release.5 Collapsible", () => {
  test("ships the source, story, family, interface, and knowledge artifacts", () => {
    expect(artifactPaths.filter((path) => !existsSync(path))).toEqual([])
  })

  testWithArtifacts("exports the three public Collapsible components and matches rendering contracts", () => {
    const family = readJson(join(repoRoot, "contracts/components/families/collapsible.json"))

    expect(listModuleExports(sourcePath).map((entry) => entry.name)).toEqual([
      "Collapsible",
      "CollapsibleContent",
      "CollapsibleTrigger",
    ])
    expect(family.exports.map((entry: any) => entry.name)).toEqual([
      "Collapsible",
      "CollapsibleTrigger",
      "CollapsibleContent",
    ])

    for (const entry of family.exports) {
      expect(
        compareJsxRenderTree(
          entry.component.rendering,
          analyzeJsxRenderTree(sourcePath, entry.name)
        )
      ).toEqual([])
    }
  })

  testWithArtifacts("keeps the family and Radix interfaces schema-valid and declaration-reconciled", () => {
    const family = readJson(join(repoRoot, "contracts/components/families/collapsible.json"))
    const interfaces = [
      readJson(join(repoRoot, "contracts/components/interfaces/radix.collapsible.root.json")),
      readJson(join(repoRoot, "contracts/components/interfaces/radix.collapsible.trigger.json")),
      readJson(join(repoRoot, "contracts/components/interfaces/radix.collapsible.content.json")),
    ]

    expect(schemaValid(familySchema, family)).toBe(true)
    for (const contract of interfaces) {
      expect(schemaValid(interfaceSchema, contract)).toBe(true)
      const expected = expectedRadix(
        contract.source.symbol,
        contract.source.symbol === "Root" ? ["onOpenChange"] : []
      )

      expect(contract.props).toEqual(expected.props)
      expect(contract.events ?? []).toEqual(expected.events)
      expect(contract.conditionalApi ?? []).toEqual(expected.conditionalApi ?? [])
      expect(contract.unresolved).toEqual([])
      expect(contract.source.declarationSha256).toBe(
        createHash("sha256").update(readFileSync(declarationPath)).digest("hex")
      )
    }
  }, 60_000)

  testWithArtifacts("keeps Collapsible authoring guidance schema-valid and grounded in its official reference", () => {
    const knowledge = readJson(join(repoRoot, "contracts/knowledge/components/collapsible.json"))
    const references = readJson(join(repoRoot, "contracts/knowledge/references.json"))

    expect(schemaValid(knowledgeSchema, knowledge)).toBe(true)
    expect(knowledge.subject).toEqual({ kind: "component", id: "collapsible" })
    expect(knowledge.guidanceStatus).toMatchObject({
      whatItIs: "available",
      whenToUse: "available",
      howToUse: "available",
      options: "available",
    })
    const referenceIds = new Set(
      references.references.map((reference: { id: string }) => reference.id)
    )
    for (const claim of [
      knowledge.whatItIs,
      ...(knowledge.whenToUse ?? []),
      ...(knowledge.howToUse ?? []),
      ...(knowledge.options ?? []),
    ]) {
      expect(claim.basis).toEqual({
        kind: "source-derived",
        referenceIds: ["shadcn.collapsible.docs"],
      })
      for (const referenceId of claim.basis.referenceIds) {
        expect(referenceIds.has(referenceId)).toBe(true)
      }
    }
  })
})
