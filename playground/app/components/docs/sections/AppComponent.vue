<script setup lang="ts">
/** <OpenDrawApp> + defineOpenDrawConfig, and the slot components. */
const APP = `<script setup lang="ts">
const config = defineOpenDrawConfig({
  // the copyable, glowing command (short form on laptops, a card on phones)
  command: { text: 'npm install my-lib', short: 'npm i my-lib' },
  // top-right buttons
  links: [
    { label: 'Docs', icon: 'docs', to: '/docs' },
    { label: 'GitHub', icon: 'github', href: 'https://github.com/me/my-lib' },
  ],
  share: true,
  menuLinks: [{ label: 'Changelog', href: '/changelog' }],
  // many drawings, with a drawings sidebar
  files: true,

  // editor
  theme: 'system',
  persist: 'my-board',

  // hooks
  onReady: (editor) => editor.setActiveTool('rectangle'),
  onChange: ({ elements }) => save(elements),
  onCopy: (command) => track('copied', command),
})
<\/script>

<template>
  <OpenDrawApp :config="config" />
</template>`

const SLOTS = `<template>
  <OpenDraw>
    <template #top-right>
      <OpenDrawCopyCommand command="npm install my-lib" short-command="npm i my-lib" />
      <OpenDrawButton icon="docs" label="Docs" to="/docs" />
      <OpenDrawShareButton />
    </template>
  </OpenDraw>
</template>`

const CONFIG = [
  ['command', "string | { text, short?, glow?, prompt? }", 'The copyable command pill, top-right.'],
  ['links', '{ label, icon?, to?, href?, variant?, onClick? }[]', 'Top-right buttons.'],
  ['share', 'boolean | { url?, title?, label? }', 'The primary Share button: share sheet on phones, else copy link.'],
  ['menuLinks', '{ label, href?, onSelect?, icon? }[]', 'Links (or actions) in the main menu.'],
  ['files', 'boolean | { indexKey? }', 'Many named drawings: a Drawings button and sidebar to create, open, rename, duplicate, delete and search them. Each autosaves on its own.'],
  ['theme · persist · grid · initialElements', '—', 'The editor options of <OpenDraw> (persist is ignored with files).'],
  ['fullscreen', 'boolean', 'Fill the viewport (default) or the parent.'],
  ['onReady · onChange · onSelect · onCopy · onShare', 'functions', 'Hooks; also emitted as @ready, @change, @select, @copy, @share.'],
] as const
</script>

<template>
  <section id="opendraw-app" class="doc-section">
    <h2>&lt;OpenDrawApp&gt; — the demo in one component</h2>
    <p>
      Want exactly what this site shows? <code>&lt;OpenDrawApp&gt;</code> is the whole demo — the full editor filling
      the page, your buttons, the glowing install command and a Share button top-right, your links in the main menu —
      configured with one typed object. Every control sits on the same 40px island bar, light and dark.
    </p>
    <DocsCode title="pages/index.vue" :code="APP" />
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Config</th><th>Type</th><th>What it does</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in CONFIG" :key="row[0]">
            <td><code>{{ row[0] }}</code></td>
            <td><code>{{ row[1] }}</code></td>
            <td>{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 id="slot-components">Slot components</h3>
    <p>
      The same pieces are separate components for <code>&lt;OpenDraw&gt;</code>'s <code>#top-right</code> and
      <code>#footer</code> slots: <code>&lt;OpenDrawButton&gt;</code> (filled, primary or ghost; a route, a link or a
      click; icon-only on phones), <code>&lt;OpenDrawCopyCommand&gt;</code> and <code>&lt;OpenDrawShareButton&gt;</code>.
    </p>
    <DocsCode title="Board.vue" :code="SLOTS" />
  </section>
</template>
