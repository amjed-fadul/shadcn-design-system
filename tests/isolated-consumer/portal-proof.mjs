// Standalone entrypoint for the R4 finite-host Chromium matrix. The runner is
// intentionally reused so package identity and browser evidence cannot drift.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const tarball = '/Users/amjedfadul/.artifacts/shadcn-design-system/shadcn-radix-release-004/adc-shadcn-design-system-0.0.0-release.4.tgz'
assert.deepEqual(process.argv.slice(2), ['--tarball', tarball], 'Use --tarball <literal R4 tarball>')
const root = path.dirname(fileURLToPath(import.meta.url))
process.stdout.write(execFileSync(process.execPath, [path.join(root, 'run.mjs'), '--tarball', tarball], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))
