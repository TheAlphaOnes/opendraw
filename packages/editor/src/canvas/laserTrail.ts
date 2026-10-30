import type { Point } from '@opendraw/core'
import { applyViewportTransform } from '@opendraw/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Laser pointer — transient overlay ink, never document state. Points
 * fade out by age; a rAF loop trims the trail and repaints until empty.
 */

interface LaserPoint {
  x: number
  y: number
  /** Performance timestamp — points fade out by age. */
  t: number
}

const LASER_COLOR = '#ff2698'
const LASER_FADE_MS = 1000
const LASER_WIDTH = 4

export interface LaserTrail {
  start: (at: Point) => void
  extend: (at: Point) => void
  /** Paints the trail onto the overlay (its own viewport transform). */
  draw: (target: CanvasRenderingContext2D, dpr: number) => void
  dispose: () => void
}

export function createLaserTrail(rt: CanvasRuntime): LaserTrail {
  /** Live trail in scene coordinates; trimmed by the fade loop below. */
  let trail: LaserPoint[] = []
  let fadeFrame = 0

  function scheduleFade(): void {
    if (fadeFrame) {
      return
    }
    fadeFrame = requestAnimationFrame(() => {
      fadeFrame = 0
      const cutoff = performance.now() - LASER_FADE_MS
      trail = trail.filter((p) => p.t > cutoff)
      rt.scheduleRender()
      if (trail.length > 0) {
        scheduleFade()
      }
    })
  }

  return {
    dispose() {
      if (fadeFrame) {
        cancelAnimationFrame(fadeFrame)
        fadeFrame = 0
      }
    },
    start(at) {
      trail = [{ x: at.x, y: at.y, t: performance.now() }]
      rt.scheduleRender()
    },
    extend(at) {
      trail.push({ x: at.x, y: at.y, t: performance.now() })
      rt.scheduleRender()
      scheduleFade()
    },
    draw(target, dpr) {
      if (trail.length < 2) {
        return
      }
      const { viewport } = rt.ctx.state.appState
      const now = performance.now()
      target.save()
      applyViewportTransform(target, viewport, dpr)
      target.lineCap = 'round'
      target.lineJoin = 'round'
      target.strokeStyle = LASER_COLOR
      target.lineWidth = LASER_WIDTH
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]!
        const b = trail[i]!
        const alpha = Math.max(0, 1 - (now - Math.max(a.t, b.t)) / LASER_FADE_MS)
        if (alpha <= 0) {
          continue
        }
        target.globalAlpha = alpha
        target.beginPath()
        target.moveTo(a.x, a.y)
        target.lineTo(b.x, b.y)
        target.stroke()
      }
      target.restore()
    },
  }
}
