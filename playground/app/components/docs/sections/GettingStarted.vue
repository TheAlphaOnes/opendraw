<script setup lang="ts">
/** Introduction, installation and the first canvas. */
const INSTALL = `npm install @opendrawjs/nuxt
# or
pnpm add @opendrawjs/nuxt`

const CONFIG = `export default defineNuxtConfig({
  modules: ['@opendrawjs/nuxt'],
})`

const PAGE = `<template>
  <div style="height: 100vh">
    <OpenDraw />
  </div>
</template>`
</script>

<template>
  <section id="introduction" class="doc-section">
    <h1>opendraw</h1>
    <p class="lead">
      A hand-drawn whiteboard for Vue, Nuxt, React &amp; Svelte — tools and shortcuts for everything,
      arrows that connect, frames, sticky notes and sketchy rough.js rendering, as one component.
    </p>
    <p>opendraw ships as five packages:</p>
    <ul>
      <li><code>@opendrawjs/core</code> — the engine: element model, document &amp; history, geometry, hit testing, rendering and export. No framework code.</li>
      <li><code>@opendrawjs/editor</code> — the framework-free editor: tools, gestures, keyboard, the action registry, persistence. Mounts onto any DOM.</li>
      <li><code>@opendrawjs/nuxt</code> — the Vue/Nuxt adapter: <code>&lt;OpenDraw&gt;</code>, <code>&lt;OpenDrawCanvas&gt;</code>, <code>useOpenDraw()</code> and the full editor UI.</li>
      <li><code>@opendrawjs/react</code> and <code>@opendrawjs/svelte</code> — the React and Svelte 5 adapters.</li>
    </ul>
  </section>

  <section id="installation" class="doc-section">
    <h2>Installation</h2>
    <DocsCode title="terminal" :code="INSTALL" />
    <p>Register the module — it auto-imports the components and composables:</p>
    <DocsCode title="nuxt.config.ts" :code="CONFIG" />
  </section>

  <section id="quick-start" class="doc-section">
    <h2>Quick start</h2>
    <p>
      Drop <code>&lt;OpenDraw /&gt;</code> anywhere. It fills its container, so give the container a height. The scene
      saves itself to <code>localStorage</code> and restores on reload.
    </p>
    <DocsCode title="pages/index.vue" :code="PAGE" />
    <p>
      Press <kbd>?</kbd> inside the editor for every keyboard shortcut. Every tool has a key:
      <kbd>V</kbd>/<kbd>1</kbd> select, <kbd>R</kbd> rectangle, <kbd>D</kbd> diamond, <kbd>O</kbd> ellipse,
      <kbd>A</kbd> arrow, <kbd>L</kbd> line, <kbd>P</kbd> draw, <kbd>T</kbd> text, <kbd>N</kbd> sticky note,
      <kbd>E</kbd> eraser, <kbd>F</kbd> frame, <kbd>K</kbd> laser.
    </p>
  </section>
</template>
