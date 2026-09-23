import { describe, expect, test } from "vitest"
import { getExecutableRelease, validateAuthoredUiAgainstRelease } from "../src/validator/canonical-release"
import type { AuthoredValue } from "../src/validator/types"

describe("Release 005 overlay portal containers", () => {
  for (const [familyId, exportName, parent] of [
    ["popover", "PopoverContent", "Popover"],
    ["alert-dialog", "AlertDialogContent", "AlertDialog"],
  ]) {
    test(`${exportName} projects the primitive Portal container type without widening authorable JSX`, () => {
      const entry = getExecutableRelease().projection.exports[`${familyId}\0${exportName}`]
      const component = entry.component!
      expect(entry.authorableJsx).toBe(true)
      expect(component.props.find((prop) => prop.name === "portalContainer")).toMatchObject({
        availability: "available",
        required: false,
        type: {
          kind: "typescript",
          typeText: `ComponentProps<typeof ${familyId === "popover" ? "PopoverPrimitive" : "AlertDialogPrimitive"}.Portal>["container"]`,
        },
      })
    })

    for (const value of ["#page", null, {}, [], true, 1]) {
      test(`${exportName} keeps authored literal portalContainer ${JSON.stringify(value)} unresolved`, () => {
        const result = validateAuthoredUiAgainstRelease({ root: {
          kind: "component", id: "root", familyId, exportName: parent, props: {}, location: { path: "root" },
          children: [{ kind: "component", id: "content", familyId, exportName, props: { portalContainer: { kind: "literal", value } as AuthoredValue }, children: [], location: { path: "root.content" } }],
        } })
        expect(result.ok).toBe(false)
        expect(result.errors.some((error) => error.code === "UNRESOLVED_FACT" && error.target.propName === "portalContainer")).toBe(true)
      })
    }
  }
})
