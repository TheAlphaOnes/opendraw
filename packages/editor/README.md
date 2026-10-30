<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/logo.svg" alt="opendraw" width="290" height="64">
</p>

<p align="center">
  <strong>The framework-free opendraw editor.</strong><br>
  Everything interactive about an Excalidraw-style whiteboard, with no UI framework.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendrawjs/editor"><img src="https://img.shields.io/npm/v/@opendrawjs/editor?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ea580c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/dependencies-framework--free-1b1b1f" alt="Framework-free">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

`@opendrawjs/editor` is the layer every opendraw adapter is built on. It owns the document, the editor state and every command, and it mounts onto two canvases to handle drawing, selection, transforms, binding, text editing, keyboard shortcuts and rendering. The [Vue/Nuxt](https://www.npmjs.com/package/@opendrawjs/nuxt), [React](https://www.npmjs.com/package/@opendrawjs/react) and [Svelte](https://www.npmjs.com/package/@opendrawjs/svelte) packages are thin layers over it.

**Use it directly** to put opendraw in plain JavaScript, or to write an adapter for Solid, Angular, Lit or anything else. If you use Vue, React or Svelte, install that package instead.

## Install

```bash
npm install @opendrawjs/editor
```

## Quick start

A host element holding two stacked canvases is all the markup the editor needs:

```html
<div id="board" class="opendraw" data-opendraw-root style="height: 100vh">
  <div id="host" class="opendraw__host" tabindex="0">
    <canvas id="scene" class="opendraw__static"></canvas>
    <canvas id="overlay" class="opendraw__overlay"></canvas>
  </div>
</div>
```

```ts
import '@opendrawjs/editor/styles.css'
import { attachScenePersistence, createEditor, mountCanvas } from '@opendrawjs/editor'

const editor = createEditor()

const session = mountCanvas(editor, {
  host: document.getElementById('host')!,
  staticCanvas: document.getElementById('scene') as HTMLCanvasElement,
  overlayCanvas: document.getElementById('overlay') as HTMLCanvasElement,
})

// Optional: autosave to localStorage and restore the last scene.
const persistence = attachScenePersistence(editor, { storageKey: 'my-board' })
persistence.restore()

// Keep the chrome's theme in step with the editor (the adapters do this for you).
const board = document.getElementById('board')!
editor.subscribe((ed) => (board.dataset.theme = ed.theme))

editor.setActiveTool('rectangle')

// When the board goes away:
// persistence.dispose(); session.dispose()
```

Every gesture and shortcut now works on the canvas. Add your own buttons and drive the editor from them.

## Reading state

`subscribe()` fires after every document or editor-state change. The getters are memoized per change, so reading them is cheap.

```ts
const unsubscribe = editor.subscribe((ed) => {
  undoButton.disabled = !ed.canUndo
  toolLabel.textContent = ed.activeTool
  countLabel.textContent = `${ed.selectedElements.length} selected`
})
```

| State | |
| --- | --- |
| `elements` · `selectedElements` · `selectedGroupIds` | The scene and the selection. |
| `activeTool` · `toolLocked` | The armed tool. |
| `appState` · `state` | All editor state, and `{ elements, appState }` together. |
| `theme` · `viewport` · `viewportSize` · `gridSize` · `viewBackgroundColor` | View settings. |
| `canUndo` · `canRedo` · `clipboardSize` · `hasCopiedStyles` | What the next command can do. |
| `editingId` · `editingGroupId` | The text or group being edited. |

## Commands

Every command is a single undoable step.

| Group | Commands |
| --- | --- |
| Tools and view | `setActiveTool`, `toggleToolLock`, `setTheme`, `toggleTheme`, `setGridSize`, `setViewBackgroundColor`, `zoomIn`, `zoomOut`, `resetZoom`, `zoomToFitAll`, `zoomToFitSelection`, `panBy` |
| Selection | `select`, `selectGrouped`, `selectAll`, `isIdSelected` |
| Elements | `updateElement`, `deleteSelection`, `duplicateSelection`, `copySelection`, `cutSelection`, `paste`, `insertImageFiles`, `openImagePicker`, `toggleSelectionLock`, `clearCanvas` |
| Style | `changeStyle`, `changeTextStyle`, `changeRoundness`, `changeArrowType`, `changeArrowhead`, `stepFontSize`, `copyStyles`, `pasteStyles` |
| Arrange | `groupSelection`, `ungroupSelection`, `alignSelection`, `distributeSelection`, `flipSelection`, `reorderSelection` |
| History | `undo`, `redo` |
| Files | `serialize`, `toJSON`, `loadFile`, `loadJSON`, `saveToFile`, `openFile`, `exportPNG`, `exportSVG`, `exportDataURL` |

```ts
editor.changeStyle({ strokeColor: '#e03131', fillStyle: 'hachure' })
editor.changeArrowType('elbow')
editor.alignSelection({ axis: 'x', position: 'start' }) // align left edges
editor.exportSVG('diagram')
```

`editor.doc` is the underlying scene document from [`@opendrawjs/core`](https://www.npmjs.com/package/@opendrawjs/core), for anything lower-level.

## Building a toolbar and menus

The tool table and the action registry are the same definitions the keyboard handler uses, so a UI built from them always matches the shortcuts.

```ts
import { TOOLS, actionById, isActionEnabled, runAction, toolKeyHint } from '@opendrawjs/editor'

for (const tool of TOOLS) {
  // tool.tool ('rectangle'), tool.name ('Rectangle'), tool.icon, tool.keys
  addButton(tool.name, toolKeyHint(tool), () => editor.setActiveTool(tool.tool))
}

const exportPng = actionById('exportPNG') // label, icon, keys
addMenuItem(exportPng.label, () => runAction(editor, 'exportPNG'), isActionEnabled(editor, 'exportPNG'))
```

Icons are semantic names (`IconName`, such as `'rectangle'` or `'undo'`); map them to any icon set. The official adapters use [Lucide](https://lucide.dev).

## Many drawings

`createDrawingFiles()` keeps many named drawings in `localStorage`, each scene under its own key, with previews and edit times. Point scene persistence at the open drawing, and switching drawings is switching the key:

```ts
import { attachScenePersistence, createDrawingFiles } from '@opendrawjs/editor'

const files = createDrawingFiles()
const persistence = attachScenePersistence(editor, { storageKey: files.active.storageKey })
persistence.restore()

editor.subscribe((ed) =>
  files.recordScene(files.active.id, {
    elements: ed.elements,
    viewBackgroundColor: ed.viewBackgroundColor,
    theme: ed.theme,
  }),
)

files.subscribe(({ files: list, activeId }) => renderList(list, activeId))

function openDrawing(id: string) {
  files.open(id)
  persistence.switchTo(files.active.storageKey) // saves the old scene, loads the new one
}
```

The library also offers `create`, `rename`, `duplicate`, `remove` and `thumbnail(id)`. It follows changes made in other tabs and rebuilds a damaged index from the scenes it can still find.

## Styles

`@opendrawjs/editor/styles.css` styles the canvas host and the chrome classes (`.opendraw`, `.opendraw__host`, toolbars, islands). The look is set by CSS custom properties on `.opendraw`, such as `--od-accent`, `--od-surface` and `--od-ink`, and dark mode by `data-theme="dark"` on the same element.

## Links

- [Source code and full documentation](https://github.com/TheAlphaOnes/opendraw#readme), including a guide to writing your own adapter
- [Report a bug or request a feature](https://github.com/TheAlphaOnes/opendraw/issues)

## License

[MIT](https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE) © 2026 Vishnu
