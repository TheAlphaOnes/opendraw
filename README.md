# opendraw

An Excalidraw-style hand-drawn canvas for the Nuxt 4 ecosystem. Drop `<OpenDraw />` into any Nuxt app and get the full whiteboard: shapes, arrows, freehand, text, selection, transforms, undo/redo, themes, and export.

opendraw is a pnpm monorepo built on a framework-free engine, published as a Nuxt module.

## Features

- **The full toolset** — selection, hand (pan), rectangle, diamond, ellipse, arrow, line, freedraw, text, and eraser
- **Hand-drawn rendering** — rough.js sketch geometry for shapes, perfect-freehand pressure-aware strokes for freedraw
- **Excalidraw-grade interaction** — drag to create, click an edge to select, handles to resize and rotate, marquee select, modifier snapping
- **Gesture-level history** — snapshot undo/redo where one undo reverts one gesture, not one keystroke
- **Text editing in place** — a per-session editor with a stable layout box, so the caret behaves during IME composition and fast typing
- **Themes** — dark mode inverts element colors in-canvas; your canvas background is user data and is never filtered
- **Export** — PNG download and JSON scene save/load
- **Headless mode** — every panel is optional; build your own UI on the same editor context
- **A framework-free core** — `@opendraw/core` runs anywhere TypeScript does: tests, workers, other frameworks

## Credits

opendraw exists because [Excalidraw](https://github.com/excalidraw/excalidraw) showed how a canvas editor should feel. Its behavior contract was learned by reading the Excalidraw codebase: the element model, the single mutation funnel and history semantics, selection and transform math, text WYSIWYG, and the two-canvas render split. opendraw is an independent implementation for the Nuxt ecosystem; it is not a fork and is not affiliated with the Excalidraw team.

Built on open source:

- [Excalidraw](https://github.com/excalidraw/excalidraw) — the behavioral blueprint, [MIT](https://github.com/excalidraw/excalidraw/blob/master/LICENSE)
- [rough.js](https://github.com/roughjs/rough) — hand-drawn shape geometry, MIT
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) — pressure-aware freehand strokes, MIT
- [Nuxt](https://nuxt.com) and [Vue](https://vuejs.org) — the ecosystem this is built for

## Packages

| Package | What it is |
| --- | --- |
| [`opendraw`](./packages/nuxt) | The Nuxt module. Registers the `<OpenDraw>` and `<OpenDrawCanvas>` components and auto-imports the `useOpenDraw()` family. Ships the editor chrome: tool dock, style and actions panels, context menu. |
| [`@opendraw/core`](./packages/core) | The engine. Element model, geometry, scene document with snapshot history, hit testing, transforms, the rough.js renderer, and PNG/JSON export. No Vue or Nuxt imports, so it is usable standalone in any TypeScript project. |

## Requirements

* Nuxt 4
* Node 20.19+

## Quickstart

```bash
pnpm add opendraw
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['opendraw'],
})
```

```vue
<template>
  <OpenDraw theme="light" @change="onChange" @select="onSelect" />
</template>

<script setup lang="ts">
function onChange({ elements }: { elements: readonly unknown[] }) {
  // fires on every scene mutation; elements is the full scene in z-order.
  // autosave here.
}

function onSelect(ids: string[]) {
  // the ids of the currently selected elements
}
</script>
```

Components and composables are auto-imported by the module. Element types such
as `OpenDrawElement` come from `@opendraw/core` (a direct dependency of opendraw);
add it to your own dependencies if you want explicit type imports.

## API

### `<OpenDraw>`

The full editor, ready to drop on a page.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `ui` | `'full' \| 'minimal' \| 'none'` | `'full'` | Chrome level. `full` adds the tool dock, style panel, actions panel, and context menu. `minimal` keeps the dock and actions. `none` is the bare canvas for custom UI. |
| `theme` | `'light' \| 'dark'` | `'light'` | Editor theme. Switching swaps the default canvas background (`#ffffff` to `#121212` and back); a background you customized is left untouched. |
| `grid` | `boolean \| number` | `false` | `true` shows a 20px grid; a number sets the cell size. |
| `initialElements` | `OpenDrawElement[]` | `[]` | Scene to open with. |

| Event | Payload | Fires |
| --- | --- | --- |
| `change` | `{ elements, appState }` | On every scene mutation. `elements` is the full scene, in z-order. |
| `select` | `ids: string[]` | When the selection set changes. |

### `<OpenDrawCanvas>`

The canvas on its own: pointer interactions, rendering, and the text editing
session. No chrome and no context creation. Pair it with
`createOpenDrawContext()`.

### `useOpenDraw()`

The editor context. Every shipped component consumes it through
provide/inject, and any chrome you build consumes the same:

| Group | Members |
| --- | --- |
| document | `doc`, `state`, `elements`, `appState`, `selectedElements` |
| tools & theme | `activeTool`, `setActiveTool`, `theme`, `setTheme`, `toggleTheme` |
| selection | `select`, `selectAll`, `isIdSelected` |
| elements | `updateElement`, `deleteSelection`, `duplicateSelection`, `reorderSelection`, `toggleSelectionLock` |
| clipboard | `copySelection`, `cutSelection`, `paste`, `clipboardSize` |
| style | `changeStyle`, `changeTextStyle` |
| history | `undo`, `redo`, `canUndo`, `canRedo` |
| viewport | `zoomIn`, `zoomOut`, `zoomAt`, `resetZoom`, `panBy`, `viewport` |
| export | `serialize`, `toJSON`, `loadFile`, `loadJSON`, `exportPNG`, `exportDataURL` |
| editing | `setEditing`, `editingId` |
| grid | `gridSize`, `setGridSize` |

Reactive members are refs and computeds: read `ctx.elements.value` in script,
`ctx.elements` in templates.

## Headless: build your own UI

`<OpenDraw ui="none" />` and `<OpenDrawCanvas />` render no chrome. Create the
context yourself, provide it, and talk to the same API the shipped chrome
uses:

```vue
<script setup lang="ts">
const ctx = createOpenDrawContext({
  // The dark theme inverts element colors, so give the canvas a dark
  // background to go with it.
  appState: { theme: 'dark', viewBackgroundColor: '#121212' },
})
provideOpenDraw(ctx)
</script>

<template>
  <div class="stage">
    <OpenDrawCanvas />

    <div class="dock">
      <button
        type="button"
        :class="{ active: ctx.activeTool.value === 'rectangle' }"
        @click="ctx.setActiveTool('rectangle')"
      >
        rect
      </button>
      <button type="button" :disabled="!ctx.canUndo.value" @click="ctx.undo()">
        undo
      </button>
      <button type="button" @click="ctx.exportPNG('drawing')">export</button>
    </div>
  </div>
</template>
```

`createOpenDrawContext(options?)` accepts `elements` (the initial scene) and
`appState` (a partial state: theme, background, grid, and friends).
`useOpenDraw()` inside any descendant returns the provided context.

The complete headless example lives in
[`playground/app/pages/headless.vue`](./playground/app/pages/headless.vue).

## Tools

`selection`, `hand` (pan), `rectangle`, `diamond`, `ellipse`, `arrow`, `line`,
`freedraw`, `text`, `eraser`.

## Development

This is a pnpm monorepo:

```bash
pnpm install            # workspace dependencies
pnpm dev                # prepare packages, then run the playground at :3000
pnpm build              # build @opendraw/core and the opendraw module
pnpm test               # run the test suites (core: 111 tests)
pnpm typecheck          # typecheck every package
pnpm build:playground   # production build of the playground
```

The playground is the manual verification surface: `/` is the full editor,
`/headless` is the bare canvas with custom chrome.

## License

[MIT](./LICENSE)
