import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = message => { throw new Error(message) }
export function regularFiles(root, prefix = '') {
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail(`INSTALLED_NON_REGULAR: ${root}`)
  return readdirSync(root).flatMap(name => {
    const relative = prefix ? `${prefix}/${name}` : name
    const absolute = path.join(root, name)
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink()) fail(`INSTALLED_NON_REGULAR: ${relative}`)
    if (stat.isDirectory()) return regularFiles(absolute, relative)
    if (!stat.isFile()) fail(`INSTALLED_NON_REGULAR: ${relative}`)
    return [relative]
  }).sort()
}
export function verifyInstalledBytes({ installed, tarball, manifest, manifestSha256 }) {
  const manifestBytes = readFileSync(manifest)
  if (!/^[a-f0-9]{64}$/.test(manifestSha256 ?? '') || sha256(manifestBytes) !== manifestSha256) fail('MANIFEST_HASH_MISMATCH')
  const data = JSON.parse(manifestBytes)
  if (data.schemaVersion !== 1 || !Array.isArray(data.files) || !data.files.length) fail('MANIFEST_SCHEMA_INVALID')
  const bytes = readFileSync(tarball)
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (path.basename(tarball) !== data.tarball.filename || sha256(bytes) !== data.tarball.sha256 || integrity !== data.tarball.integrity) fail('TARBALL_IDENTITY_MISMATCH')
  const expected = data.files.map(file => {
    if (typeof file.path !== 'string' || file.path.includes('\\') || file.path.split('/').some(part => !part || part === '.' || part === '..')) fail('MANIFEST_PATH_INVALID')
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('MANIFEST_SCHEMA_INVALID')
    return file.path
  }).sort()
  if (new Set(expected).size !== expected.length) fail('MANIFEST_DUPLICATE_PATH')
  if (JSON.stringify(regularFiles(installed)) !== JSON.stringify(expected)) fail('INSTALLED_INVENTORY_MISMATCH')
  for (const file of data.files) {
    const contents = readFileSync(path.join(installed, file.path))
    if (contents.length !== file.size || sha256(contents) !== file.sha256) fail(`INSTALLED_BYTE_MISMATCH: ${file.path}`)
  }
  return { fileCount: data.files.length, files: expected, tarballSha256: data.tarball.sha256, integrity, manifestSha256 }
}
