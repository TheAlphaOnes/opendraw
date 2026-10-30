<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/logo.svg" alt="opendraw" width="290" height="64">
</p>

<p align="center">
  <strong>Hand-drawn diagrams for Svelte 5.</strong><br>
  An Excalidraw-style whiteboard as one component: the tools, shortcuts and feel your users already know.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendrawjs/svelte"><img src="https://img.shields.io/npm/v/@opendrawjs/svelte?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ea580c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white" alt="Svelte 5">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/screenshot.png" alt="The opendraw editor: a hand-drawn flow of three shapes joined by arrows, and a sticky note" width="860">
</p>

`@opendrawjs/svelte` renders the opendraw editor in Svelte 5: the hand-drawn canvas with every Excalidraw gesture and shortcut, a toolbar, zoom and history controls, a theme toggle and autosave. It uses runes, and it is a thin layer over the framework-free [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor), so the drawing behavior is identical to the Vue and React versions.

## Install

```bash
npm install @opendrawjs/svelte
# or: pnpm add @opendrawjs/svelte · yarn add @opendrawjs/svelte · bun add @opendrawjs/svelte
```

Requires Svelte 5.

## Quick start

Import the styles once, then render `<OpenDraw>` in a container with a height:

```svelte
<script lang="ts">
  import '@opendrawjs/svelte/styles.css'
  import { OpenDraw } from '@opendrawjs/svelte'
</script>

<div style="height: 100vh">
  <OpenDraw />
</div>
```

That's a working whiteboard that saves to `localStorage` as you draw.

> **SvelteKit:** the editor needs the browser. Render it only on the client, for example with `export const ssr = false` in the page's `+page.ts`, or inside `{#if browser}` using `browser` from `$app/environment`.

## `<OpenDraw>`

```svelte
<script lang="ts">
  import { OpenDraw, type OpenDrawState } from '@opendrawjs/svelte'

  function save(state: OpenDrawState) {
    // send state.elements to your API, or anywhere else
  }
</script>

<OpenDraw theme="dark" persist="team-board" onchange={save} />
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Starting theme. A theme the user picked (and saved) wins over it. |
| `persist` | `boolean \| string` | `true` | Autosave to `localStorage`. A string is the storage key; `false` turns it off. |
| `initialElements` | `OpenDrawElement[]` | `[]` | The scene to start with when nothing is saved. |
| `ui` | `'full' \| 'none'` | `'full'` | `full`: toolbar, zoom, history and theme · `none`: the bare canvas. |
| `onchange` | `(state: OpenDrawState) => void` | | Every document or editor-state change. |
| `editor` | `EditorController` | | Bring your own controller to drive the editor from outside. |
| `children` | snippet | | Your own overlay content, rendered inside the editor. |
| `class` | `string` | | On the editor's root element. |

## Drive it from outside

Create the controller with `createEditor()`, pass it in, and read any state reactively with `editorState()`. Every command is undoable.

```svelte
<script lang="ts">
  import '@opendrawjs/svelte/styles.css'
  import { OpenDraw, createEditor, editorState } from '@opendrawjs/svelte'

  const editor = createEditor()
  const selected = editorState(editor, (e) => e.selectedElements.length)
  const canUndo = editorState(editor, (e) => e.canUndo)
</script>

<div style="height: 100vh">
  <OpenDraw {editor}>
    <div class="my-actions">
      <button disabled={selected.current === 0} onclick={() => editor.changeStyle({ strokeColor: '#e03131' })}>
        Make it red
      </button>
      <button disabled={!canUndo.current} onclick={() => editor.undo()}>Undo</button>
      <button onclick={() => editor.exportPNG('diagram')}>Export PNG</button>
    </div>
  </OpenDraw>
</div>
```

`editorState(editor, read)` returns an object whose `.current` is reactive: read it in markup or in `$derived`, and it updates whenever the editor changes.

## Your own UI

Render only the canvas with `<OpenDrawCanvas>` and build the chrome yourself. The canvas keeps every gesture, shortcut and the text editor.

```svelte
<script lang="ts">
  import '@opendrawjs/svelte/styles.css'
  import { OpenDrawCanvas, createEditor, editorState } from '@opendrawjs/svelte'

  const editor = createEditor()
  const tool = editorState(editor, (e) => e.activeTool)
</script>

<div class="opendraw" data-opendraw-root style="height: 100vh">
  <OpenDrawCanvas {editor} />
  <nav class="my-toolbar">
    <button aria-pressed={tool.current === 'rectangle'} onclick={() => editor.setActiveTool('rectangle')}>Rectangle</button>
    <button aria-pressed={tool.current === 'arrow'} onclick={() => editor.setActiveTool('arrow')}>Arrow</button>
  </nav>
</div>
```

The editor controller (`EditorController`) exposes the whole API: state getters such as `elements`, `selectedElements`, `activeTool`, `theme`, `viewport`, `canUndo`; and commands such as `setActiveTool`, `changeStyle`, `changeArrowType`, `groupSelection`, `alignSelection`, `undo`, `zoomToFitAll`, `serialize`, `loadFile`, `exportPNG`, `exportSVG` and `saveToFile`. See [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor).

## Exports

| Export | |
| --- | --- |
| `OpenDraw` | The full editor. |
| `OpenDrawCanvas` | The canvas alone, for your own UI. |
| `Toolbar` · `Footer` · `ArrowTypePicker` | The built-in pieces, to compose your own layout. |
| `editorState(editor, read)` · `EditorState` | Reactive editor state (`.current`). |
| `createEditor` · `EditorController` | Re-exported from `@opendrawjs/editor`. |
| `OpenDrawState` · `OpenDrawElement` · `OpenDrawAppState` · `OpenDrawFile` | Scene types, re-exported from `@opendrawjs/core`. |
| `@opendrawjs/svelte/styles.css` | The editor styles. |

## Theming

The chrome is styled with CSS custom properties on `.opendraw`. Override them from a wrapper:

```css
/* In a component's <style> block; drop the :global() wrappers in a plain .css file. */
:global(.my-board .opendraw) {
  --od-accent: #2563eb;
  --od-brand-active: #1d4ed8;
  --od-accent-soft: #dbeafe;
  --od-on-accent-soft: #1e3a8a;
  --od-hover: #eff6ff;
}

:global(.my-board .opendraw[data-theme='dark']) {
  --od-accent: #60a5fa;
  --od-brand-active: #93c5fd;
  --od-accent-soft: #1e3a8a;
  --od-on-accent-soft: #dbeafe;
  --od-hover: #1e2a44;
}
```

## Keyboard shortcuts

| | | | |
| --- | --- | --- | --- |
| <kbd>V</kbd> / <kbd>1</kbd> Select | <kbd>R</kbd> / <kbd>2</kbd> Rectangle | <kbd>D</kbd> / <kbd>3</kbd> Diamond | <kbd>O</kbd> / <kbd>4</kbd> Ellipse |
| <kbd>A</kbd> / <kbd>5</kbd> Arrow | <kbd>L</kbd> / <kbd>6</kbd> Line | <kbd>P</kbd> / <kbd>7</kbd> Draw | <kbd>T</kbd> / <kbd>8</kbd> Text |
| <kbd>N</kbd> Sticky note | <kbd>9</kbd> Image | <kbd>E</kbd> / <kbd>0</kbd> Eraser | <kbd>F</kbd> Frame · <kbd>K</kbd> Laser |
| <kbd>⌘</kbd> <kbd>Z</kbd> Undo | <kbd>⌘</kbd> <kbd>G</kbd> Group | <kbd>⌘</kbd> <kbd>D</kbd> Duplicate | <kbd>⌘</kbd> <kbd>A</kbd> Select all |

On Windows and Linux, <kbd>Ctrl</kbd> replaces <kbd>⌘</kbd>.

## Other frameworks

| Package | |
| --- | --- |
| [`@opendrawjs/nuxt`](https://www.npmjs.com/package/@opendrawjs/nuxt) | Nuxt and Vue, with the full Excalidraw-style UI (properties panel, menus, many drawings). |
| [`@opendrawjs/react`](https://www.npmjs.com/package/@opendrawjs/react) | The same editor for React. |
| [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor) | The framework-free editor. |
| [`@opendrawjs/core`](https://www.npmjs.com/package/@opendrawjs/core) | The engine: element model, history, rendering and export. |

## Links

- [Source code and full documentation](https://github.com/TheAlphaOnes/opendraw#readme)
- [Report a bug or request a feature](https://github.com/TheAlphaOnes/opendraw/issues)

opendraw is an independent implementation, not affiliated with the Excalidraw team.

## License

[MIT](https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE) © 2026 Vishnu
