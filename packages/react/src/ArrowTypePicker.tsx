import { ARROW_TYPE_OPTIONS, type EditorController } from '@opendrawjs/editor'

import { useEditorState } from './useOpenDrawEditor.js'

/**
 * Excalidraw's "Arrow type", sharp, curved or elbow, shown while the
 * arrow tool is armed or arrows are selected. Picking applies to the
 * selected arrows, else to the next arrow drawn.
 */
export function ArrowTypePicker({ editor }: { editor: EditorController }) {
  const tool = useEditorState(editor, (e) => e.activeTool)
  // Read the memoized selection; a filtered array per read would never settle.
  const selected = useEditorState(editor, (e) => e.selectedElements)
  const arrows = selected.filter((el) => el.type === 'arrow')
  const fallback = useEditorState(editor, (e) => e.appState.arrowType)
  if (tool !== 'arrow' && arrows.length === 0) {
    return null
  }
  const first = arrows[0]
  const current = first ? (first.elbowed ? 'elbow' : first.roundness === 'round' ? 'round' : 'sharp') : fallback

  return (
    <div className="opendraw__island opendraw__panel" role="group" aria-label="Arrow type">
      <span className="opendraw__panel-label">Arrow type</span>
      <div className="opendraw__options" role="radiogroup" aria-label="Arrow type">
        {ARROW_TYPE_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            role="radio"
            className="opendraw__option"
            aria-checked={current === option.type}
            aria-label={option.label}
            title={option.label}
            onClick={() => editor.changeArrowType(option.type)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {option.paths.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
