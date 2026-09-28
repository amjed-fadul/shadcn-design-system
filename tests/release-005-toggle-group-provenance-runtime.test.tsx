// @vitest-environment jsdom

import { expect, test } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle-group"
import { render } from "./studio-test-utils"

function itemAttributes(container: HTMLElement) {
  const item = container.querySelector('[data-slot="toggle-group-item"]')
  expect(item).not.toBeNull()
  return item as HTMLElement
}

test("ToggleGroup defaults are present on group and context-derived item attributes", () => {
  const container = render(
    <ToggleGroup type="single" aria-label="Text alignment">
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
    </ToggleGroup>
  )
  const group = container.querySelector('[data-slot="toggle-group"]') as HTMLElement
  const item = itemAttributes(container)

  expect(group.dataset).toMatchObject({ variant: "default", size: "default", spacing: "2" })
  expect(item.dataset).toMatchObject({ variant: "default", size: "default", spacing: "2" })
})

test("explicit group values supply item attributes ahead of item-local values", () => {
  const container = render(
    <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-label="Text alignment">
      <ToggleGroupItem value="left" variant="default" size="default">Left</ToggleGroupItem>
    </ToggleGroup>
  )
  const item = itemAttributes(container)

  expect(item.dataset).toMatchObject({ variant: "outline", size: "sm", spacing: "0" })
})

test("nullish context values fall back to the item's local variant and size", () => {
  const container = render(
    <ToggleGroup
      type="single"
      {...({ variant: null, size: null } as unknown as { variant: "default"; size: "default" })}
      aria-label="Text alignment"
    >
      <ToggleGroupItem value="left" variant="outline" size="sm">Left</ToggleGroupItem>
    </ToggleGroup>
  )
  const item = itemAttributes(container)

  expect(item.dataset).toMatchObject({ variant: "outline", size: "sm" })
})

test("item forwarded data attributes overwrite context-derived item attributes", () => {
  const container = render(
    <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-label="Text alignment">
      <ToggleGroupItem
        value="left"
        {...({ "data-variant": "forwarded", "data-size": "large-forwarded", "data-spacing": "9" } as Record<string, string>)}
      >
        Left
      </ToggleGroupItem>
    </ToggleGroup>
  )
  const item = itemAttributes(container)

  expect(item.dataset).toMatchObject({
    variant: "forwarded",
    size: "large-forwarded",
    spacing: "9",
  })
})

test("group forwarded data attributes overwrite normalized group attributes", () => {
  const container = render(
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Text alignment"
      {...({ "data-variant": "forwarded", "data-size": "large-forwarded", "data-spacing": "9" } as Record<string, string>)}
    >
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
    </ToggleGroup>
  )
  const group = container.querySelector('[data-slot="toggle-group"]') as HTMLElement

  expect(group.dataset).toMatchObject({
    variant: "forwarded",
    size: "large-forwarded",
    spacing: "9",
  })
  expect(itemAttributes(container).dataset).toMatchObject({
    variant: "outline",
    size: "sm",
    spacing: "0",
  })
})

test("standalone ToggleGroupItem is rejected by Radix even though the producer context has defaults", () => {
  expect(() => renderToStaticMarkup(<ToggleGroupItem value="left">Left</ToggleGroupItem>)).toThrow(
    "`ToggleGroupItem` must be used within `ToggleGroup`"
  )
})
