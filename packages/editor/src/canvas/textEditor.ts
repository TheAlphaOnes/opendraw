import type { OpenDrawTextElement, TextContainer } from '@opendraw/core'
import {
  FONT_STACKS,
  boundTextMaxWidth,
  containerTextOrigin,
  isTextContainer,
  isTextElement,
  sceneToScreen,
  screenToScene,
  themeColor,
} from '@opendraw/core'

import type { EditorController } from '../controller.js'

/**
 * Wysiwyg text editing: a font-matched textarea floating exactly over the
 * text element being edited. Mirrors Excalidraw's flow — creation and
 * edits land inside ONE open history step which the session closes (or
 * cancels) on commit.
 *
 * One session per edit: `attachTextEditing` creates a session when the
 * editor's `editingId` is set and disposes it when it clears, so every
 * edit starts with a fresh `committed` flag and fresh listeners. The
 * textarea is seeded from state ONCE and then stays uncontrolled — the
 * browser owns caret, selection and composition. Writing its value back
 * per keystroke resets Chromium's IME/insertText caret, which reverses
 * typed text character by character.
 */

/** Floors for the session box — the editor stays usable near the edges. */
const MIN_SESSION_WIDTH = 200
const MIN_SESSION_HEIGHT = 50

class TextEditingSession {
  private readonly wrapper: HTMLDivElement
  private readonly textarea: HTMLTextAreaElement
  private committed = false
  private lastHeight = -1
  private readonly onWindowPointerDown = (event: PointerEvent): void => {
    if (event.target === this.textarea && this.isWithinElement(event)) {
      return
    }
    this.commit()
  }
  private readonly onWindowBlur = (): void => this.commit()

  constructor(
    private readonly editor: EditorController,
    private readonly host: HTMLElement,
    private readonly id: string,
  ) {
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'opendraw-text-editor'
    Object.assign(this.wrapper.style, { position: 'absolute', margin: '0', pointerEvents: 'auto' })
    // Presses inside the editor never reach the canvas gesture machine.
    this.wrapper.addEventListener('pointerdown', (event) => event.stopPropagation())

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'opendraw-text-editor__input'
    this.textarea.rows = 1
    this.textarea.spellcheck = false
    this.textarea.setAttribute('aria-label', 'Text editor')
    Object.assign(this.textarea.style, {
      display: 'block',
      padding: '0',
      border: 'none',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      background: 'transparent',
      caretColor: 'currentcolor',
    })
    this.textarea.addEventListener('input', () => this.onInput())
    this.textarea.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.textarea.addEventListener('blur', () => this.commit())
    this.wrapper.appendChild(this.textarea)
  }

  private get element(): OpenDrawTextElement | null {
    const el = this.editor.elements.find((candidate) => candidate.id === this.id)
    return el && isTextElement(el) ? el : null
  }

  /** The shape a bound label lives in (Excalidraw's container), if any. */
  private get container(): TextContainer | null {
    const id = this.element?.containerId
    if (!id) {
      return null
    }
    const el = this.editor.elements.find((candidate) => candidate.id === id)
    return el && isTextContainer(el) ? el : null
  }

  /** Session start: mount, seed once, size the stable box, focus. */
  start(): void {
    const el = this.element
    if (!el) {
      this.editor.setEditing(null)
      return
    }
    this.host.appendChild(this.wrapper)
    this.update()
    this.textarea.value = el.originalText
    // The textarea keeps ONE stable box for the whole session: resizing a
    // focused editable between insertions resets Chromium's IME caret
    // tracking to 0. Free text gets the room to the canvas edges; a label
    // gets exactly its shape's wrap width.
    const viewport = this.editor.viewport
    const topLeft = sceneToScreen({ x: el.x, y: el.y }, viewport)
    const shape = this.container
    const width = shape
      ? boundTextMaxWidth(shape) * viewport.zoom
      : Math.max(MIN_SESSION_WIDTH, this.host.clientWidth - topLeft.x)
    const height = Math.max(MIN_SESSION_HEIGHT, this.host.clientHeight - topLeft.y)
    this.textarea.style.width = `${width}px`
    this.textarea.style.minHeight = `${height}px`
    // preventScroll keeps the screen-anchored box honest — a focus scroll
    // would drift the editor against the canvas mid-session.
    this.textarea.focus({ preventScroll: true })
    // Cursor at the end, like Excalidraw's editor.
    this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length)
    window.addEventListener('pointerdown', this.onWindowPointerDown, { capture: true })
    window.addEventListener('blur', this.onWindowBlur)
  }

  /**
   * Follows the document: the wrapper tracks the element (a label re-centers
   * as it grows); the textarea only restyles its font, never its box.
   */
  update(): void {
    const el = this.element
    if (!el) {
      return
    }
    const viewport = this.editor.viewport
    const shape = this.container
    // A label's box spans the shape's inner width and follows the label's
    // top as vertical centering moves it.
    const left = shape ? containerTextOrigin(shape).x : el.x
    const width = shape ? boundTextMaxWidth(shape) : el.width
    const topLeft = sceneToScreen({ x: left, y: el.y }, viewport)
    Object.assign(this.wrapper.style, {
      left: `${topLeft.x}px`,
      top: `${topLeft.y}px`,
      width: `${width * viewport.zoom}px`,
      minHeight: `${el.height * viewport.zoom}px`,
      transform: el.angle !== 0 ? `rotate(${el.angle}rad)` : '',
      transformOrigin: 'center',
    })
    Object.assign(this.textarea.style, {
      fontFamily: FONT_STACKS[el.fontFamily],
      fontSize: `${el.fontSize * viewport.zoom}px`,
      lineHeight: `${el.lineHeight}`,
      // Free text edits left-aligned: its session box is wider than the
      // element, so center/right would show text away from where it
      // commits. A label's box IS its wrap width, so it aligns for real.
      textAlign: shape ? el.textAlign : 'left',
      whiteSpace: shape ? 'pre-wrap' : 'pre',
      overflowWrap: shape ? 'anywhere' : 'normal',
      // The committed render dark-filters stroke colors; the editor must
      // match it, or dark ink types invisibly on the dark canvas.
      color: themeColor(el.strokeColor, this.editor.theme === 'dark'),
    })
    // Keep the caret visible as the element re-measures while typing.
    if (el.height !== this.lastHeight) {
      this.lastHeight = el.height
      if (document.activeElement === this.textarea) {
        const end = this.textarea.value.length
        this.textarea.setSelectionRange(end, end)
      }
    }
  }

  private onInput(): void {
    const el = this.element
    if (!el) {
      return
    }
    // The typed text is the original; the document re-wraps bound labels
    // (and the controller re-measures free text) on every update.
    const text = this.textarea.value
    this.editor.updateElement(el.id, { text, originalText: text })
  }

  private onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation()
    // Escape, or Mod+Enter, finishes editing (Excalidraw's text_editing hint).
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault()
      // The textarea is about to go: hand focus back to the canvas so the
      // very next shortcut still reaches the editor instead of <body> —
      // Excalidraw refocuses its container after text editing too.
      this.commit()
      this.host.focus({ preventScroll: true })
    }
  }

  /**
   * Clicks on the textarea continue the session only when they land on the
   * text itself (or anywhere in a label's shape); every other click commits.
   */
  private isWithinElement(event: PointerEvent): boolean {
    const el = this.element
    if (!el) {
      return false
    }
    const rect = this.host.getBoundingClientRect()
    const scene = screenToScene({ x: event.clientX - rect.left, y: event.clientY - rect.top }, this.editor.viewport)
    const box = this.container ?? el
    return scene.x >= box.x && scene.x <= box.x + box.width && scene.y >= box.y && scene.y <= box.y + box.height
  }

  /** Finalizes the edit: empty text deletes the element, anything else commits. */
  commit(): void {
    if (this.committed) {
      return
    }
    const el = this.element
    if (!el) {
      // No live element (removed mid-edit, stray event): nothing to
      // finalize and no flag to poison — just stop editing it.
      this.stopEditing()
      return
    }
    this.committed = true
    if (el.originalText.trim() === '') {
      // A brand-new element never really existed → cancel its whole step.
      // An existing element emptied by the user → delete it, keeping the
      // pre-edit state reachable via undo.
      this.editor.doc.cancelStep()
      this.editor.doc.deleteElements([this.id])
    } else {
      this.editor.doc.endStep()
    }
    this.stopEditing()
  }

  /** Clears the edit — unless another session already took over. */
  private stopEditing(): void {
    if (this.editor.editingId === this.id) {
      this.editor.setEditing(null)
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onWindowPointerDown, { capture: true })
    window.removeEventListener('blur', this.onWindowBlur)
    this.commit()
    this.wrapper.remove()
  }
}

/**
 * Runs one editing session per `editingId`, created on the microtask after
 * the edit opens — the same beat a component framework would mount it on,
 * after the pointer event that opened the edit has finished. Returns the
 * cleanup.
 */
export function attachTextEditing(editor: EditorController, host: HTMLElement): () => void {
  let session: TextEditingSession | null = null
  let sessionId: string | null = null
  let scheduled = false

  function reconcile(): void {
    scheduled = false
    const id = editor.editingId
    if (id === sessionId) {
      session?.update()
      return
    }
    const previous = session
    session = null
    sessionId = id
    previous?.dispose()
    if (id) {
      session = new TextEditingSession(editor, host, id)
      session.start()
    }
  }

  const unsubscribe = editor.subscribe(() => {
    if (editor.editingId === sessionId) {
      session?.update()
    } else if (!scheduled) {
      scheduled = true
      queueMicrotask(reconcile)
    }
  })
  if (editor.editingId) {
    scheduled = true
    queueMicrotask(reconcile)
  }

  return () => {
    unsubscribe()
    session?.dispose()
    session = null
  }
}
