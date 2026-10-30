# @opendrawjs/editor

The **framework-free** opendraw editor: everything interactive about an Excalidraw-style whiteboard, with no UI framework. The Vue/Nuxt, React and Svelte packages are thin adapters over it; use it directly to build your own.

- `createEditor()`: document, editor state and every command
- `mountCanvas()`: gestures, keyboard, rendering and in-place text editing on a host element
- the action registry, the tool table and the semantic icon contract
- `attachScenePersistence()`: localStorage autosave; `createDrawingFiles()`: many named drawings
- `styles.css`: the shared chrome styles

```bash
npm install @opendrawjs/editor
```

```html
<div id="board" style="position: relative; height: 100vh">
  <canvas id="scene" style="position: absolute; inset: 0"></canvas>
  <canvas id="overlay" style="position: absolute; inset: 0"></canvas>
</div>
```

```ts
import '@opendrawjs/editor/styles.css'
import { createEditor, mountCanvas } from '@opendrawjs/editor'

const editor = createEditor()
const session = mountCanvas(editor, {
  host: document.getElementById('board')!,
  staticCanvas: document.getElementById('scene') as HTMLCanvasElement,
  overlayCanvas: document.getElementById('overlay') as HTMLCanvasElement,
})
editor.setActiveTool('rectangle')
// later: session.dispose()
```

Full documentation: [https://github.com/TheAlphaOnes/opendraw](https://github.com/TheAlphaOnes/opendraw#readme)

MIT License
