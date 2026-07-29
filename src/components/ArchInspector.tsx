import { useRef } from 'react'
import type { ArchEdgeCurve } from '../types'
import { BLOCK_COLORS, availableKinds } from '../lib/architecture'
import type { ArchitecturesApi } from '../hooks/useArchitectures'

/**
 * Largest image we will inline. Pictures are stored as data URLs inside the
 * architecture JSON — that is what makes a diagram a single portable document —
 * so an unbounded upload would bloat every save and every prompt that ships the
 * graph as context.
 */
const MAX_IMAGE_BYTES = 512 * 1024

const CURVES: ArchEdgeCurve[] = ['bezier', 'straight', 'step']

/**
 * Properties panel for the current selection: one block, one edge, or neither.
 * Deliberately a plain panel rather than a floating popover — this canvas is
 * driven with a trackpad on a laptop, and a panel that doesn't move is easier
 * to hit than one that follows the selection.
 */
export default function ArchInspector({
  api,
  selectedBlockId,
  selectedLinkId,
}: {
  api: ArchitecturesApi
  selectedBlockId: string | null
  selectedLinkId: string | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const arch = api.current
  if (!arch) return null

  const block = selectedBlockId ? arch.blocks.find((b) => b.id === selectedBlockId) : undefined
  const link = selectedLinkId ? arch.links.find((l) => l.id === selectedLinkId) : undefined
  const customKinds = arch.kinds ?? []

  const pickImage = (file: File | undefined) => {
    if (!file || !block) return
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert(`That image is ${Math.round(file.size / 1024)}KB — keep it under 512KB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => api.setImage(block.id, String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
        {block ? `Block · ${block.label}` : link ? 'Connection' : 'Nothing selected'}
      </div>

      {!block && !link && (
        <p className="text-[11px] text-gray-600">
          Select a single block or connection to style it. Custom kinds you define appear in the
          toolbar and carry over to new diagrams.
        </p>
      )}

      {block && (
        <div className="space-y-3">
          <Row label="Colour">
            {BLOCK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => api.recolorBlock(block.id, c)}
                className="h-5 w-5 rounded border border-ink-600 transition-transform hover:scale-110"
                style={{ backgroundColor: c, outline: block.color === c ? '2px solid #e6edf3' : 'none' }}
              />
            ))}
            <button
              type="button"
              onClick={() => api.recolorBlock(block.id, undefined)}
              className="rounded border border-ink-600 px-2 py-0.5 text-[10px] text-gray-400 hover:border-syrup-700"
            >
              reset to kind
            </button>
          </Row>

          <Row label="Kind">
            <select
              aria-label="Block kind"
              value={block.kind}
              onChange={(e) => api.changeBlockKind(block.id, e.target.value)}
              className="rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[11px] text-gray-200 focus:border-syrup-700 focus:outline-none"
            >
              {availableKinds(arch).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.icon} {k.label}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Text">
            <input
              aria-label="Block body text"
              defaultValue={block.text ?? ''}
              key={block.id}
              onBlur={(e) => api.setText(block.id, e.target.value)}
              placeholder="free-form body text…"
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
            />
          </Row>

          {block.kind === 'image' && (
            <Row label="Image">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="Choose an image"
                onChange={(e) => pickImage(e.target.files?.[0])}
                className="text-[11px] text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-ink-600 file:px-2 file:py-1 file:text-[11px] file:text-gray-200"
              />
            </Row>
          )}
        </div>
      )}

      {link && (
        <div className="space-y-3">
          <Row label="Label">
            <input
              aria-label="Connection label"
              key={link.id}
              defaultValue={link.label ?? ''}
              onBlur={(e) => api.styleLink(link.id, { label: e.target.value })}
              placeholder="e.g. REST, writes, async…"
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
            />
          </Row>
          <Row label="Line">
            <select
              aria-label="Connection curve"
              value={link.curve ?? 'bezier'}
              onChange={(e) => api.styleLink(link.id, { curve: e.target.value as ArchEdgeCurve })}
              className="rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[11px] text-gray-200 focus:border-syrup-700 focus:outline-none"
            >
              {CURVES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Toggle
              label="dashed"
              on={Boolean(link.dashed)}
              onClick={() => api.styleLink(link.id, { dashed: !link.dashed })}
            />
            <Toggle
              label="arrow"
              on={!link.noArrow}
              onClick={() => api.styleLink(link.id, { noArrow: !link.noArrow })}
            />
          </Row>
          <Row label="Colour">
            {BLOCK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Connection colour ${c}`}
                onClick={() => api.styleLink(link.id, { color: c })}
                className="h-5 w-5 rounded border border-ink-600 transition-transform hover:scale-110"
                style={{ backgroundColor: c, outline: link.color === c ? '2px solid #e6edf3' : 'none' }}
              />
            ))}
          </Row>
        </div>
      )}

      {customKinds.length > 0 && (
        <div className="mt-3 border-t border-ink-600 pt-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">Your kinds</div>
          <div className="flex flex-wrap gap-1.5">
            {customKinds.map((k) => (
              <span
                key={k.id}
                className="flex items-center gap-1 rounded border border-ink-600 bg-ink-900 px-2 py-1 text-[11px] text-gray-300"
                style={{ boxShadow: `inset 3px 0 0 ${k.color}` }}
              >
                {k.icon} {k.label}
                <button
                  type="button"
                  aria-label={`Delete kind ${k.label}`}
                  title="Blocks using it fall back to Service — they are not deleted"
                  onClick={() => api.deleteKind(k.id)}
                  className="ml-0.5 text-gray-600 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-gray-500">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded border px-2 py-1 text-[10px] transition-colors"
      style={{
        borderColor: on ? '#a86f10' : '#30363d',
        color: on ? '#e0a020' : '#8b949e',
      }}
    >
      {label}
    </button>
  )
}
