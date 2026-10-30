import { useEffect, type CSSProperties, type ReactNode } from 'react'

import type { OpenDrawElement, OpenDrawState } from '@opendraw/core'
import type { EditorController, ThemeDefault } from '@opendraw/editor'

import { ArrowTypePicker } from './ArrowTypePicker.js'
import { Footer } from './Footer.js'
import { OpenDrawCanvas } from './OpenDrawCanvas.js'
import { Toolbar } from './Toolbar.js'
import { useEditorState, useOpenDrawEditor, useScenePersistence } from './useOpenDrawEditor.js'

export interface OpenDrawProps {
  /** Bring your own controller (to drive it from outside); one is created otherwise. */
  editor?: EditorController
  /** Starting theme; a persisted theme wins over it. */
  theme?: ThemeDefault
  /** Autosave: `true` (shared key), a storage key, or `false`. */
  persist?: boolean | string
  /** Elements to start with when nothing is persisted. */
  initialElements?: readonly OpenDrawElement[]
  /** `full`: toolbar, zoom, history and theme · `none`: the bare canvas. */
  ui?: 'full' | 'none'
  /** Every document or editor-state change. */
  onChange?: (state: OpenDrawState) => void
  /** Extra overlay content, rendered inside the editor root. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * The editor, ready to drop on a page — the canvas with an Excalidraw-style
 * toolbar, zoom and history islands and a theme toggle. Import the styles
 * once: `import '@opendraw/editor/styles.css'`.
 */
export function OpenDraw(props: OpenDrawProps) {
  const owned = useOpenDrawEditor({ elements: props.initialElements })
  const editor = props.editor ?? owned
  return <EditorShell {...props} editor={editor} />
}

function EditorShell({ editor, theme = 'system', persist = true, ui = 'full', onChange, children, className, style }: OpenDrawProps & { editor: EditorController }) {
  useScenePersistence(editor, { persist, theme })
  const themeAttr = useEditorState(editor, (e) => e.theme)

  useEffect(() => {
    if (!onChange) {
      return
    }
    return editor.subscribe((e) => onChange(e.state))
  }, [editor, onChange])

  return (
    <div className={['opendraw', className].filter(Boolean).join(' ')} style={style} data-opendraw-root="" data-theme={themeAttr}>
      <OpenDrawCanvas editor={editor} />
      {ui === 'full' && (
        <>
          <Toolbar editor={editor} />
          <ArrowTypePicker editor={editor} />
          <Footer editor={editor} />
        </>
      )}
      {children}
    </div>
  )
}
