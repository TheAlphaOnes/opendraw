<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/TheAlphaOnes/opendraw@master/docs/assets/logo.svg" alt="opendraw" width="290" height="64">
</p>

<p align="center">
  <strong>The opendraw engine.</strong><br>
  The element model, scene document, geometry, rendering and export behind the opendraw whiteboard.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendrawjs/core"><img src="https://img.shields.io/npm/v/@opendrawjs/core?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ea580c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/runs%20in-browser%20%7C%20Node-1b1b1f" alt="Runs in the browser and Node">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

`@opendrawjs/core` has no UI and no framework. Use it to create, edit and export opendraw scenes in code, in the browser or in Node: generate diagrams on a server, convert saved drawings to SVG, or validate files.

**Looking for an editor?** Install one of these instead; they include core:

| Package | |
| --- | --- |
| [`@opendrawjs/nuxt`](https://www.npmjs.com/package/@opendrawjs/nuxt) | Nuxt and Vue, with the full editor UI. |
| [`@opendrawjs/react`](https://www.npmjs.com/package/@opendrawjs/react) | React. |
| [`@opendrawjs/svelte`](https://www.npmjs.com/package/@opendrawjs/svelte) | Svelte 5. |
| [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor) | The interactive editor without a UI framework. |

## Install

```bash
npm install @opendrawjs/core
```

## Example: build a scene and export it

```ts
import {
  OpenDrawDocument,
  buildFile,
  exportToSvg,
  newLinearElement,
  newRectangleElement,
  newTextElement,
  serializeToJSON,
} from '@opendrawjs/core'

const doc = new OpenDrawDocument()

doc.addElement(newRectangleElement({ x: 0, y: 0, width: 160, height: 90 }))
doc.addElement(newTextElement({ x: 24, y: 32, text: 'Hello' }))
doc.addElement(newLinearElement('arrow', { x: 170, y: 45, points: [{ x: 0, y: 0 }, { x: 120, y: 0 }] }))

// An SVG string: works in Node, no DOM needed.
const svg = exportToSvg(doc.getElements(), '#ffffff', { padding: 20 })

// The .opendraw file format, ready to save or send.
const json = serializeToJSON(buildFile(doc.getElements(), '#ffffff'))
```

## What's inside

| Area | Highlights |
| --- | --- |
| **Elements** | Rectangle, diamond, ellipse, line, arrow (sharp, curved or elbow), freedraw, text, image, frame and sticky note, created with `newRectangleElement`, `newLinearElement`, `newTextElement`, `newElement(type, options)` and friends. |
| **Document** | `OpenDrawDocument` holds the elements and editor state, with selection, groups, frames, styling, arrange and align commands, `subscribe()` and gesture-sized `undo()` / `redo()`. |
| **Geometry** | Bounds, hit testing, rotation and resize transforms, arrow binding and elbow-arrow routing. |
| **Rendering** | `renderScene(ctx, input)` draws a scene onto any 2D canvas with rough.js, light or dark. |
| **Export** | `exportToSvg`, `exportToCanvas` / `exportToDataURL` / `exportToBlob` (PNG, browser), `serializeToJSON` / `parseFromJSON` for the file format. |
| **Safe parsing** | `parseFile` and `parseFromJSON` repair or drop malformed elements instead of trusting input. |

## Reading a saved drawing

```ts
import { exportToSvg, parseFromJSON } from '@opendrawjs/core'

const file = parseFromJSON(await readFile('diagram.opendraw', 'utf8'))
const svg = exportToSvg(file.elements, file.appState.viewBackgroundColor)
```

## Editing through the document

All changes go through the document, so they are tracked for undo and announced to subscribers:

```ts
const doc = new OpenDrawDocument()
const unsubscribe = doc.subscribe((state) => console.log(state.elements.length))

const box = newRectangleElement({ x: 0, y: 0, width: 100, height: 60 })
doc.addElement(box, { select: true })
doc.changeStyle({ strokeColor: '#e03131', backgroundColor: '#ffc9c9', fillStyle: 'solid' })
doc.undo()
```

## Links

- [Source code and full documentation](https://github.com/TheAlphaOnes/opendraw#readme)
- [Report a bug or request a feature](https://github.com/TheAlphaOnes/opendraw/issues)

opendraw is an independent project, built with gratitude to [Excalidraw](https://github.com/excalidraw/excalidraw), whose design and code it learns from (some parts are ported under Excalidraw's MIT license). It is not affiliated with Excalidraw. It builds on [rough.js](https://github.com/rough-stuff/rough) and [perfect-freehand](https://github.com/steveruizok/perfect-freehand).

## License

[MIT](https://github.com/TheAlphaOnes/opendraw/blob/master/LICENSE) © 2026 Vishnu
