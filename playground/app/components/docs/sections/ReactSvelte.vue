<script setup lang="ts">
/** The React and Svelte adapters. */
const INSTALL = `npm install @opendraw/react
# or
npm install @opendraw/svelte`

const REACT = `import '@opendraw/editor/styles.css'
import { OpenDraw } from '@opendraw/react'

export function Board() {
  return (
    <div style={{ height: '100vh' }}>
      <OpenDraw theme="system" onChange={(state) => save(state.elements)} />
    </div>
  )
}`

const REACT_HEADLESS = `import { OpenDrawCanvas, useEditorState, useOpenDrawEditor } from '@opendraw/react'

export function MyBoard() {
  const editor = useOpenDrawEditor()
  const tool = useEditorState(editor, (e) => e.activeTool)

  return (
    <div className="opendraw" data-opendraw-root>
      <OpenDrawCanvas editor={editor} />
      <button aria-pressed={tool === 'rectangle'} onClick={() => editor.setActiveTool('rectangle')}>
        Rectangle
      </button>
    </div>
  )
}`

const SVELTE = `<script lang="ts">
  import '@opendraw/editor/styles.css'
  import { OpenDraw } from '@opendraw/svelte'
<\/script>

<div style="height: 100vh">
  <OpenDraw theme="system" onchange={(state) => save(state.elements)} />
</div>`

const SVELTE_HEADLESS = `<script lang="ts">
  import { OpenDrawCanvas, createEditor, editorState } from '@opendraw/svelte'

  const editor = createEditor()
  const tool = editorState(editor, (e) => e.activeTool)
<\/script>

<div class="opendraw" data-opendraw-root>
  <OpenDrawCanvas {editor} />
  <button aria-pressed={tool.current === 'rectangle'} onclick={() => editor.setActiveTool('rectangle')}>
    Rectangle
  </button>
</div>`
</script>

<template>
  <section id="react-svelte" class="doc-section">
    <h2>React &amp; Svelte</h2>
    <p>
      The editor also ships as React and Svelte 5 components, over the same <code>@opendraw/editor</code>. Each offers
      a ready-made <code>&lt;OpenDraw&gt;</code> — canvas, toolbar with key hints, zoom and history islands, theme toggle
      and autosave — and a bare <code>&lt;OpenDrawCanvas&gt;</code> for your own UI. One Playwright suite runs against
      both, so they behave identically.
    </p>
    <DocsCode title="terminal" :code="INSTALL" />

    <h3 id="react">React</h3>
    <p>Props: <code>theme</code>, <code>persist</code>, <code>initialElements</code>, <code>ui</code> (<code>'full' | 'none'</code>), <code>onChange</code>, <code>editor</code>, <code>children</code>.</p>
    <DocsCode title="Board.tsx" :code="REACT" />
    <p>
      <code>useOpenDrawEditor()</code> creates a controller for the component's lifetime and
      <code>useEditorState(editor, read)</code> subscribes to any slice of it (built on
      <code>useSyncExternalStore</code>):
    </p>
    <DocsCode title="MyBoard.tsx" :code="REACT_HEADLESS" />

    <h3 id="svelte">Svelte</h3>
    <p>The same props, with Svelte's <code>onchange</code> naming. State is read through runes-friendly <code>editorState()</code>:</p>
    <DocsCode title="Board.svelte" :code="SVELTE" />
    <DocsCode title="MyBoard.svelte" :code="SVELTE_HEADLESS" />
  </section>
</template>
