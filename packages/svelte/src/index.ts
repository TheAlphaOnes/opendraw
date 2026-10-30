/**
 * @opendraw/svelte — the Svelte 5 adapter. A thin layer over the
 * framework-free @opendraw/editor: the controller owns every behavior,
 * these components render the surface and mirror its state.
 */
export { default as OpenDraw } from './OpenDraw.svelte'
export { default as OpenDrawCanvas } from './OpenDrawCanvas.svelte'
export { default as Toolbar } from './Toolbar.svelte'
export { default as Footer } from './Footer.svelte'
export { EditorState, editorState } from './editorState.js'
export { createEditor, type EditorController } from '@opendraw/editor'
