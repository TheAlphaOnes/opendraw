<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/logo.svg" alt="opendraw" width="290" height="64">
</p>

<p align="center">
  <strong>Hand-drawn diagrams for React.</strong><br>
  A hand-drawn whiteboard as one component: sketch, connect and share ideas right inside your app.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendrawjs/react"><img src="https://img.shields.io/npm/v/@opendrawjs/react?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ea580c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/React-18.2%2B-61dafb?logo=react&logoColor=white" alt="React 18.2+">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/screenshot.png" alt="The opendraw editor: a hand-drawn flow of three shapes joined by arrows, and a sticky note" width="860">
</p>

`@opendrawjs/react` renders the opendraw editor in React: the hand-drawn canvas with every gesture and keyboard shortcut, a toolbar, zoom and history controls, a theme toggle and autosave. It is a thin layer over the framework-free [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor), so the drawing behavior is identical to the Vue and Svelte versions.

## Install

```bash
npm install @opendrawjs/react
# or: pnpm add @opendrawjs/react · yarn add @opendrawjs/react · bun add @opendrawjs/react
```

Requires React 18.2 or newer (React 19 works too).

## Quick start

Import the styles once, then render `<OpenDraw>` in a container with a height:

```tsx
import '@opendrawjs/react/styles.css'
import { OpenDraw } from '@opendrawjs/react'

export function Board() {
  return (
    <div style={{ height: '100vh' }}>
      <OpenDraw />
    </div>
  )
}
```

That's a working whiteboard that saves to `localStorage` as you draw.

> **Next.js:** the editor needs the browser, so render it in a client component (`'use client'`), or load it with `dynamic(() => import('./Board'), { ssr: false })`.

## `<OpenDraw>`

```tsx
import type { OpenDrawState } from '@opendrawjs/react'

function save(state: OpenDrawState) {
  // send state.elements to your API, or anywhere else
}

<OpenDraw theme="dark" persist="team-board" onChange={save} />
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Starting theme. A theme the user picked (and saved) wins over it. |
| `persist` | `boolean \| string` | `true` | Autosave to `localStorage`. A string is the storage key; `false` turns it off. |
| `initialElements` | `OpenDrawElement[]` | `[]` | The scene to start with when nothing is saved. |
| `ui` | `'full' \| 'none'` | `'full'` | `full`: toolbar, zoom, history and theme · `none`: the bare canvas. |
| `onChange` | `(state: OpenDrawState) => void` | | Every document or editor-state change. |
| `editor` | `EditorController` | | Bring your own controller to drive the editor from outside. |
| `children` | `ReactNode` | | Your own overlay content, rendered inside the editor. |
| `className` · `style` | | | On the editor's root element. |

## Drive it from outside

Create the controller yourself with `useOpenDrawEditor()`, pass it in, and read any state with `useEditorState()`. Every command is undoable.

```tsx
import '@opendrawjs/react/styles.css'
import { OpenDraw, useEditorState, useOpenDrawEditor } from '@opendrawjs/react'

export function Board() {
  const editor = useOpenDrawEditor()
  const selected = useEditorState(editor, (e) => e.selectedElements.length)
  const canUndo = useEditorState(editor, (e) => e.canUndo)

  return (
    <div style={{ height: '100vh' }}>
      <OpenDraw editor={editor}>
        <div className="my-actions">
          <button disabled={selected === 0} onClick={() => editor.changeStyle({ strokeColor: '#e03131' })}>
            Make it red
          </button>
          <button disabled={!canUndo} onClick={() => editor.undo()}>Undo</button>
          <button onClick={() => editor.exportPNG('diagram')}>Export PNG</button>
        </div>
      </OpenDraw>
    </div>
  )
}
```

`useEditorState(editor, read)` re-renders only when what `read` returns changes. Return values the editor already holds (like `e.selectedElements` or `e.activeTool`), not new arrays or objects made in `read`.

## Your own UI

Render only the canvas with `<OpenDrawCanvas>` and build the chrome yourself. The canvas keeps every gesture, shortcut and the text editor; add `useScenePersistence()` for autosave.

```tsx
import '@opendrawjs/react/styles.css'
import { OpenDrawCanvas, useEditorState, useOpenDrawEditor, useScenePersistence } from '@opendrawjs/react'

export function Board() {
  const editor = useOpenDrawEditor()
  useScenePersistence(editor, { persist: 'my-board' })
  const tool = useEditorState(editor, (e) => e.activeTool)

  return (
    <div className="opendraw" data-opendraw-root style={{ height: '100vh' }}>
      <OpenDrawCanvas editor={editor} />
      <nav className="my-toolbar">
        <button aria-pressed={tool === 'rectangle'} onClick={() => editor.setActiveTool('rectangle')}>Rectangle</button>
        <button aria-pressed={tool === 'arrow'} onClick={() => editor.setActiveTool('arrow')}>Arrow</button>
      </nav>
    </div>
  )
}
```

The editor controller (`EditorController`) exposes the whole API: state getters such as `elements`, `selectedElements`, `activeTool`, `theme`, `viewport`, `canUndo`; and commands such as `setActiveTool`, `changeStyle`, `changeArrowType`, `groupSelection`, `alignSelection`, `undo`, `zoomToFitAll`, `serialize`, `loadFile`, `exportPNG`, `exportSVG` and `saveToFile`. See [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor).

## Exports

| Export | |
| --- | --- |
| `OpenDraw` | The full editor. |
| `OpenDrawCanvas` | The canvas alone, for your own UI. |
| `Toolbar` · `Footer` · `ArrowTypePicker` | The built-in pieces, to compose your own layout. |
| `useOpenDrawEditor(options?)` | Create a controller for this component's lifetime. |
| `useEditorState(editor, read)` | Subscribe to a slice of editor state. |
| `useScenePersistence(editor, { persist, theme })` | Autosave and restore. |
| `createEditor` · `EditorController` | Re-exported from `@opendrawjs/editor`. |
| `OpenDrawState` · `OpenDrawElement` · `OpenDrawAppState` · `OpenDrawFile` | Scene types, re-exported from `@opendrawjs/core`. |
| `@opendrawjs/react/styles.css` | The editor styles. |

## Theming

The chrome is styled with CSS custom properties on `.opendraw`. Override them from a wrapper:

```css
.my-board .opendraw {
  --od-accent: #2563eb;
  --od-brand-active: #1d4ed8;
  --od-accent-soft: #dbeafe;
  --od-on-accent-soft: #1e3a8a;
  --od-hover: #eff6ff;
}

.my-board .opendraw[data-theme='dark'] {
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
| [`@opendrawjs/nuxt`](https://www.npmjs.com/package/@opendrawjs/nuxt) | Nuxt and Vue, with the full editor UI (properties panel, menus, many drawings). |
| [`@opendrawjs/svelte`](https://www.npmjs.com/package/@opendrawjs/svelte) | The same editor for Svelte 5. |
| [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor) | The framework-free editor. |
| [`@opendrawjs/core`](https://www.npmjs.com/package/@opendrawjs/core) | The engine: element model, history, rendering and export. |

## Links

- [Source code and full documentation](https://github.com/TheAlphaOnes/opendraw#readme)
- [Report a bug or request a feature](https://github.com/TheAlphaOnes/opendraw/issues)

opendraw is an independent project, built with gratitude to [Excalidraw](https://github.com/excalidraw/excalidraw), whose design and code it learns from (some parts are ported under Excalidraw's MIT license). It is not affiliated with Excalidraw.

## License

[MIT](https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE) © 2026 Vishnu
