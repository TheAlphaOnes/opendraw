<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/logo.svg" alt="opendraw" width="290" height="64">
</p>

<p align="center">
  <strong>Hand-drawn diagrams for Nuxt and Vue.</strong><br>
  An Excalidraw-style whiteboard as one native component: the tools, shortcuts and feel your users already know.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendrawjs/nuxt"><img src="https://img.shields.io/npm/v/@opendrawjs/nuxt?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ea580c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js&logoColor=white" alt="Nuxt 4">
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white" alt="Vue 3.5">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/screenshot.png" alt="The opendraw editor: a hand-drawn flow of three shapes joined by arrows, and a sticky note" width="860">
</p>

## Why opendraw

- **Drop-in.** `<OpenDraw />` is the whole editor: canvas, toolbar, properties panel, color picker, menus, context menu, help and autosave.
- **Familiar.** Excalidraw's tools, keyboard map, rough.js look and layout, so there is nothing new to learn.
- **Native Vue.** No iframe and no React runtime inside your app. State comes back as computed refs, and every command is undoable.
- **Headless when you need it.** Render only the canvas and build your own chrome on the same API.
- **SSR-safe.** Works with Nuxt server rendering and static generation; saved drawings load after hydration.

## Features

| | |
| --- | --- |
| **Tools** | Selection, hand, rectangle, diamond, ellipse, arrow, line, freedraw, text, sticky note, image, eraser, frame and laser pointer, with Excalidraw's letter and number keys and the tool lock (<kbd>Q</kbd>). |
| **Arrows that connect** | Lines and arrows bind to shapes and follow them. Arrows come sharp, curved or elbowed; elbow arrows route in right angles around the shapes they connect. |
| **Text** | Free text and labels inside shapes, edited in place. Sticky notes fit their text. |
| **Frames** | Group content into frames that carry and clip their children. |
| **Editing** | Groups, align and distribute, flip, layers, copy/paste styles, Alt-drag duplicate, lock, a context menu and undo/redo. |
| **Styling** | A color picker with shades, hex input and eyedropper; fill, stroke, sloppiness, edges, arrowheads, fonts and opacity. |
| **Themes** | Light, dark or the system setting. Dark mode inverts element ink; your canvas background stays as chosen. |
| **Files** | Autosave to `localStorage`, many named drawings with a drawings sidebar, open/save `.opendraw` files, export PNG and SVG. |
| **Responsive** | A desktop layout like excalidraw.com; on phones the toolbar moves to the bottom and the properties panel becomes a sheet. |
| **Accessible** | Real buttons and menus, labelled controls, keyboard navigation in every popover, reduced-motion support. |

## Install

```bash
npm install @opendrawjs/nuxt
# or: pnpm add @opendrawjs/nuxt · yarn add @opendrawjs/nuxt · bun add @opendrawjs/nuxt
```

Requires Nuxt 4 (Vue 3.5) and Node 20.19 or newer.

## Quick start

Add the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@opendrawjs/nuxt'],
})
```

Then use the component anywhere. Give it a height; it fills its container.

```vue
<!-- pages/index.vue -->
<template>
  <div style="height: 100vh">
    <OpenDraw />
  </div>
</template>
```

That's the full editor, saving to `localStorage` as you draw. Press <kbd>?</kbd> in the editor for every shortcut.

The module auto-imports the components (`<OpenDraw>`, `<OpenDrawCanvas>`, `<OpenDrawApp>`, `<OpenDrawButton>`, `<OpenDrawCopyCommand>`, `<OpenDrawShareButton>`) and the composables (`useOpenDraw`, `useDrawingFiles`, `createOpenDrawContext`, `provideOpenDraw`, `useScenePersistence`, `defineOpenDrawConfig`).

### Plain Vue 3 (Vite, no Nuxt)

The same components are available without the module:

```vue
<script setup lang="ts">
import { OpenDraw } from '@opendrawjs/nuxt/vue'
</script>

<template>
  <div style="height: 100vh">
    <OpenDraw />
  </div>
</template>
```

## `<OpenDraw>`

```vue
<script setup lang="ts">
import type { OpenDrawChangeDetail } from '@opendrawjs/nuxt/vue'

function save({ elements }: OpenDrawChangeDetail) {
  // send the scene to your API, or anywhere else
}
</script>

<template>
  <OpenDraw theme="dark" persist="team-board" grid @change="save">
    <template #top-right>
      <button>Share</button>
    </template>
  </OpenDraw>
</template>
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Starting theme. A theme the user picked (and saved) wins over it. |
| `ui` | `'full' \| 'minimal' \| 'none'` | `'full'` | `full`: every panel · `minimal`: toolbar and zoom · `none`: the bare canvas. |
| `grid` | `boolean \| number` | `false` | Show the grid; a number sets the cell size. |
| `initialElements` | `OpenDrawElement[]` | `[]` | The scene to start with when nothing is saved. |
| `persist` | `boolean \| string` | `true` | Autosave to `localStorage`. A string is the storage key; `false` turns it off. Changing the key while mounted opens the scene saved under it. |
| `menuLinks` | `{ label, href?, onSelect?, icon? }[]` | `[]` | Your links or actions in the main menu. |

| Event | Payload | |
| --- | --- | --- |
| `@change` | `{ elements, appState }` | Every document or editor-state change. |
| `@select` | `string[]` | The selected element ids. |
| `@ready` | `EditorController` | Mounted: drive the editor from outside. |

| Slot | Placement |
| --- | --- |
| `#top-left` | After the main menu, e.g. the open document's name. |
| `#top-right` | Beside the toolbar, e.g. a Share or Docs button. |
| `#footer` | Bottom-right, next to the help button. |

## `<OpenDrawApp>`: a complete drawing app in one component

`<OpenDrawApp>` is the editor filling the page, plus your buttons, a copyable install command, a Share button and many named drawings, all configured with one typed object:

```vue
<script setup lang="ts">
const config = defineOpenDrawConfig({
  files: true,
  command: { text: 'npm install my-lib', short: 'npm i my-lib' },
  links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
  share: true,
  menuLinks: [{ label: 'GitHub', href: 'https://github.com/me/my-lib', icon: 'github' }],
  onChange: ({ elements }) => console.log(elements.length),
})
</script>

<template>
  <OpenDrawApp :config="config" />
</template>
```

| Option | Type | |
| --- | --- | --- |
| `files` | `boolean \| { indexKey? }` | Many named drawings (see below). |
| `command` | `string \| { text, short?, glow?, prompt? }` | A copyable command pill, top-right. |
| `links` | `{ label, icon?, to?, href?, variant?, onClick? }[]` | Top-right buttons. |
| `share` | `boolean \| { url?, title?, label? }` | A Share button: the share sheet on phones, copy-link elsewhere. |
| `menuLinks` | `{ label, href?, onSelect?, icon? }[]` | Entries in the main menu. |
| `theme` · `persist` · `grid` · `initialElements` | | The same as on `<OpenDraw>` (`persist` is ignored with `files`). |
| `fullscreen` | `boolean` | Fill the viewport (default) or the parent element. |
| `onReady` · `onChange` · `onSelect` · `onCopy` · `onShare` | functions | Hooks; also emitted as `@ready`, `@change`, `@select`, `@copy`, `@share`. |

### Many drawings

With `files: true`, a **Drawings** button next to the main menu (or the menu itself on phones) opens a sidebar where users create, open, search, rename, duplicate and delete drawings. Each drawing saves on its own with a preview, the open one comes back after a reload, and a drawing made before `files` was turned on becomes the first one. Drawings live in the browser's `localStorage`.

Build your own UI on the same store with `useDrawingFiles()` inside `<OpenDrawApp>`:

```ts
const { files, active, create, open, rename, duplicate, remove } = useDrawingFiles()
```

## `useOpenDraw()`

Any component inside `<OpenDraw>` can read and drive the editor. State comes back as computed refs.

```vue
<script setup lang="ts">
const { selectedElements, changeStyle, exportPNG, undo, canUndo } = useOpenDraw()
</script>

<template>
  <button :disabled="selectedElements.length === 0" @click="changeStyle({ strokeColor: '#e03131' })">Make it red</button>
  <button :disabled="!canUndo" @click="undo()">Undo</button>
  <button @click="exportPNG('diagram')">Export PNG</button>
</template>
```

| Group | Members |
| --- | --- |
| State | `elements`, `selectedElements`, `appState`, `activeTool`, `theme`, `viewport`, `gridSize`, `viewBackgroundColor`, `canUndo`, `canRedo` |
| Tools and theme | `setActiveTool`, `toggleToolLock`, `setTheme`, `toggleTheme`, `setGridSize`, `setViewBackgroundColor` |
| Selection | `select`, `selectAll`, `isIdSelected` |
| Elements | `updateElement`, `deleteSelection`, `duplicateSelection`, `copySelection`, `cutSelection`, `paste`, `insertImageFiles` |
| Style and arrange | `changeStyle`, `changeTextStyle`, `changeRoundness`, `changeArrowType`, `changeArrowhead`, `copyStyles`, `pasteStyles`, `groupSelection`, `ungroupSelection`, `alignSelection`, `distributeSelection`, `flipSelection`, `reorderSelection` |
| History and view | `undo`, `redo`, `zoomIn`, `zoomOut`, `resetZoom`, `zoomToFitAll`, `zoomToFitSelection`, `panBy` |
| Files | `serialize`, `toJSON`, `loadFile`, `loadJSON`, `saveToFile`, `openFile`, `exportPNG`, `exportSVG`, `exportDataURL`, `clearCanvas` |
| Escape hatch | `editor` (the framework-free controller) and `doc` (the scene document) |

## Your own UI

Render just the canvas and bring your own toolbar. The canvas keeps every gesture, shortcut and the text editor; you only draw the buttons.

```vue
<script setup lang="ts">
const ctx = createOpenDrawContext()
provideOpenDraw(ctx)
</script>

<template>
  <div class="board">
    <OpenDrawCanvas />
    <nav class="my-toolbar">
      <button @click="ctx.setActiveTool('rectangle')">Rectangle</button>
      <button @click="ctx.setActiveTool('arrow')">Arrow</button>
      <button :disabled="!ctx.canUndo.value" @click="ctx.undo()">Undo</button>
    </nav>
  </div>
</template>
```

## Theming

The chrome is styled with CSS custom properties on `.opendraw-root`. Override them from a wrapper to match your brand:

```css
.my-board .opendraw-root {
  --od-accent: #2563eb;          /* primary buttons, selection, focus rings */
  --od-brand-active: #1d4ed8;    /* pressed primary buttons */
  --od-accent-soft: #dbeafe;     /* the active tool and selected options */
  --od-on-accent-soft: #1e3a8a;  /* text and icons on --od-accent-soft */
  --od-hover: #eff6ff;           /* hovered buttons and rows */
  --od-surface-high: #eff6ff;    /* the open item in lists */
  --od-border: #dbeafe;          /* panel outlines */
}

.my-board .opendraw-root[data-theme='dark'] {
  --od-accent: #60a5fa;
  --od-brand-active: #93c5fd;
  --od-accent-soft: #1e3a8a;
  --od-on-accent-soft: #dbeafe;
  --od-hover: #1e2a44;
  --od-surface-high: #1e2a44;
  --od-border: #1e3a8a;
}
```

## Keyboard shortcuts

| | | | |
| --- | --- | --- | --- |
| <kbd>V</kbd> / <kbd>1</kbd> Select | <kbd>R</kbd> / <kbd>2</kbd> Rectangle | <kbd>D</kbd> / <kbd>3</kbd> Diamond | <kbd>O</kbd> / <kbd>4</kbd> Ellipse |
| <kbd>A</kbd> / <kbd>5</kbd> Arrow | <kbd>L</kbd> / <kbd>6</kbd> Line | <kbd>P</kbd> / <kbd>7</kbd> Draw | <kbd>T</kbd> / <kbd>8</kbd> Text |
| <kbd>N</kbd> Sticky note | <kbd>9</kbd> Image | <kbd>E</kbd> / <kbd>0</kbd> Eraser | <kbd>F</kbd> Frame · <kbd>K</kbd> Laser |
| <kbd>⌘</kbd> <kbd>Z</kbd> Undo | <kbd>⌘</kbd> <kbd>G</kbd> Group | <kbd>⌘</kbd> <kbd>D</kbd> Duplicate | <kbd>?</kbd> All shortcuts |

On Windows and Linux, <kbd>Ctrl</kbd> replaces <kbd>⌘</kbd>.

## Other frameworks

| Package | |
| --- | --- |
| [`@opendrawjs/react`](https://www.npmjs.com/package/@opendrawjs/react) | The same editor for React. |
| [`@opendrawjs/svelte`](https://www.npmjs.com/package/@opendrawjs/svelte) | The same editor for Svelte 5. |
| [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor) | The framework-free editor, to build an adapter for anything else. |
| [`@opendrawjs/core`](https://www.npmjs.com/package/@opendrawjs/core) | The engine: element model, history, rendering and export. |

## Links

- [Source code and full documentation](https://github.com/TheAlphaOnes/opendraw#readme)
- [Report a bug or request a feature](https://github.com/TheAlphaOnes/opendraw/issues)

opendraw is an independent implementation, not affiliated with the Excalidraw team. It builds on [rough.js](https://github.com/rough-stuff/rough), [perfect-freehand](https://github.com/steveruizok/perfect-freehand) and [Lucide](https://lucide.dev) icons.

## License

[MIT](https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE) © 2026 Vishnu
