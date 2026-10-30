<script setup lang="ts">
/** <OpenDraw> props, events and slots. */
const PROPS = [
  ['theme', "'light' | 'dark' | 'system'", "'system'", 'Starting theme. A persisted theme wins over it; the editor owns the theme afterwards.'],
  ['ui', "'full' | 'minimal' | 'none'", "'full'", 'full: every island. minimal: toolbar and zoom only. none: a bare canvas for your own UI.'],
  ['grid', 'boolean | number', 'false', 'Show the grid; a number sets its size in px (true is 20).'],
  ['initialElements', 'OpenDrawElement[]', '[]', 'Elements to start with when nothing is persisted.'],
  ['persist', 'boolean | string', 'true', 'Save to localStorage. A string is the storage key; false disables it. Changing the key while mounted opens the scene saved under it.'],
  ['menuLinks', '{ label, href?, onSelect?, icon? }[]', '[]', 'Your own links or actions in the main menu (docs, repository, …).'],
] as const

const EVENTS = [
  ['change', '{ elements, appState }', 'Every document or editor-state change.'],
  ['select', 'string[]', 'The selected element ids whenever the selection changes.'],
] as const

const SLOTS = [
  ['top-left', 'After the main menu — the open document\'s name.'],
  ['top-right', 'Beside the toolbar, top-right — a Share or Docs button.'],
  ['footer', 'Bottom-right, before the help button — status or install hints.'],
] as const

const EXAMPLE = `<script setup lang="ts">
import type { OpenDrawElement } from '@opendrawjs/core'

function save({ elements }: { elements: readonly OpenDrawElement[] }) {
  console.log('scene now has', elements.length, 'elements')
}
<\/script>

<template>
  <OpenDraw theme="dark" :persist="'my-board'" @change="save">
    <template #top-right>
      <button class="share">Share</button>
    </template>
  </OpenDraw>
</template>`
</script>

<template>
  <section id="component" class="doc-section">
    <h2>&lt;OpenDraw&gt;</h2>
    <p>The full editor: canvas, toolbar, properties panel, main menu, context menu, zoom, help and welcome screen.</p>

    <h3 id="props">Props</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in PROPS" :key="row[0]">
            <td><code>{{ row[0] }}</code></td>
            <td><code>{{ row[1] }}</code></td>
            <td><code>{{ row[2] }}</code></td>
            <td>{{ row[3] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 id="events">Events</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Event</th><th>Payload</th><th>When</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in EVENTS" :key="row[0]">
            <td><code>@{{ row[0] }}</code></td>
            <td><code>{{ row[1] }}</code></td>
            <td>{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 id="slots">Slots</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Slot</th><th>Where</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in SLOTS" :key="row[0]">
            <td><code>#{{ row[0] }}</code></td>
            <td>{{ row[1] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <DocsCode title="Board.vue" :code="EXAMPLE" />
  </section>
</template>
