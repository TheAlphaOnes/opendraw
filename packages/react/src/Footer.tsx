import type { EditorController } from '@opendrawjs/editor'

import { Icon } from './icons.js'
import { useEditorState } from './useOpenDrawEditor.js'

/** Bottom-left zoom and history islands, and the top-right theme toggle. */
export function Footer({ editor }: { editor: EditorController }) {
  const zoom = useEditorState(editor, (e) => e.viewport.zoom)
  const canUndo = useEditorState(editor, (e) => e.canUndo)
  const canRedo = useEditorState(editor, (e) => e.canRedo)
  const dark = useEditorState(editor, (e) => e.theme === 'dark')

  const center = () => ({ x: editor.viewportSize.width / 2, y: editor.viewportSize.height / 2 })
  const percent = `${Math.round(zoom * 100)}%`

  return (
    <>
      <div className="opendraw__bottom-left">
        <div className="opendraw__island opendraw__zoom-island" role="group" aria-label="Zoom">
          <button type="button" className="opendraw__button" aria-label="Zoom out" title="Zoom out" onClick={() => editor.zoomOut(center())}>
            <Icon name="zoomOut" />
          </button>
          <button
            type="button"
            className="opendraw__zoom"
            aria-label={`Reset zoom (currently ${percent})`}
            title="Reset zoom"
            onClick={() => editor.resetZoom()}
          >
            {percent}
          </button>
          <button type="button" className="opendraw__button" aria-label="Zoom in" title="Zoom in" onClick={() => editor.zoomIn(center())}>
            <Icon name="zoomIn" />
          </button>
        </div>
        <div className="opendraw__island" role="group" aria-label="History">
          <button type="button" className="opendraw__button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={() => editor.undo()}>
            <Icon name="undo" />
          </button>
          <button type="button" className="opendraw__button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={() => editor.redo()}>
            <Icon name="redo" />
          </button>
        </div>
      </div>
      <div className="opendraw__island opendraw__corner">
        <button
          type="button"
          className="opendraw__button"
          aria-label={dark ? 'Light mode' : 'Dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
          onClick={() => editor.toggleTheme()}
        >
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
      </div>
    </>
  )
}
