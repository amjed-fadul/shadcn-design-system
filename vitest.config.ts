import path from "node:path"
import { fileURLToPath } from "node:url"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { mergeConfig } from "vite"
import viteConfig from "./vite.config"
import { defineConfig } from "vitest/config"

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            setupFiles: ["./tests/yield-between-tests.ts"],
            // The in-process TypeScript contract analysis needs more than 3 GB of heap.
            // Pin it so the limit does not follow host RAM (about 2 GB on a 7 GB CI runner).
            execArgv: ["--max-old-space-size=4096"],
          },
        },
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  })
)
