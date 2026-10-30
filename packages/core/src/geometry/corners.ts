/**
 * Corner rounding — Excalidraw's getCornerRadius. Shared by the renderer,
 * the overlay highlight and binding geometry, so every consumer traces the
 * exact corners that are drawn.
 */

/** Excalidraw's DEFAULT_PROPORTIONAL_RADIUS: corners at 25% of the side. */
export const PROPORTIONAL_RADIUS = 0.25

/** Excalidraw's DEFAULT_ADAPTIVE_RADIUS — rectangles' fixed corner radius. */
export const ADAPTIVE_RADIUS = 32

/**
 * Corner radius for a side of length `x`: rectangles use the adaptive
 * radius (a fixed 32px, proportional below the 128px cutoff), diamonds the
 * proportional one.
 */
export function cornerRadius(x: number, type: 'rectangle' | 'diamond'): number {
  if (type === 'diamond') {
    return x * PROPORTIONAL_RADIUS
  }
  const cutoff = ADAPTIVE_RADIUS / PROPORTIONAL_RADIUS
  return x <= cutoff ? x * PROPORTIONAL_RADIUS : ADAPTIVE_RADIUS
}
