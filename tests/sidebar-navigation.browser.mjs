import assert from "node:assert/strict"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

// Real-browser checks that jsdom cannot reproduce: a SidebarMenuButton composed
// with an anchor keeps native link behaviour (Enter activation, modified click,
// middle click, open-in-new-tab, context menu) in expanded, icon-collapsed and
// RTL presentations, and action items stay buttons.
const root = fileURLToPath(new URL("../", import.meta.url))
const server = await createServer({ root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, realpathSync(new URL("../node_modules", import.meta.url))] } }, logLevel: "error" })
await server.listen()
const address = server.httpServer.address()
const origin = `http://127.0.0.1:${address.port}`
const fixture = `${origin}/tests/fixtures/sidebar-navigation.html`
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 900, height: 1200 } })
const page = await context.newPage()
page.setDefaultTimeout(10000)
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })

const presentations = [
  { id: "expanded", dir: "ltr", state: "expanded" },
  { id: "collapsed", dir: "ltr", state: "collapsed" },
  { id: "rtl", dir: "rtl", state: "expanded" },
  { id: "rtl-collapsed", dir: "rtl", state: "collapsed" },
]

async function reload() {
  await page.goto(fixture)
  await page.locator("#expanded").waitFor()
}

try {
  await reload()

  for (const { id, dir, state } of presentations) {
    const nav = page.locator(`#${id}`)
    assert.equal(await nav.locator("[data-slot='sidebar']").first().getAttribute("data-state"), state, `${id} presentation state`)
    assert.equal(await nav.evaluate((node) => getComputedStyle(node).direction), dir)

    // Roles and names come from the platform, not from the design system.
    const links = nav.getByRole("link")
    assert.equal(await links.count(), 3, `${id}: three native links`)
    assert.equal(await nav.getByRole("link", { name: "Follow-ups" }).count(), 1, `${id}: accessible name comes from content`)
    assert.equal(await nav.getByRole("link", { name: "Clients" }).getAttribute("href"), "/tests/fixtures/sidebar-navigation-target.html")
    assert.equal(await nav.getByRole("link", { name: "Follow-ups" }).getAttribute("aria-current"), "page")
    assert.equal(await nav.locator("[aria-current]").count(), 1, `${id}: only the current-page link carries aria-current`)
    assert.equal(await nav.locator("a button, button a, a a").count(), 0, `${id}: no nested interactive elements`)

    // Action item stays a button and is never current.
    const action = nav.getByRole("button", { name: "Command menu" })
    assert.equal(await action.count(), 1)
    assert.equal(await action.getAttribute("aria-current"), null)
    assert.equal(await action.getAttribute("href"), null)
    await action.click()
    assert.equal(await action.getAttribute("data-actions"), "1", `${id}: action button runs its handler`)

    // Links remain rendered, focusable, and reachable by keyboard, even collapsed.
    for (const name of ["Follow-ups", "Clients", "Settings"]) {
      const box = await nav.getByRole("link", { name }).boundingBox()
      assert.ok(box && box.width > 0 && box.height > 0, `${id}: ${name} is rendered`)
    }
    await nav.getByRole("link", { name: "Follow-ups" }).focus()
    await page.keyboard.press("Tab")
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim().replace(/^●/, "")), "Clients", `${id}: Tab moves link to link`)
  }

  // Enter on a focused link performs a real native navigation (not a click handler).
  for (const { id } of presentations) {
    await reload()
    const link = page.locator(`#${id}`).getByRole("link", { name: "Clients" })
    await link.focus()
    await Promise.all([page.waitForURL(`${origin}/tests/fixtures/sidebar-navigation-target.html`), page.keyboard.press("Enter")])
    assert.equal(await page.locator("h1").textContent(), "Navigation target", `${id}: Enter navigated natively`)
  }

  // Plain click on a link with a query string navigates natively too.
  await reload()
  await Promise.all([page.waitForURL(/from=settings/), page.locator("#expanded").getByRole("link", { name: "Settings" }).click()])

  // Modifier click and middle click open a new tab and leave this page alone; the
  // design system must not swallow them.
  for (const { id } of presentations) {
    for (const how of ["ctrl", "middle"]) {
      await reload()
      const link = page.locator(`#${id}`).getByRole("link", { name: "Clients" })
      const opened = context.waitForEvent("page")
      if (how === "ctrl") await link.click({ modifiers: ["ControlOrMeta"] })
      else await link.click({ button: "middle" })
      const tab = await opened
      await tab.waitForURL(`${origin}/tests/fixtures/sidebar-navigation-target.html`)
      assert.equal(new URL(tab.url()).pathname, "/tests/fixtures/sidebar-navigation-target.html", `${id}/${how}: opens in a new tab`)
      assert.equal(page.url(), fixture, `${id}/${how}: current page did not navigate`)
      await tab.close()
    }
  }

  // Context menu: the design system does not cancel the event (the native menu
  // itself is not observable headless); the element is a real <a href>, which is
  // what makes open-in-new-tab available.
  await reload()
  const cancelled = await page.evaluate(() => new Promise((resolve) => {
    const link = document.querySelector("#expanded a[href$='target.html']")
    document.addEventListener("contextmenu", (event) => resolve(event.defaultPrevented), { once: true })
    link.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }))
  }))
  assert.equal(cancelled, false, "contextmenu is not default-prevented")

  // aria-current lives on the authored anchor and survives collapse.
  assert.equal(await page.locator("#collapsed a[aria-current='page']").count(), 1)

  assert.deepEqual(errors, [], "no page or console errors")
  console.log("sidebar navigation browser checks passed")
} finally {
  await browser.close()
  await server.close()
}
