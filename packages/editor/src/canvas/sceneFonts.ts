import type { OpenDrawElement } from '@opendrawjs/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Web fonts for the canvas — Excalidraw's Fonts.loadSceneFonts. A canvas
 * never asks the browser for a font: drawing text with a face that has not
 * downloaded yet silently uses the fallback, and the text is measured with
 * the fallback's metrics too. So the editor requests Excalifont itself, for
 * exactly the characters on the canvas (its Unicode subsets download only
 * as needed). When a face arrives, every text is re-measured — outside
 * undo history — and the scene repaints.
 *
 * The text being edited is left alone until the edit ends: its session
 * keeps a stable layout box (textEditor.ts).
 */

/** The family behind "Hand-drawn" text, shipped by @opendrawjs/editor/fonts.css. */
const HAND_FONT = '20px Excalifont'

export function attachSceneFonts(rt: CanvasRuntime): () => void {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return () => {}
  }
  const fonts = document.fonts
  const { ctx } = rt
  /** Characters already requested, so each one is asked for once. */
  const requested = new Set<string>()
  let pending = false
  let disposed = false

  function refresh(): void {
    if (disposed) {
      return
    }
    if (ctx.editingId) {
      pending = true
      return
    }
    pending = false
    ctx.doc.refreshTextMetrics()
    rt.scheduleRender()
  }

  function request(text: string): void {
    fonts.load(HAND_FONT, text).then(refresh, (error: unknown) => {
      console.warn('[opendraw] could not load Excalifont; hand-drawn text uses a fallback font', error)
    })
  }

  function requestSceneText(elements: readonly OpenDrawElement[]): void {
    let fresh = ''
    for (const element of elements) {
      if (element.type !== 'text' || element.fontFamily !== 'hand') {
        continue
      }
      for (const char of element.text) {
        if (!requested.has(char)) {
          requested.add(char)
          fresh += char
        }
      }
    }
    if (fresh !== '') {
      request(fresh)
    }
  }

  // Latin up front, so the first text typed is measured with the real font.
  request('Excalifont')
  requestSceneText(ctx.elements)

  let lastElements = ctx.elements
  const unsubscribe = ctx.subscribe((editor) => {
    if (editor.elements !== lastElements) {
      lastElements = editor.elements
      requestSceneText(editor.elements)
    }
    if (pending && !editor.editingId) {
      refresh()
    }
  })
  fonts.addEventListener('loadingdone', refresh)

  return () => {
    disposed = true
    unsubscribe()
    fonts.removeEventListener('loadingdone', refresh)
  }
}
