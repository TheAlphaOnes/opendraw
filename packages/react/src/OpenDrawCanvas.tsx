import { useEffect, useRef, type CSSProperties } from 'react'

import { mountCanvas, type CanvasContextMenuRequest, type EditorController } from '@opendrawjs/editor'

export interface OpenDrawCanvasProps {
  editor: EditorController
  /** A right-click asked for a context menu (the target is already selected). */
  onContextMenu?: (request: CanvasContextMenuRequest) => void
  className?: string
  style?: CSSProperties
}

/**
 * The canvas on its own: a focusable host with the scene and overlay
 * canvases, mounted onto the editor, every gesture, shortcut, the text
 * editor and rendering come from @opendrawjs/editor. No chrome.
 */
export function OpenDrawCanvas({ editor, onContextMenu, className, style }: OpenDrawCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const contextMenu = useRef(onContextMenu)
  contextMenu.current = onContextMenu

  useEffect(() => {
    const session = mountCanvas(editor, {
      host: host.current!,
      staticCanvas: scene.current!,
      overlayCanvas: overlay.current!,
      onContextMenu: (request) => contextMenu.current?.(request),
    })
    return () => session.dispose()
  }, [editor])

  return (
    <div ref={host} className={['opendraw__host', className].filter(Boolean).join(' ')} style={style} tabIndex={0}>
      <canvas ref={scene} className="opendraw__static" />
      <canvas ref={overlay} className="opendraw__overlay" />
    </div>
  )
}
