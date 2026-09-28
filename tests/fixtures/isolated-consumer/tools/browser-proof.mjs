import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { preview } from 'vite'

const state = page => page.locator('#state-probe').evaluate(node => JSON.parse(node.textContent))
const wait = (page, predicate) => page.waitForFunction(predicate)
const tolerance = 3

export async function browserProof(r4) {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0, open: false } })
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 760, height: 700 } })
    page.setDefaultTimeout(5_000)
    const globalListeners = []
    await page.addInitScript(() => {
      const native = EventTarget.prototype.addEventListener
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (this === window || this === document) window.__r4GlobalListeners = [...(window.__r4GlobalListeners ?? []), { type }]
        return native.call(this, type, listener, options)
      }
      const originalMatchMedia = window.matchMedia.bind(window)
      window.matchMedia = (...args) => { window.__r4ViewportReads = [...(window.__r4ViewportReads ?? []), { api: 'matchMedia', args }]; return originalMatchMedia(...args) }
      const nativeInnerWidth = (() => {
        let owner = window
        while (owner) {
          const descriptor = Object.getOwnPropertyDescriptor(owner, 'innerWidth')
          if (descriptor) return descriptor
          owner = Object.getPrototypeOf(owner)
        }
      })()
      Object.defineProperty(window, 'innerWidth', { configurable: true, get() { window.__r4ViewportReads = [...(window.__r4ViewportReads ?? []), { api: 'innerWidth' }]; return nativeInnerWidth.get.call(window) } })
      const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
      Object.defineProperty(document, 'cookie', { configurable: true, get: () => cookie.get.call(document), set: value => { window.__r4CookieWrites = [...(window.__r4CookieWrites ?? []), value]; cookie.set.call(document, value) } })
    })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const address = server.httpServer.address()
    await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
    await page.locator('#visible-sidebar-trigger').waitFor()
    assert.equal(JSON.parse(await page.locator('#release-data').textContent()).releaseId, r4.releaseId)
    const mountAmbient = await page.evaluate(() => ({ viewportReads: window.__r4ViewportReads ?? [], cookieWrites: window.__r4CookieWrites ?? [], listeners: window.__r4GlobalListeners ?? [] }))
    assert.deepEqual(mountAmbient.viewportReads, [], 'core performed ambient viewport/mobile detection during mount')
    assert.deepEqual(mountAmbient.cookieWrites, [], 'core wrote Sidebar persistence during mount')
    const initial = await state(page)
    assert.deepEqual(initial, { open: false, openMobile: false, isMobile: false, state: 'collapsed' })
    await page.locator('#collapsible-mode').click()
    await wait(page, () => document.querySelector('#candidate-sidebar')?.getAttribute('data-state') === 'expanded')
    assert.equal(await page.evaluate(() => document.querySelector('#candidate-sidebar')?.getAttribute('data-state')), 'expanded', 'collapsible="none" must be effectively expanded with desktop open=false')
    assert.deepEqual(await state(page), initial, 'collapsible="none" must not mutate closed desktop/mobile channels')
    await page.locator('#collapsible-mode').click()
    await page.locator('#cancelled-sidebar-trigger').click()
    assert.deepEqual(await state(page), initial, 'SidebarTrigger must respect a cancelled click')
    await page.locator('#visible-sidebar-trigger').click()
    await wait(page, () => JSON.parse(document.querySelector('#state-probe').textContent).open === true)
    const desktopOpen = await state(page)
    assert.equal(desktopOpen.openMobile, false)
    const desktopSemantic = await page.locator('[data-slot="sidebar"]').first().evaluate(node => ({ slot: node.getAttribute('data-slot'), side: node.getAttribute('data-side'), state: node.getAttribute('data-state'), text: node.textContent }))
    assert.equal(desktopSemantic.state, 'expanded')
    await page.evaluate(() => { window.__r4ViewportReads = [] })
    await page.setViewportSize({ width: 1220, height: 700 })
    await page.waitForTimeout(100)
    const resizeAmbient = await page.evaluate(() => [...(window.__r4ViewportReads ?? [])])
    assert.deepEqual(resizeAmbient, [], 'core performed ambient viewport/mobile detection during resize')
    assert.equal(await page.evaluate(() => window.innerWidth), 1220, 'viewport instrumentation must preserve the native dynamic width')
    assert.deepEqual(await state(page), desktopOpen, 'browser width must not choose a Sidebar presentation')
    assert.deepEqual(await page.locator('[data-slot="sidebar"]').first().evaluate(node => ({ slot: node.getAttribute('data-slot'), side: node.getAttribute('data-side'), state: node.getAttribute('data-state'), text: node.textContent })), desktopSemantic)
    const globalBeforeMobile = await page.evaluate(() => window.__r4GlobalListeners ?? [])
    assert.deepEqual(globalBeforeMobile.filter(listener => ['keydown', 'keyup', 'keypress'].includes(listener.type)), globalListeners, 'core registered an ambient keyboard shortcut listener before any Sheet exists')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+B' : 'Control+B')
    assert.deepEqual(await state(page), desktopOpen, 'Cmd/Ctrl+B must not be a core Sidebar shortcut')
    await page.evaluate(() => document.querySelector('#mobile-mode').click())
    await wait(page, () => JSON.parse(document.querySelector('#state-probe').textContent).isMobile === true)
    assert.deepEqual(await state(page), { open: true, openMobile: false, isMobile: true, state: 'expanded' }, 'changing only isMobile must preserve independent channels')
    await page.waitForTimeout(300)
    assert.equal(await page.locator('#candidate-sidebar[role="dialog"]').count(), 0, 'the closed mobile Sheet must not leak an ambient portal')
    const matrix = []
    let selectedDir = 'ltr'
    let selectedSide = 'left'
    for (const dir of ['ltr', 'rtl']) for (const side of ['left', 'right']) {
      if (selectedDir !== dir) { await page.locator('#dir-mode').click(); selectedDir = dir }
      if (selectedSide !== side) { await page.locator('#side-mode').click(); selectedSide = side }
      await page.locator('#visible-sidebar-trigger').click()
      await wait(page, () => JSON.parse(document.querySelector('#state-probe').textContent).openMobile === true)
      assert.deepEqual(await state(page), { open: true, openMobile: true, isMobile: true, state: 'expanded' }, 'opening mobile must preserve desktop channel and change only mobile channel')
      const dialog = page.locator('#candidate-sidebar[role="dialog"]')
      assert.ok(await dialog.count(), 'mobile state opened without Sheet content')
      await dialog.waitFor({ state: 'visible' })
      assert.equal(await dialog.getAttribute('data-mobile'), 'true', 'changing only isMobile must select the Sheet-backed mobile presentation')
      const result = await page.evaluate(({ side, dir }) => {
        const host = document.querySelector('#finite-host').getBoundingClientRect()
        const content = document.querySelector('#candidate-sidebar[role="dialog"]')
        const overlay = document.querySelector('[data-slot="sheet-overlay"]')
        const rect = content.getBoundingClientRect()
        const overlayRect = overlay.getBoundingClientRect()
        const inHost = document.querySelector('#finite-host').contains(content)
        const overlayInHost = document.querySelector('#finite-host').contains(overlay)
        const sideAttribute = content.getAttribute('data-side')
        const direction = content.closest('[dir]')?.getAttribute('dir') ?? document.documentElement.getAttribute('dir') ?? 'ltr'
        const portalNodes = [...document.querySelectorAll('#candidate-sidebar[role="dialog"], [data-slot="sheet-overlay"]')]
        return { host: { left: host.left, right: host.right, top: host.top, bottom: host.bottom }, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, overlayRect: { left: overlayRect.left, right: overlayRect.right, top: overlayRect.top, bottom: overlayRect.bottom }, inHost, overlayInHost, portalNodeCount: portalNodes.length, allPortalNodesInHost: portalNodes.every(node => document.querySelector('#finite-host').contains(node)), sideAttribute, direction, requested: { side, dir } }
      }, { side, dir })
      assert.ok(result.inHost, 'Sheet portal must mount in supplied finite host')
      assert.ok(result.overlayInHost && result.allPortalNodesInHost && result.portalNodeCount === 2, `Sheet overlay/content leaked outside supplied portal container: ${JSON.stringify(result)}`)
      assert.ok(result.rect.left >= result.host.left - tolerance && result.rect.right <= result.host.right + tolerance && result.rect.top >= result.host.top - tolerance && result.rect.bottom <= result.host.bottom + tolerance, `Sheet escaped finite host: ${JSON.stringify(result)}`)
      assert.ok(result.overlayRect.left >= result.host.left - tolerance && result.overlayRect.right <= result.host.right + tolerance && result.overlayRect.top >= result.host.top - tolerance && result.overlayRect.bottom <= result.host.bottom + tolerance, `Sheet overlay escaped finite host: ${JSON.stringify(result)}`)
      assert.equal(result.sideAttribute, side)
      assert.equal(result.direction, dir)
      if (side === 'left') assert.ok(result.rect.left <= result.host.left + tolerance, `left Sheet was not physical left: ${JSON.stringify(result)}`)
      else assert.ok(result.rect.right >= result.host.right - tolerance, `right Sheet was not physical right: ${JSON.stringify(result)}`)
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      await wait(page, () => document.activeElement?.id === 'visible-sidebar-trigger')
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'visible-sidebar-trigger')
      assert.deepEqual(await state(page), { open: true, openMobile: false, isMobile: true, state: 'expanded' }, 'closing mobile must leave desktop open and close only mobile channel')
      matrix.push(result)
    }
    await page.locator('#visible-sidebar-trigger').click()
    await wait(page, () => JSON.parse(document.querySelector('#state-probe').textContent).openMobile === true)
    assert.deepEqual(await state(page), { open: true, openMobile: true, isMobile: true, state: 'expanded' })
    await page.evaluate(() => document.querySelector('#mobile-mode').click())
    await wait(page, () => JSON.parse(document.querySelector('#state-probe').textContent).isMobile === false)
    assert.deepEqual(await state(page), { open: true, openMobile: true, isMobile: false, state: 'expanded' }, 'switching back to desktop must preserve open mobile channel')
    const ambientAfter = await page.evaluate(() => ({ cookieWrites: window.__r4CookieWrites ?? [] }))
    assert.deepEqual(ambientAfter.cookieWrites, [], 'core wrote Sidebar persistence cookies')
    assert.deepEqual(errors, [])
    return { browser: browser.version(), viewportInvariant: true, explicitMobileTransition: true, stateChannelsPreserved: true, matrix, mountAmbient, cookiesUnchanged: true, initialGlobalKeyboardListeners: globalBeforeMobile, focusRestored: true }
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
  }
}
