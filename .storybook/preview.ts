import { withThemeByClassName } from "@storybook/addon-themes"
import type { Decorator, Preview } from "@storybook/react-vite"
import { Direction } from "radix-ui"
import { createElement, useEffect } from "react"

import "../src/index.css"

const withPreviewLandmark: Decorator = (Story, context) => {
  if (context.parameters.providesDocumentLandmarks) {
    return Story()
  }

  return createElement("main", { "aria-label": "Story preview" }, Story())
}

const withDirection: Decorator = (Story, context) => {
  const dir = context.globals.direction === "rtl" ? "rtl" : "ltr"
  function DirectionPreview() {
    useEffect(() => { document.documentElement.dir = dir }, [])
    return createElement(Direction.DirectionProvider, { dir }, createElement("div", { dir }, Story()))
  }
  return createElement(DirectionPreview)
}

const preview: Preview = {
  globalTypes: {
    direction: { description: "Reading direction", toolbar: { icon: "transfer", items: ["ltr", "rtl"] } },
  },
  decorators: [
    withPreviewLandmark,
    withDirection,
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
    direction: "ltr",
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
