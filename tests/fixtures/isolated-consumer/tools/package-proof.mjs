import assert from 'node:assert/strict'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { regularFiles, sha256 } from './verify-bytes.mjs'

const read = file => JSON.parse(readFileSync(file, 'utf8'))
export async function packageProof(root, expected) {
  const library = await import('@adc/shadcn-design-system')
  const releaseApi = await import('@adc/shadcn-design-system/release')
  const require = createRequire(path.join(root, 'package.json'))
  const installed = path.join(root, 'node_modules/@adc/shadcn-design-system')
  const pkg = read(path.join(installed, 'package.json'))
  assert.equal(pkg.name, '@adc/shadcn-design-system')
  assert.equal(pkg.version, '0.0.0-release.1')
  assert.deepEqual(pkg.exports, expected.packageIdentity.publicEntrypoints)
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './release', './styles.css'])
  const resolutions = Object.fromEntries(['@adc/shadcn-design-system', '@adc/shadcn-design-system/release', '@adc/shadcn-design-system/styles.css'].map(name => [name, fileURLToPath(import.meta.resolve(name))]))
  for (const resolution of Object.values(resolutions)) assert.ok(realpathSync(resolution).startsWith(`${installed}/`))
  for (const name of ['package.json', 'dist-library/index.js', 'src/package/index.ts', 'validator', 'nonexistent']) {
    assert.throws(() => import.meta.resolve(`@adc/shadcn-design-system/${name}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
  }
  assert.deepEqual(Object.keys(library).sort(), expected.exports)
  assert.equal(Object.keys(library).length, 107)
  assert.deepEqual(Object.keys(releaseApi).sort(), ['getComponentContracts', 'getExecutableRelease', 'getTokenContract'])
  const release = releaseApi.getExecutableRelease()
  const components = releaseApi.getComponentContracts()
  const tokens = releaseApi.getTokenContract()
  assert.equal(release.releaseId, expected.releaseId)
  assert.equal(release.sha256, expected.releaseSha256)
  assert.deepEqual(release.packageIdentity, expected.packageIdentity)
  assert.deepEqual(Object.values(release.projection.exports).map(entry => entry.name).sort(), expected.exports)
  assert.equal(components.families.length, 19)
  assert.equal(tokens.tokens.length, expected.tokenCount)
  assert.equal(sha256(JSON.stringify(release)), expected.releaseDocumentSha256)
  assert.equal(sha256(JSON.stringify(components)), expected.componentsSha256)
  assert.equal(sha256(JSON.stringify(tokens)), expected.tokensSha256)
  assert.ok(Object.isFrozen(tokens.tokens[0]))

  const lock = read(path.join(root, 'package-lock.json'))
  const installedLock = lock.packages['node_modules/@adc/shadcn-design-system']
  const manifest = read(path.join(root, 'candidate/distribution-manifest.json'))
  assert.equal(installedLock.resolved, `file:candidate/${manifest.tarball.filename}`)
  assert.equal(installedLock.integrity, manifest.tarball.integrity)
  assert.equal(lock.packages[''].dependencies['@adc/shadcn-design-system'], installedLock.resolved)
  const consumer = read(path.join(root, 'package.json'))
  assert.equal(consumer.workspaces, undefined)
  for (const [name, entry] of Object.entries(lock.packages)) {
    assert.ok(!entry.link, `workspace/link: ${name}`)
    assert.ok(!name.includes('tailwind'), `Tailwind installed: ${name}`)
    if (entry.resolved?.startsWith('file:')) assert.equal(name, 'node_modules/@adc/shadcn-design-system')
  }
  const reactRoots = { react: [], 'react-dom': [] }
  const symlinks = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const target = realpathSync(file)
        assert.ok(target.startsWith(`${root}/`), `external symlink: ${file} -> ${target}`)
        symlinks.push({ file, target })
      } else if (entry.isDirectory()) {
        if (entry.name in reactRoots && path.basename(directory) === 'node_modules') reactRoots[entry.name].push(file)
        walk(file)
      }
    }
  }
  walk(path.join(root, 'node_modules'))
  const dsRequire = createRequire(path.join(installed, 'package.json'))
  const reactResolution = {}
  for (const name of ['react', 'react-dom']) {
    assert.deepEqual(reactRoots[name], [path.join(root, 'node_modules', name)])
    assert.equal(read(path.join(reactRoots[name][0], 'package.json')).version, '18.3.1')
    assert.equal(require.resolve(name), dsRequire.resolve(name))
    assert.equal(pkg.dependencies?.[name], undefined)
    assert.equal(pkg.peerDependencies[name], '18.3.1')
    reactResolution[name] = require.resolve(name)
  }
  const dsImports = []
  for (const file of regularFiles(installed)) {
    if (!/\.(js|css|ts|json)$/.test(file)) continue
    const contents = readFileSync(path.join(installed, file), 'utf8')
    assert.doesNotMatch(contents, /\/Users\/|file:\/\/|(?:from\s*|import\()["']@\//)
    if (!file.endsWith('.js')) continue
    assert.doesNotMatch(contents, /node:|__vite-browser-external|react\.production\.min|react\.development|__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/)
    const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
      const spec = node.moduleSpecifier
      if (!spec || !ts.isStringLiteral(spec)) continue
      dsImports.push({ file, specifier: spec.text })
      if (!spec.text.startsWith('.')) assert.match(spec.text, /^(react|react-dom)(\/|$)/)
    }
  }
  const npmTree = execFileSync('npm', ['ls', 'react', 'react-dom', '--all'], { cwd: root, encoding: 'utf8' })
  return { installed, resolutions, exports: Object.keys(library).sort(), releaseId: release.releaseId, releaseSha256: release.sha256, familyCount: components.families.length, tokenCount: tokens.tokens.length, tokensSha256: expected.tokensSha256, installedLock, reactRoots, reactResolution, symlinks, dsImports, npmTree }
}

export function graphProof(root) {
  const graph = read(path.join(root, 'module-graph.json'))
  const runtimeRoots = { react: new Set(), 'react-dom': new Set() }
  for (const node of graph) {
    const id = node.id.replace(/^\0/, '').split('?')[0]
    if (path.isAbsolute(id)) assert.ok(id.startsWith(`${root}/`), `Module outside consumer: ${id}`)
    assert.ok(!node.external, `Unbundled external: ${node.id}`)
    for (const name of Object.keys(runtimeRoots)) {
      const marker = `/node_modules/${name}/`
      const index = id.lastIndexOf(marker)
      if (index >= 0) runtimeRoots[name].add(id.slice(0, index + marker.length - 1))
    }
  }
  for (const [name, roots] of Object.entries(runtimeRoots)) assert.deepEqual([...roots], [path.join(root, 'node_modules', name)])
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/index.js')))
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/release.js')))
  assert.ok(graph.some(node => node.id.includes('/@adc/shadcn-design-system/dist-library/styles.css')))
  return { modules: graph.length, runtimeRoots: Object.fromEntries(Object.entries(runtimeRoots).map(([key, value]) => [key, [...value]])) }
}
