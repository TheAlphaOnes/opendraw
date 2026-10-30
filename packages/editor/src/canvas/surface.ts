import { groupSelectionChrome, renderOverlay, renderScene } from '@opendrawjs/core'

import { imageDataUrlsOf, imageResolver, requestImageDecode } from '../services/image.service.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * The two-canvas surface: the static scene and the interactive chrome
 * overlay, sized to the host (device-pixel aware) and repainted at most
 * once per frame. Everything that can change a pixel schedules here.
 */
export interface CanvasSurface {
  /** Extra overlay ink painted after the chrome (laser trail). */
  setOverlayPainter: (painter: (target: CanvasRenderingContext2D, dpr: number) => void) => void
  dispose: () => void
}

export function createCanvasSurface(
  rt: CanvasRuntime,
  staticCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
): CanvasSurface {
  const { ctx } = rt
  let dpr = 1
  let overlayPainter: ((target: CanvasRenderingContext2D, dpr: number) => void) | null = null
  let renderFrame = 0

  function renderAll(): void {
    const size = ctx.viewportSize
    if (size.width === 0 || size.height === 0) {
      return
    }
    const staticCtx = staticCanvas.getContext('2d')
    const overlayCtx = overlayCanvas.getContext('2d')
    if (!staticCtx || !overlayCtx) {
      return
    }
    const { elements, appState } = ctx.state
    const gesture = rt.interaction.value

    renderScene(staticCtx, {
      elements,
      appState: {
        theme: appState.theme,
        viewBackgroundColor: appState.viewBackgroundColor,
        viewport: appState.viewport,
        gridSize: appState.gridSize,
        editingId: appState.editingId,
      },
      canvasSize: size,
      dpr,
      // Decoded bitmaps come from the shared cache; misses render placeholders.
      resolveImage: imageResolver,
      // A dragged selection clips to the frame it would drop into.
      frameDrag:
        gesture.kind === 'moving' && gesture.didDrag
          ? { ids: new Set(Object.keys(appState.selectedIds)), targetFrameId: rt.frameToHighlight.value?.id ?? null }
          : null,
      editingFrameNameId: rt.editingFrameNameId.value,
    })

    renderOverlay(overlayCtx, {
      selectedElements: ctx.selectedElements,
      appState: { theme: appState.theme, viewport: appState.viewport, editingId: appState.editingId },
      pointer: 'mouse',
      marquee: rt.marquee.value,
      previewElements: [],
      suggestedBinding: rt.suggestedBinding.value,
      elements,
      groupChrome: groupSelectionChrome(elements, appState.selectedIds, appState.editingGroupId),
      frameToHighlight: rt.frameToHighlight.value,
      elementsToHighlight: rt.elementsToHighlight.value,
      canvasSize: size,
      dpr,
    })

    overlayPainter?.(overlayCtx, dpr)
  }

  function scheduleRender(): void {
    if (renderFrame) {
      return
    }
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0
      renderAll()
    })
  }
  rt.scheduleRender = scheduleRender

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) {
      return
    }
    dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(entry.contentRect.width))
    const height = Math.max(1, Math.floor(entry.contentRect.height))
    ctx.setViewportSize({ width, height })
    for (const canvas of [staticCanvas, overlayCanvas]) {
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
    }
    scheduleRender()
  })
  resizeObserver.observe(rt.host)

  // A decode landing repaints once; the rAF-coalesced loop does the rest.
  let decodedFor: readonly unknown[] | null = null
  function decodeImages(): void {
    if (decodedFor === ctx.elements) {
      return
    }
    decodedFor = ctx.elements
    for (const dataUrl of imageDataUrlsOf(ctx.elements)) {
      requestImageDecode(dataUrl, scheduleRender)
    }
  }
  decodeImages()

  // Any document or editor change can change a pixel. The marquee and the
  // binding highlight are pure overlay ink, no document change flows while
  // they update (`select` short-circuits once the dragged rect covers
  // everything under it), so each schedules its own repaint.
  const unsubscribers = [
    ctx.subscribe(() => {
      decodeImages()
      scheduleRender()
    }),
    rt.marquee.subscribe(scheduleRender),
    rt.suggestedBinding.subscribe(scheduleRender),
    rt.frameToHighlight.subscribe(scheduleRender),
    rt.elementsToHighlight.subscribe(scheduleRender),
    rt.editingFrameNameId.subscribe(scheduleRender),
  ]

  scheduleRender()

  return {
    setOverlayPainter: (painter) => {
      overlayPainter = painter
    },
    dispose() {
      resizeObserver.disconnect()
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      if (renderFrame) {
        cancelAnimationFrame(renderFrame)
        renderFrame = 0
      }
    },
  }
}
