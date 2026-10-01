import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { oklchToLinearSrgb } from "./helpers/oklch-contrast.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const sourcePath = path.join(root, "src/components/ui/product-system.stories.tsx")
const source = readFileSync(sourcePath, "utf8")
const baseURL = (process.env.STORYBOOK_URL ?? "http://127.0.0.1:6009").replace(/\/$/, "")
const baselineURL = (process.env.RELEASE008_STORYBOOK_URL ?? "http://127.0.0.1:6008").replace(/\/$/, "")
const output = process.env.RELEASE009_MATRIX_OUTPUT ?? "/Users/amjedfadul/.artifacts/shadcn-design-system/release009-matrix"
const storyImportPath = "./src/components/ui/product-system.stories.tsx"
const matrixStories = ["Forms", "DataWorkspace", "SettingsForm", "RecordDetail", "SidePanelForm", "EmptyWorkspace", "CommandSearch", "NavigationData", "MenusOverlays", "FeedbackDisclosure"]
const familyTitles = ["Components/Button", "Components/Card", "Components/Table", "Components/Dialog", "Components/Sidebar"]
const slug = value => value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const title = source.match(/title:\s*["']([^"']+)["']/)?.[1]
assert.equal(title, "System/Product UI", "The matrix expects the System/Product UI story group")
const exports = [...source.matchAll(/^export const (\w+): Story\s*=/gm)].map(match => match[1])
for (const name of matrixStories) assert.ok(exports.includes(name), `Missing product-system story ${name}`)
const productIds = new Map(exports.map(name => [name, `${slug(title)}--${slug(name)}`]))
mkdirSync(output, { recursive: true })

async function readIndex(url, required) {
  try {
    const response = await fetch(`${url}/index.json`)
    if (!response.ok) throw new Error(`Storybook index HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (required) throw new Error(`Unable to read required Storybook index at ${url}: ${error}`)
    return null
  }
}

const r9Index = await readIndex(baseURL, true)
const r8Index = await readIndex(baselineURL, true)
for (const [name, id] of productIds) {
  const entry = r9Index.entries?.[id]
  assert.ok(entry, `Story ${name} is absent from the R9 Storybook index (${id})`)
  assert.equal(entry.importPath, storyImportPath, `${name} import path`)
  assert.equal(entry.exportName, name, `${name} export name`)
}

function byFamily(index, familyTitle) {
  if (!index) return null
  const candidates = Object.values(index.entries ?? {}).filter(entry => entry.type === "story" && entry.title === familyTitle)
  return candidates.find(entry => entry.exportName === "Default") ?? candidates[0] ?? null
}

const comparisons = Object.fromEntries(familyTitles.map(familyTitle => {
  const r8 = byFamily(r8Index, familyTitle)
  const r9 = byFamily(r9Index, familyTitle)
  assert.ok(r8, `Required R8 baseline story is missing for ${familyTitle}`)
  assert.ok(r9, `Required R9 comparison story is missing for ${familyTitle}`)
  return [familyTitle, { r8: r8 ? { id: r8.id, exportName: r8.exportName, importPath: r8.importPath } : null, r9: r9 ? { id: r9.id, exportName: r9.exportName, importPath: r9.importPath } : null }]
}))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1360, height: 980 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(12000)
const errors = []
const baselineErrors = []
const expectedResourceErrors = []
const expectedNavigationAborts = []
const genericResourceConsoleErrors = []
const fontResponses = []
let currentStory = "index"
let currentRelease = "r9"
page.on("pageerror", error => (currentRelease === "r8" ? baselineErrors : errors).push({ release: currentRelease, story: currentStory, kind: "pageerror", message: error.message }))
page.on("console", message => {
  if (message.type() !== "error") return
  const item = { release: currentRelease, story: currentStory, kind: "console", message: message.text() }
  if (/failed to load resource/i.test(message.text())) genericResourceConsoleErrors.push(item)
  else (currentRelease === "r8" ? baselineErrors : errors).push(item)
})
page.on("response", response => {
  if (/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(response.url())) fontResponses.push({ url: response.url(), status: response.status() })
  if (response.status() >= 400) {
    const item = { release: currentRelease, story: currentStory, status: response.status(), url: response.url() }
    if (response.status() === 404 && /(?:^|\/)favicon\.ico(?:\?|$)/i.test(response.url())) expectedResourceErrors.push(item)
    else (currentRelease === "r8" ? baselineErrors : errors).push({ ...item, kind: "http-response" })
  }
})
page.on("requestfailed", request => {
  const item = { release: currentRelease, story: currentStory, kind: "requestfailed", url: request.url(), failure: request.failure()?.errorText }
  if (item.failure === "net::ERR_ABORTED" && /\/src\/index\.css(?:\?|$)/.test(item.url)) expectedNavigationAborts.push(item)
  else (currentRelease === "r8" ? baselineErrors : errors).push(item)
})

const evidence = {
  run: "release009-matrix-browser",
  baseURL,
  baselineURL,
  browser: browser.version(),
  matrixStories,
  storyIds: Object.fromEntries(productIds),
  familyStoryComparisons: comparisons,
  output,
  states: [],
  measurements: {},
  screenshots: [],
  fonts: null,
  consoleAndPageErrors: errors,
  baselineErrors,
  expectedResourceErrors,
}

const screenshot = async name => {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" })
  evidence.screenshots.push(file)
  return file
}
const openStory = async (id, theme = "light", direction = "ltr", url = baseURL) => {
  currentRelease = url === baseURL ? "r9" : "r8"
  currentStory = `${id}/${theme}/${direction}`
  const target = new URL(`${url}/iframe.html`)
  target.searchParams.set("id", id)
  target.searchParams.set("viewMode", "story")
  target.searchParams.set("globals", `theme:${theme};direction:${direction}`)
  await page.goto(target.toString(), { waitUntil: "networkidle" })
  await page.locator("#storybook-root").waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  if (url === baseURL) {
    await page.waitForFunction(expectedDirection => document.documentElement.dir === expectedDirection, direction)
    await page.waitForFunction(expectedDirection => [...document.querySelectorAll("#storybook-root [dir]")].some(node => node.getAttribute("dir") === expectedDirection), direction)
    await page.waitForFunction(expectedTheme => document.documentElement.classList.contains("dark") === (expectedTheme === "dark"), theme)
    await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes("Geist Variable"))
    await page.waitForFunction(() => document.fonts.check('14px "Geist Variable"'))
  }
  await assertNoRenderError()
}
const themeEvidence = async expectedTheme => page.evaluate(theme => {
  const probe = document.createElement("span")
  probe.style.backgroundColor = "var(--background)"
  document.body.append(probe)
  const tokenBackground = getComputedStyle(probe).backgroundColor
  probe.remove()
  return {
    expectedTheme: theme,
    htmlDarkClass: document.documentElement.classList.contains("dark"),
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    backgroundToken: tokenBackground,
    darkClassElement: document.querySelector(".dark")?.tagName ?? null,
  }
}, expectedTheme)
async function assertNoRenderError() {
  assert.equal(await page.locator("vite-error-overlay").count(), 0, `Vite error overlay in ${currentStory}`)
  assert.ok((await page.locator("#storybook-root").innerText()).trim().length > 0, `Blank story in ${currentStory}`)
}
const rect = locator => locator.evaluate(node => {
  const bounds = node.getBoundingClientRect()
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left }
})
const paint = locator => locator.evaluate(node => {
  const style = getComputedStyle(node)
  const bounds = node.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height, radius: style.borderRadius, shadow: style.boxShadow, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, transitionDuration: style.transitionDuration, transitionProperty: style.transitionProperty, background: style.backgroundColor, color: style.color }
})
const finishAnimations = locator => locator.evaluate(async node => {
  await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined)))
})
const expectNear = (actual, expected, label, tolerance = 1) => {
  const number = typeof actual === "number" ? actual : Number.parseFloat(actual)
  assert.ok(Number.isFinite(number) && Math.abs(number - expected) <= tolerance, `${label}: expected ${expected}px, got ${actual}px`)
}
const backgroundAlpha = color => {
  const modern = color.match(/\/\s*([\d.]+)\s*\)$/)
  if (modern) return Number(modern[1])
  const match = color.match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)
  return match ? Number(match[1]) : 1
}

try {
  for (const theme of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      for (const name of matrixStories) {
        const id = productIds.get(name)
        await openStory(id, theme, direction)
        // Story play functions run on load and may deliberately leave a dialog,
        // selection, or disclosure open. Record that authored end state as evidence.
        const themePaint = await themeEvidence(theme)
        assert.equal(themePaint.htmlDarkClass, theme === "dark", `HTML dark class must match ${theme} for ${name}/${direction}`)
        assert.equal(themePaint.bodyBackground, themePaint.backgroundToken, `Body canvas must use the ${theme} background token for ${name}/${direction}`)
        const state = { story: name, id, theme, direction, viewport: { width: 1360, height: 980 }, themePaint, typography: await page.locator("body").evaluate(node => ({ fontFamily: getComputedStyle(node).fontFamily, fontSize: getComputedStyle(node).fontSize, geistLoaded: document.fonts.check('14px "Geist Variable"') })), screenshot: await screenshot(`${slug(name)}-${theme}-${direction}`), screenshots: {} }
        if (name === "Forms") {
          const button = page.locator('[data-slot="button"]').first()
          const input = page.locator('[data-slot="input"]').first()
          const group = page.locator('[data-slot="input-group"]').first()
          state.button = await paint(button)
          state.input = await paint(input)
          state.inputGroup = await paint(group)
          expectNear(state.button.height, 32, "Button default height")
          expectNear(state.input.height, 32, "Input height")
          expectNear(state.button.radius, 6, "Button radius")
          expectNear(state.inputGroup.radius, 8, "InputGroup radius")

          const head = page.locator('[data-slot="table-head"]')
          const row = page.locator('[data-slot="table-row"]')
          const badge = page.locator('[data-slot="badge"]')
          if (await head.count()) expectNear((await rect(head.first())).height, 32, "Table header height")
          if (await row.count()) expectNear((await rect(row.first())).height, 32, "Table row height")
          if (await badge.count()) expectNear((await rect(badge.first())).height, 20, "Badge height")

          const normalInput = page.locator("#profile-name")
          await normalInput.focus()
          await page.keyboard.press("Tab")
          await page.keyboard.press("Shift+Tab")
          state.normalFocus = await normalInput.evaluate(node => ({ focused: node.matches(":focus-visible"), shadow: getComputedStyle(node).boxShadow, border: getComputedStyle(node).borderColor }))
          assert.equal(state.normalFocus.focused, true, "Input receives keyboard-visible focus")
          assert.ok(state.normalFocus.shadow !== "none", "Focused input has a visible focus ring")
          state.screenshots.focus = await screenshot(`forms-focus-${theme}-${direction}`)

          const invalidInput = page.locator("#profile-email")
          await invalidInput.focus()
          state.invalidFocus = await invalidInput.evaluate(node => ({ border: getComputedStyle(node).borderColor, shadow: getComputedStyle(node).boxShadow }))
          assert.ok(state.invalidFocus.border !== state.normalFocus.border, "Invalid focused input has an error border")
          assert.ok(state.invalidFocus.shadow !== "none", "Invalid focused input remains visibly focused")
          state.screenshots.invalidFocus = await screenshot(`forms-invalid-focus-${theme}-${direction}`)

          const groupInput = page.locator('[data-slot="input-group-control"]').first()
          await groupInput.focus()
          state.inputGroupFocus = await paint(group)
          assert.ok(state.inputGroupFocus.shadow !== "none", "InputGroup shows focus on its wrapped control")
          state.screenshots.inputGroupFocus = await screenshot(`forms-input-group-focus-${theme}-${direction}`)

          const selected = page.locator('[data-slot="toggle-group-item"][data-state="on"]').first()
          state.selectedToggle = await paint(selected)
          assert.ok(await selected.count(), "ToggleGroup has an initially selected option")
          const disabled = page.locator('[data-slot="button"]:disabled').first()
          assert.ok(await disabled.count(), "Forms story includes a disabled Button")
          await page.locator('[data-slot="button"]:disabled').first().hover({ force: true })
          state.screenshots.disabled = await screenshot(`forms-disabled-${theme}-${direction}`)
          await page.locator('[data-slot="button"]').first().hover()
          state.screenshots.hover = await screenshot(`forms-hover-${theme}-${direction}`)

          state.bodyTypography = await page.locator("body").evaluate(node => ({ fontFamily: getComputedStyle(node).fontFamily, fontSize: getComputedStyle(node).fontSize }))
          assert.ok(state.bodyTypography.fontFamily.includes("Geist Variable"), `Body should use Geist Variable, got ${state.bodyTypography.fontFamily}`)
        }
        if (name === "DataWorkspace") {
          const tableHeader = await paint(page.locator('[data-slot="table-head"]').first())
          const tableRow = await paint(page.locator('[data-slot="table-row"]').first())
          const badgePaint = await paint(page.locator('[data-slot="badge"]').first())
          state.tableHeader = tableHeader
          state.tableRow = tableRow
          state.badge = badgePaint
          expectNear(tableHeader.height, 32, "Data table header")
          expectNear(tableRow.height, 32, "Data table row")
          expectNear(badgePaint.height, 20, "Data badge")
          const search = page.getByRole("textbox", { name: "Search projects" })
          await search.fill("billing")
          await assertNoRenderError()
          assert.equal(await page.getByRole("cell", { name: "Billing updates" }).count(), 1, "Table search filters matching rows")
          assert.equal(await page.getByRole("cell", { name: "Website refresh" }).count(), 0, "Table search hides nonmatching rows")
        }
        if (name === "SettingsForm") {
          const selectTrigger = page.locator('[data-slot="select-trigger"]').first()
          state.select = await paint(selectTrigger)
          await selectTrigger.click()
          const selectItem = page.locator('[data-slot="select-item"]').first()
          await selectItem.waitFor()
          state.selectMenu = { container: await paint(page.locator('[data-slot="select-content"]')), item: await paint(selectItem) }
          expectNear(state.selectMenu.container.radius, 8, "Select menu radius")
          assert.ok(state.selectMenu.item.height >= 28 && state.selectMenu.item.height <= 32, `Select item expected 28-32px, got ${state.selectMenu.item.height}`)
          assert.notEqual(state.selectMenu.container.shadow, "none", "Select menu has subtle elevation")
          state.screenshots.selectOpen = await screenshot(`settings-select-open-${theme}-${direction}`)
          await page.keyboard.press("Escape")
        }
        if (name === "CommandSearch") {
          const input = page.getByRole("combobox", { name: "Search for a command" })
          await input.fill("invite")
          const option = page.getByRole("option", { name: "Invite member" })
          await option.waitFor()
          state.command = { input: await paint(input), option: await paint(option) }
          assert.ok(state.command.option.height >= 28 && state.command.option.height <= 32, `Command option expected 28-32px, got ${state.command.option.height}`)
          await page.keyboard.press("ArrowDown")
          await page.keyboard.press("Enter")
          assert.equal(await page.getByRole("status").innerText(), "Invite member selected", "Command keyboard selection")
        }
        if (name === "NavigationData") {
          // Its authored play function changes to Assigned to me; return to Recent
          // before recording the table inspection state.
          await page.waitForFunction(() => [...document.querySelectorAll('[data-slot="tabs-trigger"]')].some(node => node.getAttribute("data-state") === "active" && node.textContent?.trim() === "Assigned to me"))
          const recent = page.getByRole("tab", { name: "Recent" })
          await recent.waitFor({ state: "visible" })
          await recent.click()
          state.sidebarItem = await paint(page.locator('[data-slot="sidebar-menu-button"]').first())
          expectNear(state.sidebarItem.height, 28, "Sidebar menu button height")
          state.screenshots.navigation = await screenshot(`navigation-data-${theme}-${direction}`)
        }
        if (name === "MenusOverlays") {
          // The authored play opens and closes Rename workspace. Reopen it for
          // geometry/focus evidence, then inspect the menu independently.
          const trigger = page.getByRole("button", { name: "Open dialog" })
          const content = page.locator('[data-slot="dialog-content"]')
          if (await content.count() === 0 || await content.getAttribute("data-state") !== "open") await trigger.click()
          await content.waitFor({ state: "visible" })
          await page.locator('[data-slot="dialog-overlay"][data-state="open"]').waitFor()
          await finishAnimations(content)
          await finishAnimations(page.locator('[data-slot="dialog-overlay"]'))
          state.dialog = await paint(content)
          state.dialogOverlay = await paint(page.locator('[data-slot="dialog-overlay"]'))
          const overlayColor = await page.locator('[data-slot="dialog-overlay"]').evaluate(node => getComputedStyle(node).backgroundColor)
          state.dialogOverlayAlpha = backgroundAlpha(overlayColor)
          assert.ok(Math.abs(state.dialogOverlayAlpha - 0.3) <= 0.02, `Dialog overlay alpha expected 0.3, got ${overlayColor}`)
          // Dialog keeps the accepted Tailwind lg width (32rem / 512px); the
          // 480px target applies to Sheet and its 30rem desktop cap.
          expectNear(state.dialog.width, 512, "Dialog desktop width", 2)
          assert.ok(await content.evaluate(node => node.contains(document.activeElement)), "Dialog should move focus inside on open")
          await page.keyboard.press("Tab")
          assert.ok(await content.evaluate(node => node.contains(document.activeElement)), "Dialog focus remains trapped")
          await page.keyboard.press("Escape")
          await trigger.waitFor({ state: "visible" })
          await content.waitFor({ state: "detached" })
          assert.equal(await content.count(), 0, "Escape closes the dialog")
          assert.equal(await trigger.evaluate(node => node === document.activeElement), true, "Closing the dialog restores focus to its trigger")
          await page.getByRole("button", { name: "Open menu" }).click()
          const menuItem = page.getByRole("menuitemcheckbox", { name: "Show details" })
          await menuItem.waitFor()
          state.dropdown = { container: await paint(page.locator('[data-slot="dropdown-menu-content"]')), item: await paint(menuItem) }
          expectNear(state.dropdown.container.radius, 8, "Dropdown radius")
          assert.ok(state.dropdown.item.height >= 28 && state.dropdown.item.height <= 32, `Dropdown item expected 28-32px, got ${state.dropdown.item.height}`)
          assert.notEqual(state.dropdown.container.shadow, "none", "Dropdown menu has subtle elevation")
          state.screenshots.menuOpen = await screenshot(`menus-open-${theme}-${direction}`)
          await page.keyboard.press("Escape")
        }
        if (name === "SidePanelForm") {
          // Its play closes the initial form; reopen to capture and measure the sheet.
          const trigger = page.getByRole("button", { name: "Create project" })
          await trigger.click()
          const sheet = page.locator('[data-slot="sheet-content"]')
          await sheet.waitFor({ state: "visible" })
          await page.locator('[data-slot="sheet-overlay"][data-state="open"]').waitFor()
          await finishAnimations(sheet)
          await finishAnimations(page.locator('[data-slot="sheet-overlay"]'))
          state.sheet = await paint(sheet)
          state.sheetOverlay = await paint(page.locator('[data-slot="sheet-overlay"]'))
          const overlayColor = await page.locator('[data-slot="sheet-overlay"]').evaluate(node => getComputedStyle(node).backgroundColor)
          state.sheetOverlayAlpha = backgroundAlpha(overlayColor)
          assert.ok(Math.abs(state.sheetOverlayAlpha - 0.3) <= 0.02, `Sheet overlay alpha expected 0.3, got ${overlayColor}`)
          assert.ok(state.sheet.width <= 480 && state.sheet.width <= 1360, `Desktop sheet should fit its 480px maximum, got ${state.sheet.width}`)
          state.screenshots.sheetOpen = await screenshot(`side-panel-open-${theme}-${direction}`)
          await page.keyboard.press("Escape")
          await sheet.waitFor({ state: "detached" })
          assert.equal(await sheet.count(), 0, "Escape closes the side panel")
          assert.equal(await trigger.evaluate(node => node === document.activeElement), true, "Closing the side panel restores focus")
        }
        evidence.states.push(state)
        evidence.measurements[`${name}/${theme}/${direction}`] = Object.fromEntries(Object.entries(state).filter(([key]) => !["screenshot", "screenshots", "story", "id", "theme", "direction", "viewport"].includes(key)))
      }
    }
  }

  // Check narrow viewport sizing and overflow for the two overlay families.
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [storyName, triggerName, slot, screenshotName] of [
    ["MenusOverlays", "Open dialog", "dialog-content", "dialog-mobile"],
    ["SidePanelForm", "Create project", "sheet-content", "sheet-mobile"],
  ]) {
    await openStory(productIds.get(storyName), "light", "ltr")
    // Play code may have already left or closed an overlay; trigger it explicitly.
    const trigger = page.getByRole("button", { name: triggerName })
    const overlayContent = page.locator(`[data-slot="${slot}"]`)
    if (await overlayContent.count() === 0 || await overlayContent.getAttribute("data-state") !== "open") await trigger.click()
    await overlayContent.waitFor({ state: "visible" })
    const overlaySlot = slot === "dialog-content" ? "dialog-overlay" : "sheet-overlay"
    await page.locator(`[data-slot="${overlaySlot}"][data-state="open"]`).waitFor({ state: "visible" })
    await finishAnimations(overlayContent)
    await finishAnimations(page.locator(`[data-slot="${overlaySlot}"]`))
    const bounds = await rect(overlayContent)
    assert.ok(bounds.width <= 390, `${storyName} content overflows the 390px viewport: ${bounds.width}px`)
    assert.ok(bounds.left >= -1 && bounds.right <= 391, `${storyName} content is horizontally out of view`)
    await screenshot(`${screenshotName}-light-ltr`)
    evidence.states.push({ story: storyName, theme: "light", direction: "ltr", viewport: { width: 390, height: 844 }, mobileOverlay: bounds })
    await page.keyboard.press("Escape")
  }

  // Compare the existing family stories on each release when both indexes provide them.
  for (const [familyTitle, comparison] of Object.entries(comparisons)) {
    for (const [release, url, item] of [["r8", baselineURL, comparison.r8], ["r9", baseURL, comparison.r9]]) {
      if (!item) continue
      await openStory(item.id, "light", "ltr", url)
      if (familyTitle === "Components/Dialog") {
        const dialog = page.locator('[data-slot="dialog-content"]')
        const trigger = page.getByRole("button", { name: "Open profile" })
        await trigger.waitFor({ state: "visible" })
        // The authored play opens then closes this dialog; wait only if it is
        // currently open, since R8/R9 Storybook scheduling can finish before navigation settles.
        if (await dialog.count() && await dialog.getAttribute("data-state") === "open") await dialog.waitFor({ state: "detached" })
        await trigger.click()
        await dialog.waitFor({ state: "visible" })
        await finishAnimations(dialog)
      }
      const style = await page.locator("#storybook-root").evaluate(rootElement => {
        const slots = ["button", "card", "table", "dialog-content", "sidebar", "table-head", "table-row"]
        return Object.fromEntries(slots.map(slot => {
          const node = rootElement.querySelector(`[data-slot="${slot}"]`)
          if (!node) return [slot, null]
          const computed = getComputedStyle(node)
          const bounds = node.getBoundingClientRect()
          return [slot, { width: bounds.width, height: bounds.height, radius: computed.borderRadius, shadow: computed.boxShadow, fontSize: computed.fontSize, background: computed.backgroundColor }]
        }))
      })
      if (release === "r9" && familyTitle === "Components/Card" && style.card) {
        expectNear(style.card.radius, 8, "Card radius")
        assert.ok(style.card.shadow === "none" || style.card.shadow.startsWith("rgba(0, 0, 0, 0)"), `Default Card should have no shadow, got ${style.card.shadow}`)
      }
      if (release === "r9" && familyTitle === "Components/Table") {
        expectNear(style["table-head"]?.height, 32, "Family table header height")
        expectNear(style["table-row"]?.height, 32, "Family table row height")
      }
      if (release === "r9" && familyTitle === "Components/Button" && style.button) expectNear(style.button.height, 32, "Family default Button height")
      if (release === "r9" && familyTitle === "Components/Sidebar") {
        const menu = await page.locator('[data-slot="sidebar-menu-button"]').first()
        if (await menu.count()) expectNear((await rect(menu)).height, 28, "Family sidebar menu button height")
      }
      const file = await screenshot(`${slug(release)}-${slug(familyTitle)}-light-ltr`)
      evidence.states.push({ release, familyTitle, id: item.id, screenshot: file, style })
    }
  }

  // Run a dedicated collapsed-sidebar story and verify the icon-ready width and text.
  const collapsedEntry = Object.values(r9Index.entries ?? {}).find(entry => entry.type === "story" && entry.title === "Components/Sidebar" && entry.exportName === "NavigationCollapsed")
  if (collapsedEntry) {
    await openStory(collapsedEntry.id, "light", "ltr")
    const sidebar = page.locator('[data-slot="sidebar"]')
    await sidebar.waitFor({ state: "visible" })
    await page.locator('[data-slot="sidebar"][data-state="collapsed"]').waitFor({ state: "attached" })
    const link = page.getByRole("link", { name: /Clients/ })
    const iconFootprint = page.locator('[data-slot="sidebar-gap"]')
    const label = link.locator("span").last()
    const labelScreenReaderOnly = await label.evaluate(node => {
      const style = getComputedStyle(node)
      return { position: style.position, width: style.width, height: style.height, clip: style.clip, clipPath: style.clipPath, overflow: style.overflow }
    })
    const collapsed = { sidebar: await paint(sidebar), iconFootprint: await paint(iconFootprint), link: await paint(link), labelScreenReaderOnly, accessibleName: await link.getAttribute("aria-label"), iconReadyWidth: await rect(iconFootprint).then(bounds => bounds.width) }
    expectNear(collapsed.iconReadyWidth, 48, "Collapsed sidebar icon width")
    assert.ok(labelScreenReaderOnly.position === "absolute" || (labelScreenReaderOnly.width === "1px" && labelScreenReaderOnly.height === "1px" && labelScreenReaderOnly.clip !== "auto"), "Collapsed navigation visually hides the label while retaining it for screen readers")
    assert.equal(await page.getByRole("link", { name: "Clients" }).count(), 1, "Collapsed navigation retains an accessible link name")
    evidence.measurements.sidebarCollapsed = collapsed
    await screenshot("sidebar-collapsed-light-ltr")
  } else {
    evidence.measurements.sidebarCollapsed = { unavailable: "NavigationCollapsed story is absent from R9 index" }
  }

  // Reduced motion should remove motion duration from animated component recipes.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await openStory(productIds.get("FeedbackDisclosure"), "light", "ltr")
  const motion = await page.locator('[data-slot="accordion-trigger-icon"]').first().evaluate(node => ({ duration: getComputedStyle(node).transitionDuration, property: getComputedStyle(node).transitionProperty }))
  evidence.measurements.reducedMotion = motion
  const motionDurationsMs = motion.duration.split(",").map(value => {
    const duration = value.trim()
    const number = Number.parseFloat(duration)
    return duration.endsWith("ms") ? number : duration.endsWith("s") ? number * 1000 : Number.NaN
  })
  evidence.measurements.reducedMotion.durationMs = motionDurationsMs
  assert.ok(motionDurationsMs.every(value => Number.isFinite(value) && value <= 0.0101), `Reduced motion accordion transition must be <= 0.01ms, got ${motion.duration}`)

  const fontState = await page.evaluate(async () => {
    await document.fonts.load('14px "Geist Variable"')
    await document.fonts.ready
    return { checked: document.fonts.check('14px "Geist Variable"'), faces: [...document.fonts].map(face => ({ family: face.family, status: face.status })) }
  })
  const loadedGeist = fontState.faces.find(face => face.family.replaceAll('"', "") === "Geist Variable" && face.status === "loaded")
  const font200 = fontResponses.find(response => response.status === 200)
  evidence.fonts = { ...fontState, loadedGeist, font200, fontResponses }
  assert.equal(fontState.checked, true, "Geist Variable must be available")
  assert.ok(loadedGeist, "A Geist Variable face must load")
  assert.ok(font200, "A font resource must return HTTP 200")

  // Keep the helper in the test record so its required conversion remains easy to
  // reuse when inspecting future computed OKLCH values from component paint.
  const bodyColor = await page.locator("body").evaluate(node => getComputedStyle(node).color)
  evidence.colorProbe = { bodyColor, linearSrgb: bodyColor.startsWith("oklch(") ? oklchToLinearSrgb(bodyColor) : null }
  if (genericResourceConsoleErrors.length > expectedResourceErrors.length) {
    for (const item of genericResourceConsoleErrors.slice(expectedResourceErrors.length)) (item.release === "r8" ? baselineErrors : errors).push(item)
  }
  evidence.genericResourceConsoleErrors = genericResourceConsoleErrors
  evidence.baselineErrors = baselineErrors
  assert.deepEqual(errors, [], "No unexpected browser, console, network, or page errors")
  evidence.status = "passed"
} catch (error) {
  evidence.status = "failed"
  evidence.failure = String(error?.stack ?? error)
  throw error
} finally {
  evidence.consoleAndPageErrors = errors
  evidence.baselineErrors = baselineErrors
  evidence.expectedResourceErrors = expectedResourceErrors
  evidence.expectedNavigationAborts = expectedNavigationAborts
  writeFileSync(path.join(output, "release009-matrix-report.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  await browser.close()
}

console.log(JSON.stringify({ status: evidence.status, stories: matrixStories.length, matrixStates: evidence.states.filter(state => state.theme).length, screenshots: evidence.screenshots.length, comparisons, output, errors: errors.length }, null, 2))
