import { defineConfig } from 'vite'
import { writeFileSync } from 'node:fs'
export default defineConfig({
  plugins: [{
    name: 'record-consumer-module-graph',
    generateBundle() {
      writeFileSync('module-graph.json', JSON.stringify([...this.getModuleIds()].map(id => {
        const info = this.getModuleInfo(id)
        return { id, imports: info.importedIds, dynamicImports: info.dynamicallyImportedIds, external: info.isExternal }
      }), null, 2))
    },
  }],
})
