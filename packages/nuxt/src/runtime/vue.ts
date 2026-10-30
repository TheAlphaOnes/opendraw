/**
 * @opendraw/nuxt/vue — the same components for plain Vue 3 apps (Vite,
 * no Nuxt). Nuxt users get them auto-imported by the module instead.
 *
 *   import { OpenDraw } from '@opendraw/nuxt/vue'
 */
export { default as OpenDraw } from './components/OpenDraw.vue'
export { default as OpenDrawCanvas } from './components/OpenDrawCanvas.vue'
export { default as OpenDrawApp } from './components/OpenDrawApp.vue'
export { default as OpenDrawButton } from './components/slots/OpenDrawButton.vue'
export { default as OpenDrawCopyCommand } from './components/slots/OpenDrawCopyCommand.vue'
export { default as OpenDrawShareButton } from './components/slots/OpenDrawShareButton.vue'
export {
  createOpenDrawContext,
  provideOpenDraw,
  useOpenDraw,
  type OpenDrawChangeDetail,
  type OpenDrawContext,
} from './composables/useOpenDraw.js'
export { useScenePersistence } from './composables/useScenePersistence.js'
export { useDrawingFiles, type DrawingFile, type DrawingFilesContext } from './composables/useDrawingFiles.js'
export { defineOpenDrawConfig, type OpenDrawAppConfig, type OpenDrawAppFiles } from './config/openDrawApp.js'
