// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { describe, expect, test } from "vitest"
import { CommandDialog, CommandInput, CommandList, CommandItem } from "../src/package"
import { render } from "./studio-test-utils"

function renderCommandDialog(portalContainer?: HTMLElement) {
  return render(
    <CommandDialog defaultOpen {...(portalContainer ? { portalContainer } : {})}>
      <CommandInput aria-label="Search commands" />
      <CommandList>
        <CommandItem value="first">First command</CommandItem>
      </CommandList>
    </CommandDialog>
  )
}

describe("CommandDialog portalContainer", () => {
  test("keeps the default body portal placement and behavior", () => {
    renderCommandDialog()

    const content = document.body.querySelector('[data-slot="dialog-content"]')
    const overlay = document.body.querySelector('[data-slot="dialog-overlay"]')
    expect(content?.parentElement).toBe(document.body)
    expect(overlay?.parentElement).toBe(document.body)
    expect(document.activeElement).toBe(document.body.querySelector('[data-slot="command-input"]'))
    expect(content?.getAttribute("aria-labelledby")).toBe(document.querySelector('[data-slot="dialog-title"]')?.id)
    expect(content?.getAttribute("aria-describedby")).toBe(document.querySelector('[data-slot="dialog-description"]')?.id)

    act(() => (document.body.querySelector('[data-slot="dialog-close"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull()
  })

  test("places the actual dialog portal in the supplied target", () => {
    const host = document.createElement("section")
    document.body.append(host)
    renderCommandDialog(host)

    const content = host.querySelector('[data-slot="dialog-content"]')
    const overlay = host.querySelector('[data-slot="dialog-overlay"]')
    expect(content?.parentElement).toBe(host)
    expect(overlay?.parentElement).toBe(host)
    expect(host.querySelector('[data-slot="command-input"]')).not.toBeNull()
    expect(document.body.querySelectorAll('[data-slot="dialog-content"]').length).toBe(1)
    expect(document.body.querySelector('[data-slot="dialog-content"]')?.parentElement).toBe(host)
    expect(document.activeElement).toBe(host.querySelector('[data-slot="command-input"]'))
    expect(content?.getAttribute("aria-labelledby")).toBe(document.querySelector('[data-slot="dialog-title"]')?.id)
    expect(content?.getAttribute("aria-describedby")).toBe(document.querySelector('[data-slot="dialog-description"]')?.id)

    act(() => (host.querySelector('[data-slot="dialog-close"]') as HTMLButtonElement).click())
    expect(host.querySelector('[data-slot="dialog-content"]')).toBeNull()
  })
})
