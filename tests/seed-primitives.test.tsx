import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { Badge } from "../src/components/ui/badge"
import { Button } from "../src/components/ui/button"
import { Input } from "../src/components/ui/input"
import { Separator } from "../src/components/ui/separator"
import { Skeleton } from "../src/components/ui/skeleton"

describe("Studio seed primitives", () => {
  test("render their governed slots and variants", () => {
    expect(renderToStaticMarkup(<Button variant="outline">Review</Button>)).toContain('data-slot="button"')
    expect(renderToStaticMarkup(<Button variant="outline">Review</Button>)).toContain('data-variant="outline"')
    expect(renderToStaticMarkup(<Badge variant="secondary">Approved</Badge>)).toContain('data-slot="badge"')
    expect(renderToStaticMarkup(<Input aria-label="Search" />)).toContain('data-slot="input"')
    expect(renderToStaticMarkup(<Separator />)).toContain('data-slot="separator"')
    expect(renderToStaticMarkup(<Skeleton />)).toContain('data-slot="skeleton"')
  })
})
