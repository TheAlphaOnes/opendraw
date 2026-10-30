import type { OpenDrawFrameElement } from '@opendrawjs/core'
import { FRAME_NAME_STYLE, frameTitle, isFrameElement, sceneToScreen } from '@opendrawjs/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Renaming a frame in place, Excalidraw's `editingFrame` input: a
 * double-click on the name swaps the painted label for an input sitting
 * exactly over it. Typing renames live; Enter, Escape or a blur commits,
 * trimming the name (an empty one falls back to "Frame"). The whole rename
 * is one undo step.
 */

/** Excalidraw's FRAME_NAME_EDIT_PADDING, in screen px. */
const EDIT_PADDING = 6
const NAME_INK = { light: '#999999', dark: '#7a7a7a' } as const

export function editFrameName(rt: CanvasRuntime, frame: OpenDrawFrameElement): void {
  const { ctx, host } = rt
  if (rt.editingFrameNameId.value !== null) {
    return
  }
  const input = document.createElement('input')
  input.className = 'opendraw-frame-name-editor'
  input.type = 'text'
  input.value = frameTitle(frame)
  input.dir = 'auto'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('aria-label', 'Frame name')

  const dark = ctx.appState.theme === 'dark'
  Object.assign(input.style, {
    position: 'absolute',
    zIndex: '2',
    margin: '0',
    border: 'none',
    outline: 'none',
    display: 'block',
    padding: `${EDIT_PADDING}px`,
    borderRadius: '4px',
    boxShadow: 'inset 0 0 0 1px var(--od-accent, #ea580c)',
    background: ctx.appState.viewBackgroundColor,
    color: dark ? NAME_INK.dark : NAME_INK.light,
    font: `${FRAME_NAME_STYLE.fontSize}px ${FRAME_NAME_STYLE.fontFamily}`,
    lineHeight: String(FRAME_NAME_STYLE.lineHeight),
    pointerEvents: 'auto',
  })

  /** The label's bottom sits `offsetY` px above the frame; the padding is shifted out. */
  function place(): void {
    const current = ctx.doc.getElement(frame.id)
    if (!current) {
      finish()
      return
    }
    const topLeft = sceneToScreen({ x: current.x, y: current.y }, ctx.viewport)
    const bottom = host.clientHeight - topLeft.y + FRAME_NAME_STYLE.offsetY
    input.style.left = `${topLeft.x - EDIT_PADDING}px`
    input.style.bottom = `${bottom - EDIT_PADDING}px`
    input.style.maxWidth = `${Math.max(0, host.clientWidth - topLeft.x)}px`
    input.size = Math.max(1, input.value.length + 1)
  }

  let done = false
  function finish(): void {
    if (done) {
      return
    }
    done = true
    const current = ctx.doc.getElement(frame.id)
    if (current && isFrameElement(current)) {
      ctx.doc.updateElement(frame.id, { name: current.name.trim() })
    }
    if (current && isFrameElement(current) && current.name.trim() !== frame.name) {
      ctx.doc.endStep()
    } else {
      ctx.doc.cancelStep()
    }
    unsubscribe()
    input.remove()
    rt.editingFrameNameId.value = null
    host.focus({ preventScroll: true })
  }

  input.addEventListener('pointerdown', (event) => event.stopPropagation())
  input.addEventListener('input', () => {
    ctx.doc.updateElement(frame.id, { name: input.value })
    place()
  })
  input.addEventListener('keydown', (event) => {
    // Keys typed into the name never reach the canvas shortcuts.
    event.stopPropagation()
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      finish()
    }
  })
  input.addEventListener('blur', finish)

  ctx.doc.beginStep()
  rt.editingFrameNameId.value = frame.id
  const unsubscribe = ctx.subscribe(place)
  host.appendChild(input)
  place()
  input.focus({ preventScroll: true })
  input.select()
}
