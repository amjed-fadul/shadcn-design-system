// One bounded reconciliation: only the six reviewed ref-forwarding facts may change.
// This does not weaken the normal generator's unchanged-projection gate.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
const root = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(root)
const releasePath = 'provenance/releases/shadcn-radix-release-001.json'
const baseline = JSON.parse(execFileSync('git', ['show', `a07117fe380ec1fc8527641817e8547a2bb9d540:${releasePath}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }))
assert.equal(baseline.sha256, '5444a204b28cc8a5046a8e2d2357140dd13e1a75ea8be1ea4b5e0814d6e3d73f')
const expected = structuredClone(baseline.projection)
const changedExports = [['button', 'Button'], ['dialog', 'DialogTrigger'], ['sidebar', 'SidebarMenuButton'], ['sidebar', 'SidebarMenuAction'], ['dropdown-menu', 'DropdownMenuTrigger'], ['sheet', 'SheetTrigger']]
for (const [family, name] of changedExports) {
  const slots = expected.exports[`${family}\0${name}`].component.slots
  assert.equal(slots.length, 1)
  assert.equal(slots[0].refForwarding, 'unresolved')
  slots[0].refForwarding = 'supported'
}
const { module: components } = await runnerImport('./src/contracts/components/canonical-loader.ts', { configFile: false })
const { module: tokens } = await runnerImport('./src/contracts/tokens/contract.ts', { configFile: false })
const { module: releaseTools } = await runnerImport('./src/validator/release.ts', { configFile: false })
const { module: identity } = await runnerImport('./scripts/release-inputs.ts', { configFile: false })
const release = releaseTools.createExecutableRelease({ componentContracts: components.loadComponentContracts(), tokenContract: tokens.getTokenContract() }, undefined, { packageIdentity: identity.packageIdentity(root), implementationInputs: identity.createImplementationManifest(root) })
assert.deepEqual(release.projection, expected, 'STOP: executable projection changed beyond the six reviewed ref facts')
assert.equal(release.releaseId, baseline.releaseId)
const previous = JSON.parse(readFileSync(releasePath))
const priorDigest = process.argv[2] ?? baseline.sha256
assert.equal(previous.sha256, priorDigest, 'STOP: existing release must match the independently retained prior digest')
const priorFour = structuredClone(expected)
for (const [family, name] of changedExports.slice(4)) priorFour.exports[`${family}\0${name}`].component.slots[0].refForwarding = 'unresolved'
const previousProjection = priorDigest === baseline.sha256 ? baseline.projection : priorDigest === 'a3bf332eed77b7ad0002b5269b90037c3d081a79ed635bbde90bda8f84b46f08' ? priorFour : expected
assert.deepEqual(previous.projection, previousProjection)
assert.deepEqual(release.packageIdentity, baseline.packageIdentity)
writeFileSync(releasePath, JSON.stringify(release, null, 2) + '\n')
console.log(JSON.stringify({ oldSha256: baseline.sha256, newSha256: release.sha256, projectionDelta: changedExports.map(([family, name]) => ({ family, name, field: 'component.slots[0].refForwarding', before: 'unresolved', after: 'supported' })) }, null, 2))
