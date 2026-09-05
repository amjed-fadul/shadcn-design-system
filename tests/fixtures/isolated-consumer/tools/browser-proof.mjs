import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { sha256 } from './verify-bytes.mjs'

async function eventually(check, timeout = 5000) {
  const deadline = Date.now() + timeout
  for (;;) {
    try { return await check() } catch (error) {
      if (Date.now() >= deadline) throw error
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}
async function settledScroll(viewport) {
  let last = -1
  let unchanged = 0
  await eventually(async () => {
    const current = await viewport.evaluate(element => element.scrollTop)
    unchanged = current === last ? unchanged + 1 : 0
    last = current
    assert.ok(unchanged >= 3, 'Waiting for scrolling to settle')
  })
  return last
}
async function styles(page) {
  return page.evaluate(() => {
    const css = selector => getComputedStyle(document.querySelector(selector))
    const root = css('html')
    const fields = ['--background', '--foreground', '--primary', '--primary-foreground', '--card', '--card-foreground', '--border', '--muted']
    const variables = Object.fromEntries(fields.map(name => [name, root.getPropertyValue(name).trim()]))
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const colors = Object.fromEntries(fields.map(name => {
      probe.style.backgroundColor = `var(${name})`
      return [name, getComputedStyle(probe).backgroundColor]
    }))
    probe.remove()
    const summarize = selector => {
      const c = css(selector)
      return { background: c.backgroundColor, color: c.color, borderColor: c.borderTopColor, borderWidth: c.borderTopWidth, radius: c.borderTopLeftRadius, display: c.display, height: c.height, width: c.width, padding: c.padding, fontFamily: c.fontFamily }
    }
    return { variables, colors, button: summarize('#count-button'), card: summarize('#card'), cardHeader: summarize('#card-header'), tabList: summarize('#tab-list'), activeTab: summarize('[role=tab][data-state=active]'), viewport: summarize('[data-slot=scroll-area-viewport]'), body: summarize('body'), portal: document.querySelector('#dialog') ? summarize('#dialog') : null }
  })
}
function assertTheme(actual, dark) {
  assert.equal(actual.variables['--background'], dark ? 'oklch(14.5% 0 0)' : 'oklch(100% 0 0)')
  assert.equal(actual.variables['--primary'], dark ? 'oklch(92.2% 0 0)' : 'oklch(20.5% 0 0)')
  assert.equal(actual.variables['--card'], dark ? 'oklch(20.5% 0 0)' : 'oklch(100% 0 0)')
  for (const value of Object.values(actual.variables)) assert.ok(value.length > 0)
  assert.equal(actual.button.background, actual.colors['--primary'])
  assert.equal(actual.button.color, actual.colors['--primary-foreground'])
  assert.equal(actual.button.display, 'inline-flex')
  assert.equal(actual.button.height, '32px')
  assert.equal(actual.button.radius, '8px')
  assert.equal(actual.card.background, actual.colors['--card'])
  assert.equal(actual.card.color, actual.colors['--card-foreground'])
  assert.equal(actual.card.borderColor, actual.colors['--border'])
  assert.equal(actual.card.borderWidth, '1px')
  assert.equal(actual.card.display, 'flex')
  assert.equal(actual.cardHeader.display, 'grid')
  assert.equal(actual.cardHeader.padding, '16px')
  assert.equal(actual.tabList.background, actual.colors['--muted'])
  assert.equal(actual.tabList.display, 'flex') // inline-flex is blockified as a flex item
  assert.equal(actual.tabList.padding, '4px')
  assert.equal(actual.activeTab.background, actual.colors['--background'])
  assert.equal(actual.activeTab.color, actual.colors['--foreground'])
  assert.equal(actual.viewport.height, '120px')
  assert.equal(actual.viewport.width, '320px')
  assert.match(actual.body.fontFamily, /Geist Variable/)
  assert.equal(actual.body.background, actual.colors['--background'])
  if (actual.portal) {
    assert.equal(actual.portal.background, actual.colors['--background'])
    assert.equal(actual.portal.color, actual.colors['--foreground'])
    assert.equal(actual.portal.borderColor, actual.colors['--border'])
  }
}
export async function browserProof(expected) {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0, open: false } })
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    const errors = []
    const requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
    page.on('response', response => { requests.push({ url: response.url(), status: response.status() }); if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
    const address = server.httpServer.address()
    await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
    await page.locator('#count-button').waitFor()
    const data = JSON.parse(await page.locator('#release-data').textContent())
    assert.equal(data.reactVersion, '18.3.1')
    assert.deepEqual(data.exports, expected.exports)
    assert.equal(data.release.releaseId, expected.releaseId)
    assert.equal(data.release.sha256, expected.releaseSha256)
    assert.deepEqual(data.release.packageIdentity, expected.packageIdentity)
    assert.equal(data.components.families.length, 19)
    assert.equal(data.tokens.tokens.length, expected.tokenCount)
    assert.equal(sha256(JSON.stringify(data.release)), expected.releaseDocumentSha256)
    assert.equal(sha256(JSON.stringify(data.components)), expected.componentsSha256)
    assert.equal(sha256(JSON.stringify(data.tokens)), expected.tokensSha256)

    const fonts = await page.evaluate(async () => {
      const loaded = await document.fonts.load('16px "Geist Variable"', 'Independent consumer')
      await document.fonts.ready
      const faces = [...document.fonts].map(face => ({ family: face.family, status: face.status }))
      const embedded = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).filter(rule => rule instanceof CSSFontFaceRule && rule.style.getPropertyValue('src').includes('data:font/woff2;base64,')).length
      return { loaded: loaded.length, check: document.fonts.check('16px "Geist Variable"'), faces, embedded }
    })
    assert.ok(fonts.loaded > 0 && fonts.check && fonts.embedded > 0)
    assert.ok(fonts.faces.some(face => face.family.includes('Geist Variable') && face.status === 'loaded'))
    const light = await styles(page)
    assertTheme(light, false)
    await page.locator('#count-button').click()
    assert.equal(await page.locator('#count-button').textContent(), 'Clicked 1')
    await page.locator('#tab-two').click()
    assert.equal(await page.locator('#tab-two').getAttribute('data-state'), 'active')
    assert.equal(await page.getByRole('tabpanel').textContent(), 'Second panel')
    await page.locator('#hook-button').click()
    assert.match(await page.locator('#hook-button').textContent(), /Sidebar closed \/ desktop/)
    await page.setViewportSize({ width: 600, height: 900 })
    await eventually(async () => assert.match(await page.locator('#hook-button').textContent(), /mobile/))
    await page.setViewportSize({ width: 1100, height: 900 })
    await eventually(async () => assert.match(await page.locator('#hook-button').textContent(), /desktop/))

    async function openPortal() {
      await page.locator('#dialog-trigger').click()
      await page.getByRole('dialog').waitFor()
      assert.equal(await page.locator('#dialog').evaluate(element => element.parentElement === document.body && !document.querySelector('#root').contains(element)), true)
      await eventually(async () => assert.equal(await page.locator('#dialog').evaluate(element => element.contains(document.activeElement)), true))
    }
    async function closePortal() {
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      await eventually(async () => assert.equal(await page.locator('#dialog-trigger').evaluate(element => element === document.activeElement), true))
    }
    await openPortal()
    let lightPortal
    await eventually(async () => { lightPortal = await styles(page); assertTheme(lightPortal, false) })
    await closePortal()

    await page.locator('#theme-button').click()
    let dark
    await eventually(async () => { dark = await styles(page); assertTheme(dark, true) })
    await openPortal()
    let darkPortal
    await eventually(async () => { darkPortal = await styles(page); assertTheme(darkPortal, true) })
    assert.notEqual(darkPortal.portal.background, lightPortal.portal.background)
    await closePortal()
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('[data-slot=scroll-area-viewport]').evaluate(element => element === document.activeElement), true)
    const beforeScroll = await page.locator('[data-slot=scroll-area-viewport]').evaluate(element => ({ top: element.scrollTop, height: element.scrollHeight, client: element.clientHeight }))
    assert.ok(beforeScroll.height > beforeScroll.client)
    await page.keyboard.press('PageDown')
    await eventually(async () => assert.ok(await page.locator('[data-slot=scroll-area-viewport]').evaluate(element => element.scrollTop) > beforeScroll.top))
    const afterKeyboard = await settledScroll(page.locator('[data-slot=scroll-area-viewport]'))
    await page.locator('[data-slot=scroll-area-viewport]').hover()
    await page.mouse.wheel(0, 240)
    await eventually(async () => assert.ok(await page.locator('[data-slot=scroll-area-viewport]').evaluate(element => element.scrollTop) > afterKeyboard))
    const afterWheel = await settledScroll(page.locator('[data-slot=scroll-area-viewport]'))

    await page.locator('#theme-button').click()
    let restoredLight
    await eventually(async () => { restoredLight = await styles(page); assertTheme(restoredLight, false) })
    assert.deepEqual(restoredLight.variables, light.variables)
    // Text changed from Clicked 0 to Clicked 1 and First to Second; compare
    // restored theme properties without treating content-dependent widths as colors.
    for (const field of ['button', 'card', 'cardHeader', 'tabList', 'activeTab', 'body']) {
      for (const property of ['background', 'color', 'borderColor', 'borderWidth', 'radius', 'fontFamily']) assert.equal(restoredLight[field][property], light[field][property])
    }
    await openPortal()
    let restoredPortal
    await eventually(async () => { restoredPortal = await styles(page); assertTheme(restoredPortal, false) })
    assert.deepEqual(restoredPortal.portal, lightPortal.portal)
    await closePortal()
    let compositionCanary
    if (expected.refRepair) {
      assert.equal(await page.locator('#sidebar-dropdown-trigger').getAttribute('data-composed-ref'), 'received', 'Incoming ref must traverse TooltipTrigger, DropdownMenuTrigger and SidebarMenuButton to this DOM node')
      await page.locator('#sidebar-dropdown-trigger').click()
      await page.getByRole('menu').waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('menu').waitFor({ state: 'detached' })
      await eventually(async () => assert.equal(await page.locator('#sidebar-dropdown-trigger').evaluate(element => element === document.activeElement), true))
      compositionCanary = 'TooltipTrigger asChild → DropdownMenuTrigger asChild → SidebarMenuButton: incoming DOM ref and Escape return to exact trigger'
    }
    // Keep the Button/asChild regression alongside the native trigger control.
    // Record a failure here so the remaining byte/tamper evidence can finish;
    // acceptance.mjs rejects every recorded blocker before setting success.
    await page.locator('#composed-dialog-trigger').click()
    await page.locator('#composed-dialog').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('#composed-dialog').waitFor({ state: 'detached' })
    let focusReturned = true
    try {
      await eventually(async () => assert.equal(await page.locator('#composed-dialog-trigger').evaluate(element => element === document.activeElement), true))
    } catch { focusReturned = false }
    const composedButtonTrigger = { focusReturned, expectedFocusId: 'composed-dialog-trigger', actualFocus: await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id })) }
    const blockers = focusReturned ? [] : ['DIALOG_BUTTON_TRIGGER_FOCUS_RETURN: Escape leaves focus on ' + composedButtonTrigger.actualFocus.tag + ' instead of the composed Button trigger']
    await page.screenshot({ path: 'consumer-light.png', fullPage: true })
    assert.deepEqual(errors, [])
    assert.ok(requests.every(request => request.url.startsWith(`http://127.0.0.1:${address.port}/`)))
    return { blockers, composedButtonTrigger, compositionCanary, browser: browser.version(), release: { id: data.release.releaseId, sha256: data.release.sha256, exports: data.exports.length, families: data.components.families.length, tokens: data.tokens.tokens.length }, fonts, light, lightPortal, dark, darkPortal, restoredLight, restoredPortal, interactions: { button: 'Clicked 1', tabs: 'Second panel', hook: 'toggle and responsive effect passed', dialog: 'native DialogTrigger: body portal, initial focus, Escape and focus return passed in all themes', scroll: { beforeScroll, afterKeyboard, afterWheel } }, errors, requests }
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
  }
}
