import { withThemeByClassName } from "@storybook/addon-themes"
import type { Decorator, Preview } from "@storybook/react-vite"
import { createElement } from "react"

import "../src/index.css"

const withPreviewLandmark: Decorator = (Story, context) => {
  if (context.parameters.providesDocumentLandmarks) {
    return Story()
  }

  return createElement("main", { "aria-label": "Story preview" }, Story())
}

const preview: Preview = {
  decorators: [
    withPreviewLandmark,
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    a11y: {
      test: "error",
      config: {
        rules: [{ id: "region", enabled: true }],
      },
    },
    controls: {
      expanded: true,
    },
  },
}

export default preview
