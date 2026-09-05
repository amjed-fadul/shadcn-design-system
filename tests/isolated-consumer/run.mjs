import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from '../fixtures/isolated-consumer/tools/verify-bytes.mjs'

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
const fixture = path.join(root, 'tests/fixtures/isolated-consumer')
const args = process.argv.slice(2)
function option(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1] }
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--candidate', '--manifest-sha256', '--expectations'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'), 'Use [--candidate DIR --manifest-sha256 DIGEST]')
}
const expectationsPath = option('--expectations') ? path.resolve(option('--expectations')) : path.join(fixture, 'expectations.json')
const expected = JSON.parse(readFileSync(expectationsPath))
const env = { ...process.env }
for (const name of ['NODE_PATH', 'NODE_OPTIONS', 'INIT_CWD', 'npm_config_workspace', 'npm_config_workspaces', 'npm_config_prefix']) delete env[name]
const run = (command, argv, options = {}) => execFileSync(command, argv, { cwd: root, env, encoding: 'utf8', timeout: 240_000, maxBuffer: 32 * 1024 * 1024, ...options })
assert.equal(process.versions.node, '22.18.0')
assert.equal(run('npm', ['--version']).trim(), '10.9.3')
const harnessHead = run('git', ['rev-parse', 'HEAD']).trim()
run('git', ['merge-base', '--is-ancestor', expected.sourceCommit, harnessHead])
assert.deepEqual(readdirSync(path.join(root, 'provenance/releases')), ['shadcn-radix-release-001.json'])
const evidenceRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'task63-run-')))
console.log(`Evidence directory: ${evidenceRoot}`)
const logRun = (name, command, argv, options) => {
  try { const result = run(command, argv, options); writeFileSync(path.join(evidenceRoot, `${name}.log`), result); return result }
  catch (error) { writeFileSync(path.join(evidenceRoot, `${name}.log`), `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.stack}`); throw error }
}
logRun('release-verify', 'npm', ['run', 'release:verify', '--', '--release-sha256', expected.releaseSha256])
let candidate = option('--candidate')
let digest = option('--manifest-sha256')
if (candidate) {
  assert.ok(digest, 'An existing candidate requires an independently retained --manifest-sha256')
  candidate = realpathSync(candidate)
} else {
  assert.equal(digest, undefined)
  candidate = path.join(evidenceRoot, 'generated-candidate')
  mkdirSync(candidate)
  // The current release verifier also rejects drift in every committed package input.
  logRun('candidate-generate', 'npm', ['run', 'candidate:generate', '--', '--output', candidate])
  digest = sha256(readFileSync(path.join(candidate, 'distribution-manifest.json')))
}
assert.ok(!candidate.startsWith(`${root}/`))
const manifestPath = path.join(candidate, 'distribution-manifest.json')
assert.equal(sha256(readFileSync(manifestPath)), digest, 'MANIFEST_HASH_MISMATCH')
const manifest = JSON.parse(readFileSync(manifestPath))
logRun('candidate-verify', 'npm', ['run', 'candidate:verify', '--', '--manifest', manifestPath, '--tarball', path.join(candidate, manifest.tarball.filename), '--manifest-sha256', digest])
const consumer = path.join(evidenceRoot, 'consumer')
cpSync(fixture, consumer, { recursive: true })
function materialize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) materialize(file)
    else if (entry.name.endsWith('.template')) renameSync(file, file.slice(0, -'.template'.length))
  }
}
materialize(consumer)
writeFileSync(path.join(consumer, 'expectations.json'), JSON.stringify(expected, null, 2) + '\n')
mkdirSync(path.join(consumer, 'candidate'))
for (const name of [manifest.tarball.filename, 'distribution-manifest.json']) cpSync(path.join(candidate, name), path.join(consumer, 'candidate', name))
const metadata = { expectationsPath, expectationsSha256: sha256(readFileSync(expectationsPath)), sourceCommit: expected.sourceCommit, harnessHead, candidate, manifestSha256: digest, tarball: manifest.tarball, fileCount: manifest.files.length, consumer }
writeFileSync(path.join(evidenceRoot, 'run.json'), JSON.stringify(metadata, null, 2))
console.log(`Installing tarball into ${consumer}`)
const lock = JSON.parse(readFileSync(path.join(consumer, 'package-lock.json')))
if (expected.refRepair) {
  assert.equal(expected.tarballIntegrity, manifest.tarball.integrity, 'Repair expectations must bind the reviewed tarball')
  lock.packages['node_modules/@adc/shadcn-design-system'].integrity = expected.tarballIntegrity
  writeFileSync(path.join(consumer, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
}
assert.equal(lock.packages['node_modules/@adc/shadcn-design-system'].integrity, manifest.tarball.integrity, 'Fixture lock must name the reviewed tarball integrity')
logRun('install', 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumer })
// All consumer tools, including Chromium's driver, resolve from the new installation.
const worktrees = run('git', ['worktree', 'list', '--porcelain']).split('\n').filter(line => line.startsWith('worktree ')).map(line => realpathSync(line.slice(9)))
metadata.forbiddenWorktrees = worktrees
let command = process.execPath
let prefix = []
if (process.platform === 'darwin') {
  const profile = path.join(evidenceRoot, 'deny-worktrees.sb')
  writeFileSync(profile, `(version 1)\n(allow default)\n(deny file-read* ${worktrees.map(directory => `(subpath ${JSON.stringify(directory)})`).join(' ')})\n`)
  command = '/usr/bin/sandbox-exec'
  prefix = ['-f', profile, process.execPath]
  const probe = 'const fs = require("node:fs"); for (const file of process.argv.slice(1)) { try { fs.readFileSync(file); throw new Error("CHECKOUT_READ_WAS_ALLOWED: " + file) } catch (error) { if (error.code !== "EPERM" && error.code !== "EACCES") throw error; console.log("DENIED " + file) } }'
  metadata.accessDenial = logRun('checkout-denial', command, [...prefix, '-e', probe, ...worktrees.map(directory => path.join(directory, 'package.json'))], { cwd: consumer })
  metadata.isolation = 'macOS sandbox: all design-system worktree reads denied during consumer verification'
} else {
  metadata.isolation = 'Portable minimum: external install, symlink/lockfile checks, TypeScript source closure, Vite module closure and browser resource checks. No OS sandbox on this platform.'
}
writeFileSync(path.join(evidenceRoot, 'run.json'), JSON.stringify(metadata, null, 2))
console.log(metadata.isolation)
logRun('verifier-tests', command, [...prefix, '--test', 'tools/verify-bytes.check.mjs'], { cwd: consumer })
logRun('consumer-acceptance', command, [...prefix, 'tools/acceptance.mjs'], { cwd: consumer, env: { ...env, TASK63_MANIFEST_SHA256: digest } })
assert.equal(JSON.parse(readFileSync(path.join(consumer, 'evidence.json'))).success, true)
assert.equal(sha256(readFileSync(manifestPath)), digest)
assert.equal(sha256(readFileSync(path.join(candidate, manifest.tarball.filename))), manifest.tarball.sha256)
console.log(JSON.stringify({ ...metadata, success: true, evidence: path.join(consumer, 'evidence.json') }, null, 2))
