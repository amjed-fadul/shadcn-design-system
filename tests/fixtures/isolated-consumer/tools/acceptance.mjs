import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { verifyInstalledBytes } from './verify-bytes.mjs'
import { packageProof, graphProof } from './package-proof.mjs'
import { typeProof } from './type-proof.mjs'
import { browserProof } from './browser-proof.mjs'

const root = process.cwd()
const expected = JSON.parse(readFileSync('expectations.json'))
const manifest = JSON.parse(readFileSync('candidate/distribution-manifest.json'))
const input = { installed: path.join(root, 'node_modules/@adc/shadcn-design-system'), tarball: path.join(root, 'candidate', manifest.tarball.filename), manifest: path.join(root, 'candidate/distribution-manifest.json'), manifestSha256: process.env.TASK63_MANIFEST_SHA256 }
const report = { success: false, node: process.versions.node, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() }
const save = () => writeFileSync('evidence.json', JSON.stringify(report, null, 2) + '\n')
async function phase(name, work) {
  console.log(`Starting ${name}`)
  const result = await work()
  report[name] = result
  save()
  console.log(`Passed ${name}`)
  return result
}
try {
  assert.equal(report.node, '22.18.0')
  assert.equal(report.npm, '10.9.3')
  await phase('installedBytes', () => verifyInstalledBytes(input))
  await phase('package', () => packageProof(root, expected))
  await phase('types', () => typeProof(root))
  await phase('strictTypecheck', () => execFileSync('npm', ['run', 'typecheck'], { encoding: 'utf8' }))
  await phase('productionBuild', () => execFileSync('npm', ['run', 'build'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
  await phase('graph', () => graphProof(root))
  console.log('Starting Chromium proof')
  report.browser = await browserProof(expected)
  save()
  console.log(report.browser.blockers.length ? 'Chromium found blocking regressions; completing remaining evidence' : 'Passed Chromium proof')
  await phase('tamper', () => {
    const results = []
    function reject(name, mutation, pattern) {
      const directory = path.join(root, 'tamper', name)
      mkdirSync(directory, { recursive: true })
      const copy = { ...input, installed: path.join(directory, 'installed'), tarball: path.join(directory, manifest.tarball.filename), manifest: path.join(directory, 'distribution-manifest.json') }
      cpSync(input.installed, copy.installed, { recursive: true })
      cpSync(input.tarball, copy.tarball)
      cpSync(input.manifest, copy.manifest)
      mutation(copy)
      let rejection
      assert.throws(() => verifyInstalledBytes(copy), error => { rejection = error.message; return pattern.test(error.message) })
      results.push({ name, rejection })
    }
    for (const [name, file] of [['javascript', 'dist-library/index.js'], ['css', 'dist-library/styles.css'], ['declarations', 'dist-library/types/src/components/ui/button.d.ts'], ['package-json', 'package.json'], ['notices', 'dist-library/THIRD_PARTY_LICENSES.txt']]) {
      reject(name, copy => {
        const target = path.join(copy.installed, file)
        const bytes = readFileSync(target)
        bytes[0] ^= 1 // same-size corruption, so the digest must catch it
        writeFileSync(target, bytes)
      }, /INSTALLED_BYTE_MISMATCH/)
    }
    reject('release-data', copy => {
      const target = path.join(copy.installed, 'dist-library/release.js')
      const source = readFileSync(target, 'utf8')
      assert.ok(source.includes(expected.releaseId))
      writeFileSync(target, source.replaceAll(expected.releaseId, 'shadcn-radix-release-bad'))
    }, /INSTALLED_BYTE_MISMATCH/)
    reject('wrong-tarball', copy => { const bytes = readFileSync(copy.tarball); bytes[bytes.length - 1] ^= 1; writeFileSync(copy.tarball, bytes) }, /TARBALL_IDENTITY_MISMATCH/)
    reject('wrong-manifest-digest', copy => { copy.manifestSha256 = '0'.repeat(64) }, /MANIFEST_HASH_MISMATCH/)
    reject('modified-manifest', copy => { writeFileSync(copy.manifest, readFileSync(copy.manifest, 'utf8') + ' ') }, /MANIFEST_HASH_MISMATCH/)
    return results
  })
  await phase('finalInstalledBytes', () => verifyInstalledBytes(input))
  assert.deepEqual(report.browser.blockers, [], 'Browser regressions block Task 6.3')
  report.success = true
  save()
  console.log(`Task 6.3 isolated consumer passed: ${root}`)
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }
  save()
  throw error
}
