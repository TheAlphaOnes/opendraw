/**
 * @opendraw/editor — the framework-free opendraw editor.
 *
 *   controller   — EditorController: document + editor state + commands
 *   canvas       — mountCanvas: gestures, keyboard, rendering, text editing
 *   actions      — the command registry (shortcuts, labels, predicates)
 *   tools/icons  — the tool table and the semantic icon contract
 *   persistence  — localStorage scene persistence, theme defaults
 *   services     — file and image plumbing
 *
 * Framework adapters (@opendraw/nuxt, …) mirror the controller into their
 * own reactivity and render chrome around a mounted canvas.
 */

export * from './cell.js'
export * from './controller.js'
export * from './icons.js'
export * from './tools.js'

export * from './actions/types.js'
export * from './actions/keys.js'
export * from './actions/registry.js'

export { mountCanvas } from './canvas/mountCanvas.js'
export type { CanvasSession, MountCanvasOptions } from './canvas/mountCanvas.js'
export type { CanvasContextMenuRequest } from './canvas/viewportGestures.js'

export * from './persistence/persistedScene.js'
export * from './persistence/systemTheme.js'
export * from './persistence/scenePersistence.js'

export * from './services/file.service.js'
export * from './services/image.service.js'
