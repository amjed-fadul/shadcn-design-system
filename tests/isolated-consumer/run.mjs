import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '../fixtures/isolated-consumer/tools/verify-bytes.mjs'

const r4 = { directory: '/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004', tarball: '/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz', tarballSha256: 'c7368978a0a5c8e75a871acb4624142c13d36e5934bc670e69adfe2c07f64252', manifestSha256: 'ea074153c56bf6a012a0e9924369b9aa3a82a777e14b17ffade06b0b6349e46f', integrity: 'sha512-AkGpDll0cbYA4DEhEc0c6tl5+Ql4li9wf/ffAafzSokmI3K7ZBvFzLROjN9fCCR6XWBLC7jv8TxeNmKvEkyd2Q==', releaseId: 'shadcn-radix-release-004', payloadSha256: 'e0332a1103f1faa7a92e81c1815ffcfc4e4cbcdadeea7822391221b73c2b52a2' }
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
const fixture = path.join(root, 'tests/fixtures/isolated-consumer')
const args = process.argv.slice(2)
assert.deepEqual(args.slice(0, 1), ['--tarball'], 'Use --tarball <literal R4 tarball>')
assert.equal(args.length, 2, 'Use exactly --tarball <literal R4 tarball>')
assert.equal(path.resolve(args[1]), r4.tarball, 'Only the approved literal R4 tarball is accepted')
assert.equal(process.versions.node, '22.18.0')
assert.equal(execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), '10.9.3')
assert.equal(sha256(readFileSync(r4.tarball)), r4.tarballSha256, 'R4 tarball SHA-256 mismatch')
const manifestPath = path.join(r4.directory, 'distribution-manifest.json')
assert.equal(sha256(readFileSync(manifestPath)), r4.manifestSha256, 'R4 manifest SHA-256 mismatch')
const manifest = JSON.parse(readFileSync(manifestPath))
assert.deepEqual(manifest.tarball, { filename: path.basename(r4.tarball), sha256: r4.tarballSha256, integrity: r4.integrity })
assert.deepEqual(manifest.release, { id: r4.releaseId, payloadSha256: r4.payloadSha256 })

// Runs before installation, so an old fixture must fail closed instead of
// silently falling back to a copied candidate or a workspace package.
const fixturePackage = JSON.parse(readFileSync(path.join(fixture, 'package.json')))
const fixtureLock = JSON.parse(readFileSync(path.join(fixture, 'package-lock.json')))
const lockEntry = fixtureLock.packages['node_modules/@adc/shadcn-design-system']
assert.equal(fixturePackage.dependencies['@adc/shadcn-design-system'], `file:${r4.tarball}`, 'Fixture dependency must name literal R4 tarball')
assert.equal(lockEntry.resolved, `file:${r4.tarball}`, 'Fixture lock must name literal R4 tarball')
assert.equal(lockEntry.integrity, r4.integrity, 'Fixture lock must retain approved R4 integrity')

const evidenceRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'r4-isolated-consumer-')))
const consumer = path.join(evidenceRoot, 'consumer')
cpSync(fixture, consumer, { recursive: true })
function materialize(directory) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) materialize(target); else if (target.endsWith('.template')) renameSync(target, target.slice(0, -'.template'.length)) } }
materialize(consumer)
writeFileSync(path.join(consumer, 'r4.json'), JSON.stringify(r4, null, 2) + '\n')
const env = { ...process.env }
for (const name of ['NODE_PATH', 'NODE_OPTIONS', 'INIT_CWD', 'npm_config_workspace', 'npm_config_workspaces', 'npm_config_prefix']) delete env[name]
const run = (command, argv) => execFileSync(command, argv, { cwd: consumer, env, encoding: 'utf8', timeout: 240_000, maxBuffer: 32 * 1024 * 1024 })
const gates = {}
const gate = (name, command, argv) => gates[name] = run(command, argv)
console.log(`Installing literal R4 tarball into ${consumer}`)
gate('install', 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
gate('package', process.execPath, ['--input-type=module', '--eval', "import {packageProof} from './tools/package-proof.mjs'; import {readFileSync} from 'node:fs'; console.log(JSON.stringify(await packageProof(process.cwd(),JSON.parse(readFileSync('r4.json')))))"])
gate('typecheck', 'npm', ['run', 'typecheck'])
gate('build', 'npm', ['run', 'build'])
gate('graph', process.execPath, ['--input-type=module', '--eval', "import {graphProof} from './tools/package-proof.mjs'; console.log(JSON.stringify(graphProof(process.cwd())))"])
gate('browser', process.execPath, ['--input-type=module', '--eval', "import {browserProof} from './tools/browser-proof.mjs'; import {readFileSync} from 'node:fs'; console.log(JSON.stringify(await browserProof(JSON.parse(readFileSync('r4.json')))))"])
const evidence = { success: true, node: process.versions.node, npm: '10.9.3', r4, consumer, gates }
writeFileSync(path.join(evidenceRoot, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify({ success: true, evidence: path.join(evidenceRoot, 'evidence.json'), consumer }, null, 2))
