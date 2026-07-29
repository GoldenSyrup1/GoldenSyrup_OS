import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import type { ArchBlock } from '../types'

/**
 * One canvas block. A single node type covers every kind because they differ
 * only in what they render inside the same box:
 *   • group — a dashed container with its label pinned top-left, so the blocks
 *     dropped inside it stay readable;
 *   • image — the picture itself, cropped to the box;
 *   • note  — a label plus free-form body text;
 *   • everything else — icon + label, the original look.
 *
 * Purely presentational. Resizing is reported through React Flow's own
 * `dimensions` change so the canvas persists it, which keeps this component
 * free of any dependency on the architectures hook.
 */
function ArchBlockNode({ data, selected }: NodeProps) {
  const block = data.block as ArchBlock
  const color = (data.color as string) ?? '#8b949e'
  const label = String(data.label ?? '')

  const isGroup = block.kind === 'group'
  const isImage = block.kind === 'image'
  const isNote = block.kind === 'note'

  return (
    <>
      {/* Groups and sized blocks are the ones worth dragging a corner on. */}
      <NodeResizer
        isVisible={Boolean(selected)}
        color={color}
        minWidth={60}
        minHeight={40}
        lineStyle={{ borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Left} style={{ background: color }} />

      {isGroup && (
        <div className="pointer-events-none select-none text-[11px] font-semibold" style={{ color }}>
          {label}
        </div>
      )}

      {isImage &&
        (block.src ? (
          <img
            src={block.src}
            alt={block.label}
            className="h-full w-full rounded-[6px] object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-500">
            🖼️ pick an image →
          </div>
        ))}

      {!isGroup && !isImage && (
        <div className="flex flex-col gap-1">
          <span className="text-xs">{label}</span>
          {isNote && block.text && (
            <span className="whitespace-pre-wrap text-[11px] leading-snug text-gray-400">{block.text}</span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </>
  )
}

export default memo(ArchBlockNode)
