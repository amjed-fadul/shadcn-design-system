import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

import {
  createKnowledgeLoader,
  createKnowledgeQuery,
  getComponentKnowledge,
  getPatternKnowledge,
  listComponentKnowledge,
  listPatternKnowledge,
  loadKnowledge,
  type KnowledgeArtifactSource,
  type KnowledgeReferenceSet,
  type KnowledgeSet,
} from "../src/contracts/knowledge"
import type { KnowledgeArtifact } from "../src/contracts/knowledge/types"

const root = fileURLToPath(new URL("../", import.meta.url))
const baseline = "ba7578c7bbc04bf7a9449462707d98657f708cbf"

const referenceSet: KnowledgeReferenceSet = {
  schemaVersion: 1,
  references: [
    {
      id: "fixture.reference",
      kind: "official-standard",
      title: "Fixture reference",
      locator: "https://example.com/fixture",
      locatorHint: "Fixture section",
      accessedOn: "2026-09-02",
    },
  ],
}

const minimalSet: KnowledgeSet = {
  schemaVersion: 1,
  id: "fixture-knowledge",
  referenceFile: "contracts/knowledge/references.json",
  componentFiles: ["contracts/knowledge/components/button.json"],
  patternFiles: [],
}

const minimalComponentKnowledge: KnowledgeArtifact = {
  schemaVersion: 1,
  id: "button-knowledge",
  subject: { kind: "component", id: "button" },
  guidanceStatus: { whenNotToUse: "unresolved" },
}

function sourceFor(input: {
  set?: KnowledgeSet
  references?: KnowledgeReferenceSet
  components?: unknown[]
  patterns?: unknown[]
}): KnowledgeArtifactSource {
  const set = input.set ?? minimalSet
  const artifacts = new Map<string, unknown>([
    ["contracts/knowledge/knowledge-set.json", set],
    [set.referenceFile, input.references ?? referenceSet],
  ])
  for (const [index, path] of set.componentFiles.entries()) {
    artifacts.set(path, (input.components ?? [minimalComponentKnowledge])[index])
  }
  for (const [index, path] of set.patternFiles.entries()) {
    artifacts.set(path, (input.patterns ?? [])[index])
  }
  return {
    readJson(path) {
      if (!artifacts.has(path)) throw new Error("fixture artifact missing: " + path)
      return structuredClone(artifacts.get(path))
    },
  }
}

function loadFixture(input: {
  set?: KnowledgeSet
  references?: KnowledgeReferenceSet
  components?: unknown[]
  patterns?: unknown[]
}) {
  return createKnowledgeLoader({ source: sourceFor(input) })()
}

describe("knowledge contract boundary", () => {
  test("loads knowledge without requiring Phase 3 artifacts", () => {
    const loaded = loadFixture({})

    expect(loaded.components).toHaveLength(1)
    expect(loaded.components[0].subject).toEqual({ kind: "component", id: "button" })
  })

  test("allows missing topics and represents unresolved separately from claims", () => {
    const loaded = loadFixture({})
    const button = loaded.components[0]

    expect(button.whenNotToUse).toBeUndefined()
    expect(button.guidanceStatus.whenNotToUse).toBe("unresolved")
  })

  test("accepts a source-derived claim with multiple independently registered references", () => {
    const references: KnowledgeReferenceSet = {
      schemaVersion: 1,
      references: [
        ...referenceSet.references,
        {
          id: "fixture.reference.two",
          kind: "official-documentation",
          title: "Second fixture reference",
          locator: "https://example.com/fixture-two",
          locatorHint: "Another section",
          accessedOn: "2026-09-02",
        },
      ],
    }
    const component = {
      ...minimalComponentKnowledge,
      guidanceStatus: { ...minimalComponentKnowledge.guidanceStatus, whatItIs: "available" as const },
      whatItIs: {
        statement: "A fixture component.",
        basis: { kind: "source-derived", referenceIds: ["fixture.reference", "fixture.reference.two"] },
      },
    }

    const loaded = loadFixture({ references, components: [component] })

    expect(loaded.components[0].whatItIs?.basis).toEqual({
      kind: "source-derived",
      referenceIds: ["fixture.reference", "fixture.reference.two"],
    })
  })

  test("accepts a DS-owner-authored claim only with author metadata", () => {
    const component = {
      ...minimalComponentKnowledge,
      guidanceStatus: { ...minimalComponentKnowledge.guidanceStatus, writing: "available" as const },
      writing: [{
        statement: "Use the product voice guide.",
        basis: { kind: "ds-owner-authored", authoredBy: "adc-design-system", revision: "1", date: "2026-09-02" },
      }],
    }

    expect(loadFixture({ components: [component] }).components[0].writing).toHaveLength(1)
    expect(() => loadFixture({
      components: [{
        ...minimalComponentKnowledge,
        guidanceStatus: { ...minimalComponentKnowledge.guidanceStatus, writing: "available" as const },
        writing: [{ statement: "Incomplete author record.", basis: { kind: "ds-owner-authored", authoredBy: "adc-design-system", revision: "1" } }],
      }],
    })).toThrow("KNOWLEDGE_SCHEMA_INVALID")
  })

  test("does not allow an unresolved topic to carry a claim", () => {
    expect(() => loadFixture({
      components: [{
        ...minimalComponentKnowledge,
        whatItIs: {
          statement: "Unresolved advice.",
          basis: { kind: "source-derived", referenceIds: ["fixture.reference"] },
        },
        guidanceStatus: { ...minimalComponentKnowledge.guidanceStatus, whatItIs: "unresolved" as const },
      }],
    })).toThrow("KNOWLEDGE_ARTIFACT_INVALID")
  })

  test("rejects unknown source-derived reference IDs", () => {
    expect(() => loadFixture({
      components: [{
        ...minimalComponentKnowledge,
        guidanceStatus: { ...minimalComponentKnowledge.guidanceStatus, whatItIs: "available" as const },
        whatItIs: {
          statement: "Unresolvable evidence.",
          basis: { kind: "source-derived", referenceIds: ["missing-reference"] },
        },
      }],
    })).toThrow("KNOWLEDGE_REFERENCE_NOT_FOUND")
  })

  test.each(["props", "tokens", "composition", "hardConstraints", "requiredChildren"])("rejects API-shaped knowledge field: %s", (field) => {
    const component = { ...minimalComponentKnowledge, [field]: [] } as Record<string, unknown>

    expect(() => loadFixture({ components: [component] })).toThrow("KNOWLEDGE_SCHEMA_INVALID")
  })

  test("requires immutable identity for canonical source references", () => {
    const references: KnowledgeReferenceSet = {
      schemaVersion: 1,
      references: [{
        ...referenceSet.references[0],
        id: "fixture.canonical",
        kind: "canonical-source",
        sourceRevision: "ba7578c7bbc04bf7a9449462707d98657f708cbf",
      }],
    }

    expect(() => loadFixture({ references })).toThrow("KNOWLEDGE_ARTIFACT_INVALID")
  })

  test("queries component and pattern knowledge independently", () => {
    const set: KnowledgeSet = {
      ...minimalSet,
      componentFiles: ["contracts/knowledge/components/component-0.json"],
      patternFiles: ["contracts/knowledge/patterns/pattern-0.json"],
    }
    const pattern = {
      schemaVersion: 1,
      id: "dialog-with-actions-knowledge",
      subject: { kind: "pattern", id: "dialog-with-actions" },
      guidanceStatus: { purpose: "available" },
      purpose: {
        statement: "A dialog action flow.",
        basis: { kind: "source-derived", referenceIds: ["fixture.reference"] },
      },
      roles: [{ subject: { kind: "component", id: "dialog" }, role: "dialog surface" }],
    }
    const query = createKnowledgeQuery(createKnowledgeLoader({
      source: sourceFor({ set, components: [minimalComponentKnowledge], patterns: [pattern] }),
    }))

    expect(query.getComponentKnowledge("button").subject.kind).toBe("component")
    expect(query.getPatternKnowledge("dialog-with-actions").subject.kind).toBe("pattern")
    expect(query.listComponentKnowledge().map((entry) => entry.subject.id)).toEqual(["button"])
    expect(query.listPatternKnowledge().map((entry) => entry.subject.id)).toEqual(["dialog-with-actions"])
    expect(() => query.getComponentKnowledge("dialog-with-actions")).toThrow("COMPONENT_KNOWLEDGE_NOT_FOUND")
    expect(() => query.getPatternKnowledge("button")).toThrow("PATTERN_KNOWLEDGE_NOT_FOUND")
  })

  test("keeps the loaded knowledge immutable", () => {
    const loaded = loadFixture({})

    expect(Object.isFrozen(loaded)).toBe(true)
    expect(Object.isFrozen(loaded.components)).toBe(true)
    expect(Object.isFrozen(loaded.components[0])).toBe(true)
    expect(() => ((loaded.components[0] as unknown as { id: string }).id = "mutated")).toThrow(TypeError)
  })

  test("canonical Phase 3 paths remain unchanged from the approved main baseline", () => {
    expect(() => execFileSync("git", [
      "diff",
      "--exit-code",
      baseline,
      "--",
      "contracts/components",
      "src/contracts/components",
      "provenance/component-contract-source.json",
    ], { cwd: root, stdio: "pipe" })).not.toThrow()
  })
})

describe("canonical knowledge vertical slice", () => {
  test("contains exactly Button, Dialog, Select, and Dialog-with-actions knowledge", () => {
    const loaded = loadKnowledge()

    expect(loaded.components.map((entry) => entry.subject.id)).toEqual(["button", "dialog", "select"])
    expect(loaded.patterns.map((entry) => entry.subject.id)).toEqual(["dialog-with-actions"])
  })

  test("canonical query exposes components and patterns through separate entrypoints", () => {
    expect(listComponentKnowledge().map((entry) => entry.subject.id)).toEqual(["button", "dialog", "select"])
    expect(listPatternKnowledge().map((entry) => entry.subject.id)).toEqual(["dialog-with-actions"])
    expect(getComponentKnowledge("button").subject).toEqual({ kind: "component", id: "button" })
    expect(getPatternKnowledge("dialog-with-actions").subject).toEqual({ kind: "pattern", id: "dialog-with-actions" })
  })

  test("canonical claims use only registered source-derived evidence", () => {
    const loaded = loadKnowledge()
    const claims = JSON.stringify([...loaded.components, ...loaded.patterns])

    expect(claims).not.toContain("ds-owner-authored")
    for (const artifact of [...loaded.components, ...loaded.patterns]) {
      expect(artifact.guidanceStatus).toBeDefined()
    }
  })

  test("Select keyboard and typeahead guidance is grounded in Radix Select", () => {
    const select = getComponentKnowledge("select")
    const interactionClaim = select.howToUse?.find((claim) => claim.statement.includes("keyboard navigation"))

    expect(interactionClaim?.basis).toEqual({
      kind: "source-derived",
      referenceIds: ["radix.select.docs"],
    })
    expect(interactionClaim?.basis.kind).not.toBe("ds-owner-authored")
    expect(JSON.stringify(interactionClaim)).not.toContain("w3c.combobox.apg")
  })

  test("pattern roles remain descriptive and carry no legal composition fields", () => {
    const pattern = getPatternKnowledge("dialog-with-actions")

    expect(pattern.roles?.map((role) => role.role)).toEqual(["dialog surface", "trigger/action control", "footer action"])
    expect(pattern).not.toHaveProperty("composition")
    expect(pattern).not.toHaveProperty("hardConstraints")
    expect(pattern).not.toHaveProperty("requiredChildren")
  })
})
