<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { TextContainer, OpenDrawTextElement } from '@opendraw/core'
import {
  boundTextMaxWidth,
  containerTextOrigin,
  isTextContainer,
  isTextElement,
  sceneToScreen,
  screenToScene,
  themeColor,
} from '@opendraw/core'

import { useOpenDraw } from '../composables/useOpenDraw.js'

/**
 * Wysiwyg text editor: a font-matched textarea floating exactly over the
 * text element being edited. Mirrors Excalidraw's flow — creation and
 * edits land inside ONE open history step which the editor closes
 * (or cancels) on commit.
 *
 * The component is mounted PER EDITING SESSION (the canvas gates it with
 * `v-if`), so `onMounted` is the session start. The textarea is seeded
 * from state once and then stays uncontrolled: the browser owns the
 * editing state (caret, selection, composition). Binding `value` back per
 * keystroke resets Chromium's IME/insertText caret, which reverses typed
 * text character by character.
 */
const ctx = useOpenDraw()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const committed = ref(false)

const element = computed<OpenDrawTextElement | null>(() => {
  const id = ctx.editingId.value
  if (!id) {
    return null
  }
  // Read through the reactive elements list: the document's own lookup
  // reads plain class fields, which would freeze this computed at its
  // first evaluation and make commit() see stale (empty) text.
  const el = ctx.elements.value.find((candidate) => candidate.id === id)
  return el && isTextElement(el) ? el : null
})

const isTextElementActive = computed(() => element.value !== null)

/** The shape a bound label lives in (Excalidraw's container), if any. */
const container = computed<TextContainer | null>(() => {
  const id = element.value?.containerId
  if (!id) {
    return null
  }
  const el = ctx.elements.value.find((candidate) => candidate.id === id)
  return el && isTextContainer(el) ? el : null
})

/** Screen-space box of the editing element. */
const boxStyle = computed(() => {
  const el = element.value
  const viewport = ctx.viewport.value
  if (!el) {
    return {}
  }
  const shape = container.value
  // A label's box spans the shape's inner width (stable while typing) and
  // follows the label's top as vertical centering moves it.
  const left = shape ? containerTextOrigin(shape).x : el.x
  const width = shape ? boundTextMaxWidth(shape) : el.width
  const topLeft = sceneToScreen({ x: left, y: el.y }, viewport)
  return {
    left: `${topLeft.x}px`,
    top: `${topLeft.y}px`,
    width: `${width * viewport.zoom}px`,
    minHeight: `${el.height * viewport.zoom}px`,
    transform: el.angle !== 0 ? `rotate(${el.angle}rad)` : undefined,
    transformOrigin: 'center',
  }
})

/**
 * The textarea keeps ONE stable width for the whole session. Sizing it to
 * the measured element (via its parent) instead would mutate its layout
 * box on every keystroke, which resets Chromium's IME/insertText caret
 * tracking to 0 — every character then prepends and the stored text ends
 * up character-reversed. A stable box costs nothing visually: the overlay
 * is transparent and never wraps (`white-space: pre`).
 */
const sessionWidth = ref(0)

/** Same reasoning as the width, for the height: multi-line text stays
 * fully visible without resizing the box mid-typing. */
const sessionHeight = ref(0)

/** Floors for the session box — the editor stays usable near the edges. */
const MIN_SESSION_WIDTH = 200
const MIN_SESSION_HEIGHT = 50

const fontStyle = computed(() => {
  const el = element.value
  if (!el) {
    return {}
  }
  return {
    fontFamily: fontFamilyStack(el.fontFamily),
    fontSize: `${el.fontSize * ctx.viewport.value.zoom}px`,
    lineHeight: `${el.lineHeight}`,
    // Free text edits left-aligned: its session-stable box is wider than
    // the element, so center/right would show text away from its committed
    // position. A label's box IS its wrap width, so it aligns for real.
    textAlign: container.value ? el.textAlign : 'left',
    whiteSpace: container.value ? 'pre-wrap' : 'pre',
    overflowWrap: container.value ? 'anywhere' : 'normal',
    // The committed render dark-filters stroke colors; the editor must
    // match it, or dark ink types invisibly on the dark canvas.
    color: themeColor(el.strokeColor, ctx.theme.value === 'dark'),
    ...(sessionWidth.value > 0 ? { width: `${sessionWidth.value}px` } : {}),
    ...(sessionHeight.value > 0 ? { minHeight: `${sessionHeight.value}px` } : {}),
  }
})

function fontFamilyStack(family: 'hand' | 'normal' | 'code'): string {
  if (family === 'code') {
    return '"Cascadia Code", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace'
  }
  if (family === 'normal') {
    return '"Helvetica Neue", Helvetica, Arial, sans-serif'
  }
  return '"Excalifont", "Virgil", "Segoe Print", "Bradley Hand", cursive'
}

function onInput(event: Event) {
  const el = element.value
  if (!el) {
    return
  }
  const text = (event.target as HTMLTextAreaElement).value
  // The typed text is the original; the document re-wraps bound labels
  // (and the composable re-measures free text) on every update.
  ctx.updateElement(el.id, { text, originalText: text })
}

/** Finalizes editing: empty text deletes the element, everything else commits. */
function commit() {
  if (committed.value) {
    return
  }
  const el = element.value
  const id = ctx.editingId.value
  if (!el || !id) {
    // No live session (element removed mid-edit, stray event): nothing to
    // finalize and no flag to poison — just stop editing.
    ctx.setEditing(null)
    return
  }
  committed.value = true
  if (el.originalText.trim() === '') {
    // A brand-new element never really existed → cancel its whole step.
    // An existing element emptied by the user → delete it, keeping the
    // pre-edit state reachable via undo.
    ctx.doc.cancelStep()
    ctx.doc.deleteElements([id])
  } else {
    ctx.doc.endStep()
  }
  ctx.setEditing(null)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    // The textarea is about to unmount: hand focus back to the canvas so
    // the very next shortcut (another Escape, Delete…) still reaches the
    // editor instead of falling to <body> — Excalidraw refocuses its
    // container after text editing too.
    const host = textareaRef.value?.closest<HTMLElement>('.opendraw-canvas')
    commit()
    host?.focus({ preventScroll: true })
    return
  }
  event.stopPropagation()
}

/**
 * Commit when the user clicks anywhere else. Capture phase on window so it
 * runs before the canvas's own pointerdown handling — mirrors Excalidraw.
 */
function onWindowPointerDown(event: PointerEvent) {
  if (textareaRef.value && event.target === textareaRef.value && isWithinElement(event)) {
    return
  }
  commit()
}

/**
 * The session-stable textarea is wider than the element, so clicks on its
 * box hit the textarea, not the canvas. Only clicks landing on the element
 * itself continue the session — the rest commit like any other outside
 * click.
 */
function isWithinElement(event: PointerEvent): boolean {
  const el = element.value
  const ta = textareaRef.value
  if (!el || !ta) {
    return false
  }
  const host = ta.closest('.opendraw-canvas')
  if (!(host instanceof HTMLElement)) {
    return false
  }
  const rect = host.getBoundingClientRect()
  const scene = screenToScene(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    ctx.viewport.value,
  )
  // A label's session spans its whole shape.
  const box = container.value ?? el
  return (
    scene.x >= box.x &&
    scene.x <= box.x + box.width &&
    scene.y >= box.y &&
    scene.y <= box.y + box.height
  )
}

onMounted(() => {
  // Session start: seed the textarea from state once, then hand the
  // editing state to the browser. The component unmounts on commit, so a
  // later session re-seeds fresh (with its own `committed` flag).
  const ta = textareaRef.value
  const el = element.value
  if (ta && el) {
    ta.value = el.originalText
    // Stable box for the whole session: from the element's screen position
    // to the canvas edges (floored near the edges). Mutating the focused
    // editable's box mid-typing resets Chromium's IME caret tracking.
    const host = ta.closest('.opendraw-canvas')
    const hostWidth = host instanceof HTMLElement ? host.clientWidth : 0
    const hostHeight = host instanceof HTMLElement ? host.clientHeight : 0
    const screenLeft = sceneToScreen({ x: el.x, y: el.y }, ctx.viewport.value).x
    const screenTop = sceneToScreen({ x: el.x, y: el.y }, ctx.viewport.value).y
    const shape = container.value
    sessionWidth.value = shape
      ? boundTextMaxWidth(shape) * ctx.viewport.value.zoom
      : Math.max(MIN_SESSION_WIDTH, hostWidth - screenLeft)
    sessionHeight.value = Math.max(MIN_SESSION_HEIGHT, hostHeight - screenTop)
    // preventScroll keeps the session's screen-anchored layout box honest —
    // a focus scroll would drift the editor against the canvas mid-session.
    ta.focus({ preventScroll: true })
    // Cursor at the end, like Excalidraw's editor.
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }
  window.addEventListener('pointerdown', onWindowPointerDown, { capture: true })
  window.addEventListener('blur', commit)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown, { capture: true } as never)
  window.removeEventListener('blur', commit)
  commit()
})

// Keep the caret visible as the element re-measures while typing.
watch(
  () => element.value?.height,
  () => {
    const ta = textareaRef.value
    if (ta && ta === document.activeElement) {
      const end = ta.value.length
      ta.setSelectionRange(end, end)
    }
  },
)

function onBlur() {
  commit()
}
</script>

<template>
  <div
    v-if="element && isTextElementActive"
    class="opendraw-text-editor"
    :style="boxStyle"
    @pointerdown.stop
  >
    <textarea
      ref="textareaRef"
      class="opendraw-text-editor__input"
      :style="fontStyle"
      rows="1"
      spellcheck="false"
      aria-label="Text editor"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
</template>

<style scoped>
.opendraw-text-editor {
  position: absolute;
  margin: 0;
  pointer-events: auto;
}

.opendraw-text-editor__input {
  display: block;
  /* Width/min-height come from the session-stable inline styles, not the
   * reactive parent — see the `sessionWidth` note in the script. */
  padding: 0;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  background: transparent;
  white-space: pre;
  caret-color: currentcolor;
}

.opendraw-text-editor__input::selection {
  background: rgba(105, 101, 219, 0.25);
}
</style>
