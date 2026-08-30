import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
})
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
})
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => {},
})
Object.defineProperty(globalThis, "PointerEvent", {
  configurable: true,
  value: class PointerEvent extends MouseEvent {
    pointerType: string
    pointerId: number

    constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? "mouse"
      this.pointerId = init.pointerId ?? 1
    }
  },
})
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: query.includes("max-width") && window.innerWidth < 768,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
  }),
})

let mounted: Array<{ container: HTMLDivElement; root: Root }> = []

export function render(element: ReactNode) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)

  act(() => root.render(element))
  mounted.push({ container, root })

  return container
}

afterEach(() => {
  for (const { container, root } of mounted.reverse()) {
    act(() => root.unmount())
    container.remove()
  }
  mounted = []
  document.body.innerHTML = ""
})
