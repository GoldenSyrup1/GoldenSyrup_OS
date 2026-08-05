import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8')

// Vitest runs with `css: false`, so a rendered component can't tell us what the
// controls actually look like. These assert the override survives instead —
// enough to catch someone deleting it, which is how the bug came back the first
// time.
describe('React Flow controls contrast', () => {
  it('pins the controls icon colour instead of inheriting the body colour', () => {
    const rule = css.match(/\.react-flow__controls\s*\{[^}]*\}/)?.[0]
    expect(rule).toBeDefined()
    expect(rule).toMatch(/--xy-controls-button-color:\s*#000/)
    expect(rule).toMatch(/--xy-controls-button-color-hover:\s*#000/)
  })

  it('does not leave the icons on the pale body colour, which is the bug', () => {
    // #e6edf3 on React Flow's #fefefe button is the invisible combination.
    const rule = css.match(/\.react-flow__controls\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toMatch(/#e6edf3/i)
  })
})
