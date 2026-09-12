import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex')
export async function packageProof(root, r4) {
  const installed = path.join(root, 'node_modules/@adc/shadcn-design-system')
  const pkg = read(path.join(installed, 'package.json'))
  const lock = read(path.join(root, 'package-lock.json'))
  const lockEntry = lock.packages['node_modules/@adc/shadcn-design-system']
  const consumer = read(path.join(root, 'package.json'))
  assert.equal(pkg.name, '@adc/shadcn-design-system')
  assert.equal(pkg.version, '0.0.0-release.4')
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './release', './styles.css'])
  assert.equal(consumer.dependencies['@adc/shadcn-design-system'], `file:${r4.tarball}`)
  assert.equal(lockEntry.resolved, `file:${r4.tarball}`)
  assert.equal(lockEntry.integrity, r4.integrity)
  assert.equal(digest(r4.tarball), r4.tarballSha256)
  assert.equal(consumer.workspaces, undefined)
  for (const [name, entry] of Object.entries(lock.packages)) { assert.ok(!entry.link, `workspace/link: ${name}`); if (entry.resolved?.startsWith('file:')) assert.equal(name, 'node_modules/@adc/shadcn-design-system') }
  const require = createRequire(path.join(root, 'package.json'))
  const dsRequire = createRequire(path.join(installed, 'package.json'))
  const resolutions = Object.fromEntries(['@adc/shadcn-design-system', '@adc/shadcn-design-system/styles.css', '@adc/shadcn-design-system/release'].map(name => [name, fileURLToPath(import.meta.resolve(name))]))
  for (const resolved of Object.values(resolutions)) { assert.ok(realpathSync(resolved).startsWith(`${installed}/`), `producer/source alias resolved: ${resolved}`); assert.ok(!realpathSync(resolved).includes('/src/'), `producer source resolved: ${resolved}`) }
  for (const name of ['package.json', 'src/package/index.ts', 'dist-library/index.js', 'validator']) assert.throws(() => import.meta.resolve(`@adc/shadcn-design-system/${name}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
  const library = await import('@adc/shadcn-design-system')
  const releaseApi = await import('@adc/shadcn-design-system/release')
  const release = releaseApi.getExecutableRelease()
  assert.equal(release.releaseId, r4.releaseId)
  assert.equal(release.sha256, r4.payloadSha256)
  assert.equal(release.packageIdentity.version, pkg.version)
  assert.ok(Object.keys(library).includes('SidebarProvider') && Object.keys(library).includes('Sidebar'))
  const runtimeRoots = { react: [], 'react-dom': [] }
  function walk(directory) { for (const item of readdirSync(directory, { withFileTypes: true })) { const target = path.join(directory, item.name); if (item.isDirectory()) { if (item.name in runtimeRoots && path.basename(directory) === 'node_modules') runtimeRoots[item.name].push(target); walk(target) } } }
  walk(path.join(root, 'node_modules'))
  for (const name of ['react', 'react-dom']) { assert.deepEqual(runtimeRoots[name], [path.join(root, 'node_modules', name)], `duplicate physical ${name} runtime`); assert.equal(read(path.join(runtimeRoots[name][0], 'package.json')).version, '18.3.1'); assert.equal(require.resolve(name), dsRequire.resolve(name), `${name} resolves differently for package`); assert.equal(pkg.peerDependencies[name], '18.3.1') }
  return { installed: realpathSync(installed), resolutions, packageVersion: pkg.version, releaseId: release.releaseId, payloadSha256: release.sha256, lock: { resolved: lockEntry.resolved, integrity: lockEntry.integrity }, runtimeRoots }
}

export function graphProof(root) {
  const graph = read(path.join(root, 'module-graph.json'))
  for (const node of graph) { const id = node.id.replace(/^\0/, '').split('?')[0]; if (path.isAbsolute(id)) assert.ok(id.startsWith(`${root}/`), `module outside isolated consumer: ${id}`); assert.ok(!node.external, `unbundled external: ${node.id}`); assert.ok(!id.includes('/src/package/'), `producer source in graph: ${id}`) }
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/index.js')))
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/release.js')))
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/styles.css')))
  return { modules: graph.length }
}
