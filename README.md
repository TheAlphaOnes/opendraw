# vuedraw

An [Excalidraw](https://excalidraw.com)-style hand-drawn canvas for the Nuxt 4 ecosystem.

Draw rectangles, diamonds, ellipses, arrows, lines, freehand strokes, and text
with the rough.js hand-drawn look, on a canvas that behaves the way Excalidraw
taught everyone to expect: drag to create, click an edge to select, handles to
resize and rotate, one undo entry per gesture, escape to commit text.

vuedraw ships as a Nuxt module, built on a framework-free engine.

## Packages

| Package | What it is |
| --- | --- |
| [`vuedraw`](./packages/nuxt) | The Nuxt module. Registers the `<VueDraw>` and `<VueDrawCanvas>` components and auto-imports the `useVueDraw()` family. Ships the editor chrome: tool dock, style and actions panels, context menu. |
| [`@vuedraw/core`](./packages/core) | The engine. Element model, geometry, scene document with snapshot history, hit testing, transforms, the rough.js renderer, and PNG/JSON export. No Vue or Nuxt imports, so it is usable standalone in any TypeScript project. |

## Requirements

* Nuxt 4
* Node 20.19+

## Quickstart

```bash
pnpm add vuedraw
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vuedraw'],
})
```

```vue
<template>
  <VueDraw theme="light" @change="onChange" @select="onSelect" />
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
as `VueDrawElement` come from `@vuedraw/core` (a direct dependency of vuedraw);
add it to your own dependencies if you want explicit type imports.

## API

### `<VueDraw>`

The full editor, ready to drop on a page.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `ui` | `'full' \| 'minimal' \| 'none'` | `'full'` | Chrome level. `full` adds the tool dock, style panel, actions panel, and context menu. `minimal` keeps the dock and actions. `none` is the bare canvas for custom UI. |
| `theme` | `'light' \| 'dark'` | `'light'` | Editor theme. Switching swaps the default canvas background (`#ffffff` <-> `#121212`); a background you customized is left untouched. |
| `grid` | `boolean \| number` | `false` | `true` shows a 20px grid; a number sets the cell size. |
| `initialElements` | `VueDrawElement[]` | `[]` | Scene to open with. |

| Event | Payload | Fires |
| --- | --- | --- |
| `change` | `{ elements, appState }` | On every scene mutation. `elements` is the full scene, in z-order. |
| `select` | `ids: string[]` | When the selection set changes. |

### `<VueDrawCanvas>`

The canvas on its own: pointer interactions, rendering, and the text editing
session. No chrome and no context creation. Pair it with
`createVueDrawContext()`.

### `useVueDraw()`

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

`<VueDraw ui="none" />` and `<VueDrawCanvas />` render no chrome. Create the
context yourself, provide it, and talk to the same API the shipped chrome
uses:

```vue
<script setup lang="ts">
const ctx = createVueDrawContext({
  // The dark theme inverts element colors, so give the canvas a dark
  // background to go with it.
  appState: { theme: 'dark', viewBackgroundColor: '#121212' },
})
provideVueDraw(ctx)
</script>

<template>
  <div class="stage">
    <VueDrawCanvas />

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

`createVueDrawContext(options?)` accepts `elements` (the initial scene) and
`appState` (a partial state: theme, background, grid, and friends).
`useVueDraw()` inside any descendant returns the provided context.

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
pnpm build              # build @vuedraw/core and the vuedraw module
pnpm test               # run the test suites (core: 111 tests)
pnpm typecheck          # typecheck every package
pnpm build:playground   # production build of the playground
```

The playground is the manual verification surface: `/` is the full editor,
`/headless` is the bare canvas with custom chrome.

## License

[MIT](./LICENSE)
