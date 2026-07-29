import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Architecture } from '../types'
import type { ArchitecturesApi } from '../hooks/useArchitectures'
import ArchInspector from './ArchInspector'

const arch: Architecture = {
  id: 'arch-1',
  name: 'WEPort',
  blocks: [
    { id: 'b1', kind: 'service', label: 'Booking API', x: 0, y: 0 },
    { id: 'b2', kind: 'image', label: 'Screenshot', x: 0, y: 0 },
  ],
  links: [{ id: 'l1', source: 'b1', target: 'b2', label: 'REST' }],
  createdAt: 1,
  updatedAt: 2,
  kinds: [{ id: 'kind-1', label: 'Pillar', color: '#39c5cf', icon: '🏛️' }],
}

/** Only the surface ArchInspector touches; the rest of the API is irrelevant here. */
function makeApi(over: Partial<ArchitecturesApi> = {}): ArchitecturesApi {
  return {
    current: arch,
    recolorBlock: vi.fn(),
    changeBlockKind: vi.fn(),
    setText: vi.fn(),
    setImage: vi.fn(),
    styleLink: vi.fn(),
    deleteKind: vi.fn(),
    ...over,
  } as unknown as ArchitecturesApi
}

describe('<ArchInspector />', () => {
  it('prompts for a selection when nothing is selected', () => {
    render(<ArchInspector api={makeApi()} selectedBlockId={null} selectedLinkId={null} />)
    expect(screen.getByText(/Nothing selected/i)).toBeInTheDocument()
  })

  it('recolours the selected block and can reset to the kind colour', () => {
    const recolorBlock = vi.fn()
    render(
      <ArchInspector api={makeApi({ recolorBlock })} selectedBlockId="b1" selectedLinkId={null} />,
    )
    expect(screen.getByText(/Block · Booking API/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Colour #3fb950'))
    expect(recolorBlock).toHaveBeenCalledWith('b1', '#3fb950')

    fireEvent.click(screen.getByText(/reset to kind/i))
    expect(recolorBlock).toHaveBeenCalledWith('b1', undefined)
  })

  it('offers custom kinds alongside built-ins and switches a block to one', () => {
    const changeBlockKind = vi.fn()
    render(
      <ArchInspector api={makeApi({ changeBlockKind })} selectedBlockId="b1" selectedLinkId={null} />,
    )
    const select = screen.getByLabelText('Block kind')
    expect(screen.getByRole('option', { name: /Pillar/ })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'kind-1' } })
    expect(changeBlockKind).toHaveBeenCalledWith('b1', 'kind-1')
  })

  it('commits body text on blur', () => {
    const setText = vi.fn()
    render(<ArchInspector api={makeApi({ setText })} selectedBlockId="b1" selectedLinkId={null} />)
    const input = screen.getByLabelText('Block body text')
    fireEvent.blur(input, { target: { value: 'remember the escrow' } })
    expect(setText).toHaveBeenCalledWith('b1', 'remember the escrow')
  })

  it('shows the image picker only for image blocks', () => {
    const { rerender } = render(
      <ArchInspector api={makeApi()} selectedBlockId="b1" selectedLinkId={null} />,
    )
    expect(screen.queryByLabelText('Choose an image')).not.toBeInTheDocument()

    rerender(<ArchInspector api={makeApi()} selectedBlockId="b2" selectedLinkId={null} />)
    expect(screen.getByLabelText('Choose an image')).toBeInTheDocument()
  })

  it('styles the selected connection', () => {
    const styleLink = vi.fn()
    render(<ArchInspector api={makeApi({ styleLink })} selectedBlockId={null} selectedLinkId="l1" />)

    fireEvent.change(screen.getByLabelText('Connection curve'), { target: { value: 'step' } })
    expect(styleLink).toHaveBeenCalledWith('l1', { curve: 'step' })

    fireEvent.click(screen.getByRole('button', { name: 'dashed' }))
    expect(styleLink).toHaveBeenCalledWith('l1', { dashed: true })

    // The arrow toggle reads as on by default, so pressing it turns it off.
    expect(screen.getByRole('button', { name: 'arrow' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'arrow' }))
    expect(styleLink).toHaveBeenCalledWith('l1', { noArrow: true })

    fireEvent.blur(screen.getByLabelText('Connection label'), { target: { value: 'async' } })
    expect(styleLink).toHaveBeenCalledWith('l1', { label: 'async' })
  })

  it('lists custom kinds and deletes one', () => {
    const deleteKind = vi.fn()
    render(<ArchInspector api={makeApi({ deleteKind })} selectedBlockId={null} selectedLinkId={null} />)
    fireEvent.click(screen.getByLabelText('Delete kind Pillar'))
    expect(deleteKind).toHaveBeenCalledWith('kind-1')
  })

  it('renders nothing without a current architecture', () => {
    const { container } = render(
      <ArchInspector
        api={makeApi({ current: null })}
        selectedBlockId="b1"
        selectedLinkId={null}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
