import { TOOLS, toolKeyHint, toolLabel, type EditorController, type ToolDefinition } from '@opendrawjs/editor'

import { Icon } from './icons.js'
import { useEditorState } from './useOpenDrawEditor.js'

/** The top-center toolbar: tool lock, then every tool with its key hint. */
export function Toolbar({ editor }: { editor: EditorController }) {
  const active = useEditorState(editor, (e) => e.activeTool)
  const locked = useEditorState(editor, (e) => e.toolLocked)

  const activate = (def: ToolDefinition) => (def.opensPicker ? editor.openImagePicker() : editor.setActiveTool(def.tool))

  return (
    <div className="opendraw__island opendraw__toolbar" role="toolbar" aria-label="Drawing tools">
      <button
        type="button"
        className="opendraw__button"
        aria-label="Keep selected tool active after drawing (Q)"
        title="Keep selected tool active after drawing (Q)"
        aria-pressed={locked}
        onClick={() => editor.toggleToolLock()}
      >
        <Icon name={locked ? 'lock' : 'unlock'} />
      </button>
      <span className="opendraw__divider" aria-hidden="true" />
      {TOOLS.map((def) => (
        <button
          key={def.tool}
          type="button"
          className="opendraw__button"
          aria-label={toolLabel(def)}
          title={toolLabel(def)}
          aria-pressed={!def.opensPicker && active === def.tool}
          onClick={() => activate(def)}
        >
          <Icon name={def.icon} />
          <span className="opendraw__key" aria-hidden="true">
            {toolKeyHint(def)}
          </span>
        </button>
      ))}
    </div>
  )
}
