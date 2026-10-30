<script setup lang="ts">
/** useOpenDraw() and building your own UI around <OpenDrawCanvas>. */
const GROUPS = [
  ['State', 'elements, selectedElements, appState, activeTool, theme, viewport, gridSize, editingId, canUndo, canRedo'],
  ['Tools & theme', 'setActiveTool(tool), toggleToolLock(), setTheme(theme), toggleTheme(), setGridSize(size), setViewBackgroundColor(color)'],
  ['Selection', 'select(ids, mode?), selectGrouped(ids), selectAll(), isIdSelected(id)'],
  ['Elements', 'updateElement(id, patch), deleteSelection(), duplicateSelection(), copySelection(), cutSelection(), paste(at?)'],
  ['Style', 'changeStyle(style), changeTextStyle(style), changeRoundness(r), changeArrowhead(end, head), changeArrowType(type), copyStyles(), pasteStyles()'],
  ['Arrange', 'groupSelection(), ungroupSelection(), reorderSelection(action), alignSelection(a), distributeSelection(axis), flipSelection(axis)'],
  ['History', 'undo(), redo()'],
  ['Viewport', 'zoomIn(at), zoomOut(at), zoomAt(at, zoom), resetZoom(), zoomToFitAll(), zoomToFitSelection(), panBy(dx, dy)'],
  ['Files', 'serialize(), toJSON(), loadFile(file), loadJSON(text), saveToFile(), openFile(), exportPNG(), exportSVG(), exportDataURL(), clearCanvas()'],
  ['Images', 'insertImageFiles(files, at?), openImagePicker()'],
] as const

const HEADLESS = `<script setup lang="ts">
// Provide one context, then render the canvas and your own chrome.
const ctx = createOpenDrawContext({ appState: { theme: 'light' } })
provideOpenDraw(ctx)

const tools = ['selection', 'rectangle', 'ellipse', 'arrow', 'text'] as const
<\/script>

<template>
  <div class="board">
    <OpenDrawCanvas />
    <nav class="my-toolbar">
      <button
        v-for="tool in tools"
        :key="tool"
        :aria-pressed="ctx.activeTool.value === tool"
        @click="ctx.setActiveTool(tool)"
      >{{ tool }}</button>
      <button :disabled="!ctx.canUndo.value" @click="ctx.undo()">Undo</button>
      <button @click="ctx.exportPNG('board')">Export</button>
    </nav>
  </div>
</template>`

const INSIDE = `// Inside <OpenDraw> (any descendant component):
const { selectedElements, changeStyle } = useOpenDraw()

function paintRed() {
  changeStyle({ strokeColor: '#e03131' })
}`
</script>

<template>
  <section id="use-opendraw" class="doc-section">
    <h2>useOpenDraw()</h2>
    <p>
      Every component inside <code>&lt;OpenDraw&gt;</code> shares one reactive editor context. Call
      <code>useOpenDraw()</code> from any descendant to read state as computed refs and call commands. Every write goes
      through the document, so it is undoable and fires <code>@change</code>.
    </p>
    <DocsCode title="PaintButton.vue" :code="INSIDE" />
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Group</th><th>Members</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in GROUPS" :key="row[0]">
            <td>{{ row[0] }}</td>
            <td><code>{{ row[1] }}</code></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      <code>editor</code> exposes the framework-free controller and <code>doc</code> the raw document, for anything the
      context does not cover.
    </p>
  </section>

  <section id="custom-ui" class="doc-section">
    <h2>Custom UI</h2>
    <p>
      Want your own chrome? Render <code>&lt;OpenDrawCanvas&gt;</code> under a context you provide with
      <code>createOpenDrawContext()</code> and <code>provideOpenDraw()</code>, then build any toolbar you like. The
      canvas keeps every gesture, shortcut and the text editor; you only draw the buttons. (Or keep
      <code>&lt;OpenDraw ui="none"&gt;</code> for a bare canvas with persistence.)
    </p>
    <DocsCode title="MyBoard.vue" :code="HEADLESS" />
  </section>
</template>
