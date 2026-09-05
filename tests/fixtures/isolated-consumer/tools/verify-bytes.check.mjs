import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { verifyInstalledBytes } from './verify-bytes.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'task63-verifier-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const installed = path.join(root, 'installed')
  mkdirSync(installed)
  const bytes = Buffer.from('candidate tarball')
  const tarball = path.join(root, 'candidate.tgz')
  writeFileSync(tarball, bytes)
  const files = { 'package.json': '{}', 'index.js': 'export {}', 'styles.css': ':root{}', 'index.d.ts': 'export {}', 'release.js': 'export const release = {}', 'NOTICE.txt': 'notice' }
  for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(installed, name), contents)
  const manifest = path.join(root, 'distribution-manifest.json')
  const data = { schemaVersion: 1, tarball: { filename: 'candidate.tgz', sha256: hash(bytes), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` }, files: Object.entries(files).map(([name, contents]) => ({ path: name, size: Buffer.byteLength(contents), sha256: hash(contents) })) }
  const manifestBytes = JSON.stringify(data)
  writeFileSync(manifest, manifestBytes)
  return { root, installed, tarball, manifest, manifestSha256: hash(manifestBytes), data }
}
test('accepts the complete unchanged installed inventory', t => {
  const input = fixture(t)
  assert.equal(verifyInstalledBytes(input).fileCount, 6)
})
for (const name of ['index.js', 'styles.css', 'index.d.ts', 'release.js', 'package.json', 'NOTICE.txt']) {
  test(`rejects modified ${name} bytes`, t => {
    const input = fixture(t)
    writeFileSync(path.join(input.installed, name), 'tampered')
    assert.throws(() => verifyInstalledBytes(input), /INSTALLED_BYTE_MISMATCH/)
  })
}
test('rejects wrong tarball bytes', t => {
  const input = fixture(t)
  writeFileSync(input.tarball, 'wrong artifact')
  assert.throws(() => verifyInstalledBytes(input), /TARBALL_IDENTITY_MISMATCH/)
})
test('requires the independently retained manifest digest', t => {
  const input = fixture(t)
  assert.throws(() => verifyInstalledBytes({ ...input, manifestSha256: '0'.repeat(64) }), /MANIFEST_HASH_MISMATCH/)
  writeFileSync(input.manifest, JSON.stringify({ ...input.data, files: [] }))
  assert.throws(() => verifyInstalledBytes(input), /MANIFEST_HASH_MISMATCH/)
})
test('rejects missing and extra installed files', t => {
  const input = fixture(t)
  writeFileSync(path.join(input.installed, 'extra.js'), 'extra')
  assert.throws(() => verifyInstalledBytes(input), /INSTALLED_INVENTORY_MISMATCH/)
  rmSync(path.join(input.installed, 'extra.js'))
  rmSync(path.join(input.installed, 'index.js'))
  assert.throws(() => verifyInstalledBytes(input), /INSTALLED_INVENTORY_MISMATCH/)
})
test('rejects symlinks even if target bytes match', t => {
  const input = fixture(t)
  rmSync(path.join(input.installed, 'index.js'))
  writeFileSync(path.join(input.root, 'outside.js'), 'export {}')
  symlinkSync(path.join(input.root, 'outside.js'), path.join(input.installed, 'index.js'))
  assert.throws(() => verifyInstalledBytes(input), /INSTALLED_NON_REGULAR/)
})
test('rejects traversal in a manifest even when its digest is supplied', t => {
  const input = fixture(t)
  input.data.files[0].path = '../outside'
  const bytes = JSON.stringify(input.data)
  writeFileSync(input.manifest, bytes)
  assert.throws(() => verifyInstalledBytes({ ...input, manifestSha256: hash(bytes) }), /MANIFEST_PATH_INVALID/)
})
