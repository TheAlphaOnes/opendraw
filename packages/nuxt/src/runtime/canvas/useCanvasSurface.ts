import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import { renderOverlay, renderScene } from '@vuedraw/core'

import { imageDataUrlsOf, imageResolver, requestImageDecode } from '../services/image.service.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * The two-canvas surface: the static scene and the interactive chrome
 * overlay, sized to the host (device-pixel aware) and repainted at most
 * once per frame. Everything that can change a pixel schedules here.
 */
export interface CanvasSurface {
  staticRef: Ref<HTMLCanvasElement | null>
  overlayRef: Ref<HTMLCanvasElement | null>
  /** Extra overlay ink painted after the chrome (laser trail). */
  setOverlayPainter: (painter: (target: CanvasRenderingContext2D, dpr: number) => void) => void
}

export function useCanvasSurface(rt: CanvasRuntime): CanvasSurface {
  const { ctx } = rt
  const staticRef = ref<HTMLCanvasElement | null>(null)
  const overlayRef = ref<HTMLCanvasElement | null>(null)
  const dpr = ref(1)
  let overlayPainter: ((target: CanvasRenderingContext2D, dpr: number) => void) | null = null
  let resizeObserver: ResizeObserver | null = null
  let renderFrame = 0

  function renderAll(): void {
    const size = ctx.viewportSize.value
    if (size.width === 0 || size.height === 0) {
      return
    }
    const staticCtx = staticRef.value?.getContext('2d')
    const overlayCtx = overlayRef.value?.getContext('2d')
    if (!staticCtx || !overlayCtx) {
      return
    }
    const { elements, appState } = ctx.state.value

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
      dpr: dpr.value,
      // Decoded bitmaps come from the shared cache; misses render placeholders.
      resolveImage: imageResolver,
    })

    renderOverlay(overlayCtx, {
      selectedElements: ctx.selectedElements.value,
      appState: { theme: appState.theme, viewport: appState.viewport, editingId: appState.editingId },
      pointer: 'mouse',
      marquee: rt.marquee.value,
      previewElements: [],
      bindingCandidates: rt.bindingCandidates.value,
      canvasSize: size,
      dpr: dpr.value,
    })

    overlayPainter?.(overlayCtx, dpr.value)
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

  function observeSize(): void {
    const host = rt.hostRef.value
    if (!host) {
      return
    }
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      const ratio = window.devicePixelRatio || 1
      dpr.value = ratio
      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))
      ctx.setViewportSize({ width, height })
      for (const canvas of [staticRef.value, overlayRef.value]) {
        if (canvas) {
          canvas.width = Math.floor(width * ratio)
          canvas.height = Math.floor(height * ratio)
        }
      }
      scheduleRender()
    })
    resizeObserver.observe(host)
  }

  // A decode landing repaints once; the rAF-coalesced loop does the rest.
  watch(
    () => ctx.state.value.elements,
    (elements) => {
      for (const dataUrl of imageDataUrlsOf(elements)) {
        requestImageDecode(dataUrl, scheduleRender)
      }
    },
    { immediate: true },
  )

  watch(() => ctx.state.value.rev, scheduleRender)
  watch(ctx.viewportSize, scheduleRender)
  // The marquee and binding highlight are pure overlay ink: no document
  // rev change flows while they update (`select` short-circuits once the
  // dragged rect covers everything under it), so each schedules its own
  // repaint or it visually freezes.
  watch(rt.marquee, scheduleRender)
  watch(rt.bindingCandidates, scheduleRender)

  onMounted(() => {
    observeSize()
    scheduleRender()
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    if (renderFrame) {
      cancelAnimationFrame(renderFrame)
    }
  })

  return {
    staticRef,
    overlayRef,
    setOverlayPainter: (painter) => {
      overlayPainter = painter
    },
  }
}
