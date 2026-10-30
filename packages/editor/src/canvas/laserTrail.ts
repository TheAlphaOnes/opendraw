import type { Point } from '@opendraw/core'
import { applyViewportTransform } from '@opendraw/core'

import type { SizeMappingDetails } from './laserOutline.js'
import { LaserStroke, svgPathFromOutline } from './laserOutline.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * Laser pointer — transient overlay ink, never document state. A port of
 * Excalidraw's LaserTrails + AnimatedTrail: each press is one stroke drawn
 * as a single filled outline whose width decays with age and tapers toward
 * the tail, so nothing overlaps into dots. Finished strokes keep fading
 * until their outline is empty; a rAF loop repaints while any remain.
 */

/** Excalidraw's DEFAULT_LASER_COLOR. */
const LASER_COLOR = 'red'
/** LaserPointer's default half-width, in screen pixels. */
const LASER_SIZE = 2
const DECAY_TIME = 1000
const DECAY_LENGTH = 50

const easeOut = (k: number): number => 1 - Math.pow(1 - k, 4)

/** Excalidraw's laser sizeMapping: shrink with age and toward the tail. */
function laserSizeMapping(c: SizeMappingDetails): number {
  const t = Math.max(0, 1 - (performance.now() - c.pressure) / DECAY_TIME)
  const l = (DECAY_LENGTH - Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) / DECAY_LENGTH
  return Math.min(easeOut(l), easeOut(t))
}

export interface LaserTrail {
  start: (at: Point) => void
  extend: (at: Point) => void
  /** Pointer released: the stroke keeps fading on its own. */
  end: () => void
  /** Paints the trail onto the overlay (its own viewport transform). */
  draw: (target: CanvasRenderingContext2D, dpr: number) => void
  dispose: () => void
}

export function createLaserTrail(rt: CanvasRuntime): LaserTrail {
  let current: LaserStroke | null = null
  let past: LaserStroke[] = []
  let frame = 0

  /** Outline size in scene units so the ink is constant on screen. */
  const sceneSize = (): number => LASER_SIZE / rt.ctx.state.appState.viewport.zoom

  function animate(): void {
    if (frame) {
      return
    }
    frame = requestAnimationFrame(() => {
      frame = 0
      past = past.filter((stroke) => stroke.getStrokeOutline(sceneSize()).length !== 0)
      rt.scheduleRender()
      if (current || past.length > 0) {
        animate()
      }
    })
  }

  return {
    dispose() {
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      current = null
      past = []
    },
    start(at) {
      current = new LaserStroke({ size: LASER_SIZE, streamline: 0.4, keepHead: false, sizeMapping: laserSizeMapping })
      current.addPoint([at.x, at.y, performance.now()])
      animate()
    },
    extend(at) {
      current?.addPoint([at.x, at.y, performance.now()])
      animate()
    },
    end() {
      if (!current) {
        return
      }
      current.close()
      past.push(current)
      current = null
      animate()
    },
    draw(target, dpr) {
      const strokes = current ? [...past, current] : past
      if (strokes.length === 0) {
        return
      }
      const size = sceneSize()
      const path = strokes.map((stroke) => svgPathFromOutline(stroke.getStrokeOutline(size))).join(' ').trim()
      if (!path) {
        return
      }
      target.save()
      applyViewportTransform(target, rt.ctx.state.appState.viewport, dpr)
      target.fillStyle = LASER_COLOR
      target.fill(new Path2D(path))
      target.restore()
    },
  }
}
