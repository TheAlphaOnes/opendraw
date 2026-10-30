<script setup lang="ts">
/** Building an adapter for another framework on @opendrawjs/editor. */
const MARKUP = `<div class="board" data-opendraw-root>
  <div class="board__host" tabindex="0">
    <canvas class="board__static"></canvas>
    <canvas class="board__overlay"></canvas>
  </div>
  <!-- your toolbar, panels and menus go here -->
</div>`

const CSS = `.board__host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
  touch-action: none;   /* pens and touch draw instead of scrolling */
  user-select: none;
}

.board__static,
.board__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* the host receives every pointer event */
}`

const VANILLA = `import { TOOLS, createEditor, mountCanvas, toolLabel } from '@opendrawjs/editor'

const root = document.querySelector('.board')
const editor = createEditor()

const session = mountCanvas(editor, {
  host: root.querySelector('.board__host'),
  staticCanvas: root.querySelector('.board__static'),
  overlayCanvas: root.querySelector('.board__overlay'),
  onContextMenu: ({ x, y, target }) => openMyMenu(x, y, target),
})

// A toolbar from the tool table, kept in sync on every change.
const toolbar = root.querySelector('.toolbar')
for (const def of TOOLS) {
  const button = document.createElement('button')
  button.textContent = toolLabel(def)          // "Rectangle (2)"
  button.onclick = () => editor.setActiveTool(def.tool)
  toolbar.append(button)
}
editor.subscribe((ed) => {
  toolbar.querySelectorAll('button').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(TOOLS[i].tool === ed.activeTool))
  })
})

// Tear down with your component.
// session.dispose()`

const REACT = `import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createEditor, mountCanvas, type EditorController } from '@opendrawjs/editor'

/** Mirror the controller into React: re-render on every change. */
export function useEditorState<T>(editor: EditorController, read: (e: EditorController) => T): T {
  return useSyncExternalStore(
    (onChange) => editor.subscribe(onChange),
    () => read(editor),
  )
}

export function Board({ editor }: { editor: EditorController }) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const tool = useEditorState(editor, (e) => e.activeTool)

  useEffect(() => {
    const session = mountCanvas(editor, {
      host: host.current!,
      staticCanvas: scene.current!,
      overlayCanvas: overlay.current!,
    })
    return () => session.dispose()
  }, [editor])

  return (
    <div className="board" data-opendraw-root>
      <div ref={host} className="board__host" tabIndex={0}>
        <canvas ref={scene} className="board__static" />
        <canvas ref={overlay} className="board__overlay" />
      </div>
      <button aria-pressed={tool === 'rectangle'} onClick={() => editor.setActiveTool('rectangle')}>
        Rectangle
      </button>
    </div>
  )
}

// const editor = createEditor()  — create once, outside render`
</script>

<template>
  <section id="adapters" class="doc-section">
    <h2>Build an adapter for your framework</h2>
    <p>
      The Vue, React and Svelte packages are thin layers over <code>@opendrawjs/editor</code> — read
      <code>packages/react</code> or <code>packages/svelte</code> for complete references — and you can write the same
      layer for Solid, Angular, Lit or plain JavaScript. The editor does all the work — gestures, keyboard, text
      editing, rendering, persistence. An adapter only has to do three things:
    </p>
    <ol>
      <li><strong>Render the surface</strong> — a focusable host with two stacked canvases.</li>
      <li><strong>Mount and dispose</strong> — call <code>mountCanvas()</code> when the host exists and <code>dispose()</code> when it goes away.</li>
      <li><strong>Mirror state</strong> — subscribe to the controller and re-render your UI from its getters.</li>
    </ol>

    <h3 id="adapter-surface">1. The surface</h3>
    <p>
      The host receives pointer events and focus; the canvases are drawn into and never hit-tested. Put
      <code>data-opendraw-root</code> on the element that wraps your chrome so keyboard shortcuts keep working while
      focus is on your toolbar.
    </p>
    <DocsCode title="board.html" :code="MARKUP" />
    <DocsCode title="board.css" :code="CSS" />

    <h3 id="adapter-vanilla">2. Mount (plain JavaScript)</h3>
    <DocsCode title="board.js" :code="VANILLA" />

    <h3 id="adapter-react">3. Mirror state (React example)</h3>
    <p>
      <code>editor.subscribe()</code> fires on every document or editor-state change, and its getters
      (<code>activeTool</code>, <code>selectedElements</code>, <code>canUndo</code>, <code>theme</code>, …) are memoized
      per change. That makes it a natural external store for any reactivity system:
    </p>
    <DocsCode title="Board.tsx" :code="REACT" />

    <h3 id="adapter-chrome">Toolbars, menus and icons</h3>
    <ul>
      <li>Build the toolbar from <code>TOOLS</code> (icon name, label, keys) and use <code>toolKeyHint()</code> for the corner key.</li>
      <li>Build menus from <code>ACTIONS</code>: each entry has a label, icon name and key combo; <code>isActionEnabled()</code> greys items out and <code>runAction()</code> runs them.</li>
      <li>Shortcuts are already handled by <code>mountCanvas()</code> — your buttons and the keyboard call the same actions.</li>
      <li>Map every <code>IconName</code> to your icon set once; opendraw never ships icons in the editor.</li>
      <li>Show the context menu from the <code>onContextMenu</code> callback; the clicked element is already selected.</li>
    </ul>
  </section>
</template>
