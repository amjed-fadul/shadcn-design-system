// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { describe, expect, test } from "vitest"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, Popover, PopoverContent, PopoverTrigger } from "../src/package"
import { render } from "./studio-test-utils"

describe("Popover portalContainer", () => {
  test("keeps default body portal placement and semantics", () => {
    render(<Popover defaultOpen><PopoverTrigger>Toggle popover</PopoverTrigger><PopoverContent role="region" aria-label="Popover body">Popover body</PopoverContent></Popover>)
    const content = document.body.querySelector('[data-slot="popover-content"]')
    expect(content?.closest('[data-radix-popper-content-wrapper]')?.parentElement).toBe(document.body)
    expect(content?.getAttribute("role")).toBe("region")
    act(() => (document.body.querySelector('[data-slot="popover-trigger"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-slot="popover-trigger"]')?.getAttribute("aria-expanded")).toBe("false")
    expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull()
  })

  test("places the actual content portal in the supplied element", () => {
    const host = document.createElement("section")
    document.body.append(host)
    render(<Popover defaultOpen><PopoverTrigger>Toggle popover</PopoverTrigger><PopoverContent portalContainer={host}>Scoped popover</PopoverContent></Popover>)
    const content = host.querySelector('[data-slot="popover-content"]')
    expect(content?.textContent).toContain("Scoped popover")
    expect(content?.closest('[data-radix-popper-content-wrapper]')?.parentElement).toBe(host)
    expect(Array.from(document.body.children).some((element) => element.matches('[data-slot="popover-content"]'))).toBe(false)
    act(() => (document.body.querySelector('[data-slot="popover-trigger"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-slot="popover-trigger"]')?.getAttribute("aria-expanded")).toBe("false")
    expect(host.querySelector('[data-slot="popover-content"]')).toBeNull()
  })
})

describe("AlertDialog portalContainer", () => {
  test("keeps default body portal placement and alert dialog semantics", () => {
    render(<AlertDialog defaultOpen><AlertDialogContent><AlertDialogTitle>Confirm</AlertDialogTitle><AlertDialogDescription>Proceed?</AlertDialogDescription><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogContent></AlertDialog>)
    const content = document.body.querySelector('[role="alertdialog"]')
    expect(content?.getAttribute("aria-labelledby")).toBe(document.body.querySelector('[data-slot="alert-dialog-title"]')?.id)
    expect(content?.getAttribute("aria-describedby")).toBe(document.body.querySelector('[data-slot="alert-dialog-description"]')?.id)
    const overlay = document.body.querySelector('[data-slot="alert-dialog-overlay"]')
    expect(content?.parentElement).toBe(document.body)
    expect(overlay?.parentElement).toBe(content?.parentElement)
    expect(document.activeElement).toBe(document.body.querySelector('[data-slot="alert-dialog-cancel"]'))
    act(() => (document.body.querySelector('[data-slot="alert-dialog-action"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
  })

  test("places overlay and content in the supplied portal boundary", () => {
    const host = document.createElement("section")
    document.body.append(host)
    render(<AlertDialog defaultOpen><AlertDialogContent portalContainer={host}><AlertDialogTitle>Scoped confirmation</AlertDialogTitle><AlertDialogDescription>Confirm action</AlertDialogDescription><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogContent></AlertDialog>)
    const content = host.querySelector('[role="alertdialog"]')
    const overlay = host.querySelector('[data-slot="alert-dialog-overlay"]')
    expect(overlay).not.toBeNull()
    expect(content?.textContent).toContain("Scoped confirmation")
    expect(content?.parentElement).toBe(host)
    expect(overlay?.parentElement).toBe(content?.parentElement)
    expect(document.activeElement).toBe(host.querySelector('[data-slot="alert-dialog-cancel"]'))
    expect(Array.from(document.body.children).some((element) => element.matches('[role="alertdialog"]'))).toBe(false)
    expect(content?.getAttribute("aria-labelledby")).toBe(host.querySelector('[data-slot="alert-dialog-title"]')?.id)
    expect(content?.getAttribute("aria-describedby")).toBe(host.querySelector('[data-slot="alert-dialog-description"]')?.id)
    act(() => (host.querySelector('[data-slot="alert-dialog-action"]') as HTMLButtonElement).click())
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
  })
})
