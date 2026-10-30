/**
 * @opendrawjs/svelte, the Svelte 5 adapter. A thin layer over the
 * framework-free @opendrawjs/editor: the controller owns every behavior,
 * these components render the surface and mirror its state.
 */
export { default as OpenDraw } from './OpenDraw.svelte'
export { default as OpenDrawCanvas } from './OpenDrawCanvas.svelte'
export { default as Toolbar } from './Toolbar.svelte'
export { default as Footer } from './Footer.svelte'
export { default as ArrowTypePicker } from './ArrowTypePicker.svelte'
export { EditorState, editorState } from './editorState.js'
export { createEditor, type EditorController } from '@opendrawjs/editor'
// The scene types an app handles in callbacks, so it needs no direct core install.
export type { OpenDrawAppState, OpenDrawElement, OpenDrawFile, OpenDrawState } from '@opendrawjs/core'
