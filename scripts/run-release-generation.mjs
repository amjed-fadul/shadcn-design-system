import { runnerImport } from "vite"
// Explicit generation only. Verification commands never import this script.
await runnerImport("./scripts/generate-executable-release.ts", { configFile: false })
