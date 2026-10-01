import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const base = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6009'
const out = process.env.RELEASE009_BROWSER_OUTPUT ?? '/Users/amjedfadul/.artifacts/shadcn-design-system/release009-browser'
const story = process.env.RELEASE009_STORY ?? 'forms'
mkdirSync(out,{recursive:true})
const browser = await chromium.launch({headless:true})
const page = await browser.newPage({viewport:{width:1360,height:1100},deviceScaleFactor:1})
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){ if (!m.text().includes('Failed to load resource')) errors.push(m.text()) }})
const report=[]
async function paint(slot){return page.locator(`[data-slot="${slot}"]`).first().evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {height:r.height,width:r.width,radius:s.borderRadius,font:s.fontSize,weight:s.fontWeight,background:s.backgroundColor,color:s.color,shadow:s.boxShadow,transition:s.transitionDuration}})}
try {
for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']){
 const id=`system-product-ui--${story}`
 await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};direction:${dir}`,{waitUntil:'networkidle'})
 await page.locator('#storybook-root').waitFor();await page.evaluate(d=>{document.documentElement.dir=d},dir);await page.evaluate(()=>document.fonts.ready)
 assert.ok((await page.locator('#storybook-root').innerText()).trim().length>0,'Blank story')
 assert.equal(await page.locator('vite-error-overlay').count(),0)
 const record={story,theme,dir}
 if(story==='forms'){
  await page.locator('[data-slot="input"]').first().waitFor()
  record.button=await paint('button');record.input=await paint('input');record.group=await paint('input-group')
  assert.equal(record.button.height,32);assert.equal(record.input.height,32);assert.equal(record.button.radius,'6px');assert.equal(record.group.radius,'8px')
  const normal=page.locator('#profile-name');await normal.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab')
  record.focus=await normal.evaluate(e=>({visible:e.matches(':focus-visible'),shadow:getComputedStyle(e).boxShadow}))
  assert.ok(record.focus.visible);assert.ok(record.focus.shadow.includes('4px'),'2px ring plus 2px offset')
  await page.locator('#profile-email').focus();record.invalidFocus=await paint('input');record.invalidFocus=await page.locator('#profile-email').evaluate(e=>getComputedStyle(e).boxShadow);assert.ok(!record.invalidFocus.includes(' / 0.2'),'Invalid focus must remain solid');
  record.selected=await page.locator('[data-slot="toggle-group-item"][data-state="on"]').first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))
  await page.locator('[data-slot="input-group-control"]').first().focus();record.groupFocus=await paint('input-group');assert.ok(record.groupFocus.shadow.includes('4px'))
 }
 await page.screenshot({path:`${out}/${story}-${theme}-${dir}.png`,fullPage:true});report.push(record)
}
assert.deepEqual(errors,[])
writeFileSync(`${out}/${story}-report.json`,JSON.stringify({report,errors,browser:browser.version()},null,2)+'\n')
console.log(JSON.stringify({story,states:report.length,errors,screenshots:out},null,2))
} finally {await browser.close()}
