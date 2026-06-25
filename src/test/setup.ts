import '@testing-library/jest-dom/vitest'

// jsdom lacks ResizeObserver / matchMedia, which @xyflow/react requires.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as never
}

// React Flow measures DOM rects; jsdom returns zeros — provide a stub size.
if (!('DOMMatrixReadOnly' in globalThis)) {
  ;(globalThis as Record<string, unknown>).DOMMatrixReadOnly = class {
    m22 = 1
  }
}
