import assert from "node:assert/strict"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
const server = await createServer({ root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, realpathSync(new URL("../node_modules", import.meta.url))] } }, logLevel: "error" })
await server.listen()
const address = server.httpServer.address()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
page.setDefaultTimeout(10000)
const errors = []
page.on("pageerror", error => errors.push(error.message))

const rect = async locator => locator.evaluate(node => {
  const { left, right, top, bottom, width, height } = node.getBoundingClientRect()
  return { left, right, top, bottom, width, height }
})
const textRect = async locator => locator.evaluate(node => {
  const range = document.createRange()
  range.selectNodeContents(node)
  const { left, right } = range.getBoundingClientRect()
  return { left, right }
})
const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
let activeTheme = "light"
async function open(kind, dir, side) {
  const query = new URLSearchParams({ kind, dir, ...(side && { side }) })
  await page.goto(`http://127.0.0.1:${address.port}/tests/fixtures/overlay-rtl.html?${query}`)
  await page.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), activeTheme)
  await page.locator('[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"], [data-slot="select-content"], [data-slot="dropdown-menu-content"]').first().waitFor({ state: "visible" })
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame)
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined)))
  })
}
function near(actual, expected, label) { assert.ok(Math.abs(actual - expected) <= 2, `${label}: ${actual} != ${expected}`) }
function closeAtEnd(content, close, dir, label) {
  if (dir === "ltr") near(content.right - close.right, 16, `${label} right inset`)
  else near(close.left - content.left, 16, `${label} left inset`)
}

try {
  for (const theme of ["light", "dark"]) for (const dir of ["ltr", "rtl"]) {
    activeTheme = theme
    await open("dialog", dir)
    const content = page.locator('[data-slot="dialog-content"]')
    const close = content.locator('[data-slot="dialog-close"]')
    const header = content.locator('[data-slot="dialog-header"]')
    await content.waitFor()
    closeAtEnd(await rect(content), await rect(close), dir, `Dialog ${dir}`)
    assert.equal(await header.evaluate(node => getComputedStyle(node).textAlign), "start")
    const headerRect = await rect(header)
    const titleTextRect = await textRect(content.locator('[data-slot="dialog-title"]'))
    if (dir === "ltr") near(titleTextRect.left, headerRect.left, `Dialog ${dir} title start`)
    else near(titleTextRect.right, headerRect.right, `Dialog ${dir} title start`)
    const titleRect = await rect(content.locator('[data-slot="dialog-title"]'))
    assert.equal(overlap(await rect(close), { ...titleTextRect, top: titleRect.top, bottom: titleRect.bottom }), false, `Dialog ${dir} close/title overlap`)

    await open("command", dir)
    const command = page.locator('[data-slot="dialog-content"]')
    const commandClose = command.locator('[data-slot="dialog-close"]')
    const search = command.locator('[data-slot="command-input-wrapper"] > svg')
    const input = command.locator('[data-slot="command-input"]')
    await command.waitFor()
    const commandRect = await rect(command)
    const commandCloseRect = await rect(commandClose)
    near(dir === "ltr" ? commandRect.right - commandCloseRect.right : commandCloseRect.left - commandRect.left, 4, `Command Dialog ${theme}/${dir} close inset`)
    assert.equal(overlap(await rect(input), commandCloseRect), false, `Command Dialog ${theme}/${dir} input/close overlap`)
    const inputRowRect = await rect(command.locator('[data-slot="command-input-wrapper"]'))
    assert.ok(commandCloseRect.bottom <= inputRowRect.bottom, `Command Dialog ${theme}/${dir} close stays inside search row`)
    assert.equal(overlap(await rect(command.locator('[data-slot="command-item"]').first()), commandCloseRect), false, `Command Dialog ${theme}/${dir} first item/close overlap`)
    const searchRect = await rect(search)
    const closeRect = await rect(commandClose)
    assert.equal(overlap(searchRect, closeRect), false, `Command Dialog ${dir} search/close overlap`)
    assert.ok(dir === "ltr" ? searchRect.right < closeRect.left : searchRect.left > closeRect.right, `Command Dialog ${dir} search must stay at start`)
    await input.fill("alpha")
    await command.locator('[data-slot="command-item"]').first().click()
    assert.equal(await page.locator("#selected").textContent(), "alpha", `Command Dialog ${dir} interaction`)

    for (const side of ["right", "left"]) {
      await open("sheet", dir, side)
      const sheet = page.locator('[data-slot="sheet-content"]')
      const sheetRect = await rect(sheet)
      const sheetClose = await rect(sheet.locator('[data-slot="sheet-close"]'))
      closeAtEnd(sheetRect, sheetClose, dir, `Sheet ${dir}/${side}`)
      if (side === "right") near(1100 - sheetRect.right, 0, `Sheet ${dir}/right physical edge`)
      else near(sheetRect.left, 0, `Sheet ${dir}/left physical edge`)
      const sheetTitle = await rect(sheet.locator('[data-slot="sheet-title"]'))
      assert.equal(overlap(sheetClose, { ...await textRect(sheet.locator('[data-slot="sheet-title"]')), top: sheetTitle.top, bottom: sheetTitle.bottom }), false, `Sheet ${dir}/${side} close/title overlap`)
    }

    await open("alert", dir)
    const alertHeader = page.locator('[data-slot="alert-dialog-header"]')
    await alertHeader.waitFor()
    assert.equal(await alertHeader.evaluate(node => getComputedStyle(node).textAlign), "start", `Alert Dialog ${dir} alignment`)
    const alertRect = await rect(alertHeader)
    const alertTitleTextRect = await textRect(page.locator('[data-slot="alert-dialog-title"]'))
    if (dir === "ltr") near(alertTitleTextRect.left, alertRect.left, `Alert Dialog ${dir} title start`)
    else near(alertTitleTextRect.right, alertRect.right, `Alert Dialog ${dir} title start`)

    await open("select", dir)
    const item = page.locator('[data-slot="select-item"]').first()
    await item.waitFor()
    const itemRect = await rect(item)
    const indicatorRect = await rect(item.locator("span").first())
    if (dir === "ltr") near(itemRect.right - indicatorRect.right, 8, `Select ${dir} indicator inset`)
    else near(indicatorRect.left - itemRect.left, 8, `Select ${dir} indicator inset`)

    await open("dropdown", dir)
    const check = page.locator('[data-slot="dropdown-menu-checkbox-item"]')
    await check.waitFor()
    const checkRect = await rect(check)
    const checkIndicator = await rect(check.locator("span").first())
    if (dir === "ltr") near(checkIndicator.left - checkRect.left, 8, `Dropdown ${dir} indicator inset`)
    else near(checkRect.right - checkIndicator.right, 8, `Dropdown ${dir} indicator inset`)
    const shortcut = await rect(page.locator('[data-slot="dropdown-menu-shortcut"]'))
    const action = await rect(page.locator('[data-slot="dropdown-menu-item"]'))
    if (dir === "ltr") assert.ok(shortcut.right > (action.left + action.right) / 2)
    else assert.ok(shortcut.left < (action.left + action.right) / 2)
  }
  assert.deepEqual(errors, [], "Browser runtime errors")
  console.log("Chromium overlay RTL geometry and interaction checks passed (Dialog, Command Dialog, Sheet, Alert Dialog, Select, Dropdown Menu; Light/Dark × LTR/RTL).")
} finally {
  await browser.close()
  await server.close()
}
