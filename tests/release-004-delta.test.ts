import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import { loadExecutableRelease } from "../src/validator/release"

const release003Path = "provenance/releases/shadcn-radix-release-003.json"
const release004Path = "provenance/releases/shadcn-radix-release-004.json"

describe("release004 Checkbox id delta", () => {
  test("preserves release003 and adds only the factual Checkbox id prop", () => {
    expect(readFileSync(release003Path, "utf8")).toBe(execFileSync("git", ["show", `0cc79521c769fc314454c8c8f5db5b172b4926c7:${release003Path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }))

    const previous = JSON.parse(readFileSync(release003Path, "utf8"))
    const current = JSON.parse(readFileSync(release004Path, "utf8"))
    expect(loadExecutableRelease(current, { expectedProjection: current.projection, expectedReleaseId: "shadcn-radix-release-004", requirePackageIdentity: true })).toEqual(current)
    expect(current.packageIdentity).toEqual({ ...previous.packageIdentity, version: "0.0.0-release.4" })

    const previousCheckbox = previous.projection.exports["checkbox\u0000Checkbox"].component
    const currentCheckbox = current.projection.exports["checkbox\u0000Checkbox"].component
    expect(previousCheckbox.props.map((prop: { name: string }) => prop.name)).not.toContain("id")
    expect(currentCheckbox.props).toEqual([...previousCheckbox.props, {
      name: "id",
      availability: "available",
      required: false,
      type: { kind: "string" },
      origin: "inherited",
    }])
  })
})
