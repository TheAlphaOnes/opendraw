<script setup lang="ts">
/** @opendrawjs/core and @opendrawjs/editor reference. */
const CORE = `import {
  OpenDrawDocument,
  newRectangleElement,
  exportToSvg,
  parseFile,
  serializeToJSON,
} from '@opendrawjs/core'

const doc = new OpenDrawDocument()
doc.addElement(newRectangleElement({ x: 0, y: 0, width: 160, height: 90 }))

// Every write is one undoable step; listeners hear each change.
doc.subscribe((state) => console.log(state.elements.length))
doc.undo()

// Export without a browser canvas:
const svg = exportToSvg(doc.getElements(), '#ffffff', { padding: 16 })
const json = serializeToJSON(doc.serialize())
const restored = parseFile(JSON.parse(json))`

const EDITOR = `import { createEditor, mountCanvas, runAction } from '@opendrawjs/editor'

const editor = createEditor({ appState: { theme: 'light' } })

const session = mountCanvas(editor, {
  host,          // a positioned element the canvases fill
  staticCanvas,  // the scene
  overlayCanvas, // selection chrome, stacked on top
})

editor.subscribe((ed) => renderMyToolbar(ed.activeTool, ed.canUndo))
editor.setActiveTool('rectangle')
runAction(editor, 'undo')

// later
session.dispose()`

const PERSIST = `import { attachScenePersistence } from '@opendrawjs/editor'

const persistence = attachScenePersistence(editor, { storageKey: 'my-board' })
persistence.restore()  // load the saved scene, if any
// ...
persistence.dispose()  // flushes the last save`
</script>

<template>
  <section id="core" class="doc-section">
    <h2>@opendrawjs/core</h2>
    <p>
      The engine has no framework or DOM requirement. <code>OpenDrawDocument</code> holds the elements, the app state
      and history; every change goes through it, so undo, redo and change events always agree. Elements are plain,
      immutable objects — the shapes of the whiteboard (rectangle, diamond, ellipse, arrow, line, freedraw, text,
      image, frame, sticky note).
    </p>
    <DocsCode title="core.ts" :code="CORE" />
    <ul>
      <li><strong>Factories:</strong> <code>newRectangleElement</code>, <code>newLinearElement</code>, <code>newTextElement</code>, <code>newStickyNoteElement</code>, <code>newFrameElement</code>, …</li>
      <li><strong>Export:</strong> <code>exportToSvg</code>, <code>exportToDataURL</code> (PNG), with padding, scale, theme and background options.</li>
      <li><strong>Files:</strong> <code>parseFile</code> validates untrusted JSON and drops malformed elements; <code>serializeToJSON</code> writes the <code>.opendraw</code> format.</li>
      <li><strong>Rendering:</strong> <code>renderScene</code> and <code>renderOverlay</code> paint onto any 2D canvas context.</li>
    </ul>
  </section>

  <section id="editor" class="doc-section">
    <h2>@opendrawjs/editor</h2>
    <p>
      The whole interactive editor without a UI framework: <code>createEditor()</code> returns a controller (state
      getters plus commands), and <code>mountCanvas()</code> wires every gesture, shortcut, the text editor and
      rendering onto three DOM elements. <code>subscribe()</code> announces each change — that is all a UI layer needs.
    </p>
    <DocsCode title="editor.ts" :code="EDITOR" />
    <ul>
      <li><strong>Tools:</strong> <code>TOOLS</code> lists every tool with its icon name, label and keys — render your toolbar from it.</li>
      <li><strong>Actions:</strong> <code>ACTIONS</code> / <code>runAction</code> / <code>isActionEnabled</code> — the commands behind menus and shortcuts, with labels and key hints.</li>
      <li><strong>Icons:</strong> actions and tools name a semantic <code>IconName</code>; your adapter maps each name to any icon set.</li>
    </ul>
    <h3 id="persistence">Persistence</h3>
    <DocsCode title="persistence.ts" :code="PERSIST" />
  </section>
</template>
