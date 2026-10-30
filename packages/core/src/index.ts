/**
 * @opendrawjs/core, public API.
 *
 * Layers, in dependency order:
 *   types         , the element model & app state contracts
 *   geometry      , points, bounds, text metrics
 *   elements      , factories, copy-on-write mutation, hit-testing
 *   viewport      , scene ↔ screen transforms
 *   interaction   , handles + pure transform math
 *   scene         , OpenDrawDocument store + history
 *   render        , rough.js scene renderer + interactive overlay
 *   export        , JSON files + PNG and SVG export
 */

export * from './types.js'
export * from './utils/rng.js'

export * from './geometry/points.js'
export * from './geometry/bounds.js'
export * from './geometry/text.js'

export * from './elements/defaults.js'
export * from './elements/colors.js'
export * from './elements/factories.js'
export * from './elements/mutate.js'
export * from './elements/hitTest.js'
export * from './elements/binding.js'
export * from './elements/groups.js'
export * from './elements/arrange.js'
export * from './elements/duplicate.js'
export * from './elements/boundText.js'
export * from './elements/zindex.js'
export * from './elements/frames.js'
export * from './elements/stickyNote.js'
export * from './elements/elbowArrow.js'

export * from './viewport.js'

export * from './interaction/handles.js'
export * from './interaction/transform.js'

export * from './scene/history.js'
export * from './scene/document.js'

export * from './render/theme.js'
export {
  ADAPTIVE_RADIUS,
  cornerRadius,
  exportElementShape,
  PROPORTIONAL_RADIUS,
  renderElementShape,
  renderScene,
  renderableElements,
} from './render/renderScene.js'
export type { SceneRenderInput, CanvasSize, SceneImageResolver } from './render/renderScene.js'
export { renderOverlay } from './render/overlay.js'
export type { OverlayRenderInput } from './render/overlay.js'

export * from './export/serialize.js'
export * from './export/png.js'
export * from './export/svg.js'
