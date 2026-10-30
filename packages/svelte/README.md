# @opendrawjs/svelte

Hand-drawn diagrams for **Svelte 5**: an Excalidraw-style whiteboard with a toolbar, zoom, history, theme and autosave, built on the framework-free [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor).

```bash
npm install @opendrawjs/svelte
```

```svelte
<script lang="ts">
  import '@opendrawjs/svelte/styles.css'
  import { OpenDraw } from '@opendrawjs/svelte'
</script>

<div style="height: 100vh">
  <OpenDraw onchange={(state) => console.log(state.elements.length)} />
</div>
```

| | |
| --- | --- |
| Full editor | `<OpenDraw theme persist initialElements ui onchange>` |
| Canvas only | `<OpenDrawCanvas {editor}>` |
| Your own controller | `createEditor()` |
| Reactive state | `editorState(editor, (e) => e.activeTool).current` |

Requires Svelte 5. Full documentation: [https://github.com/TheAlphaOnes/opendraw](https://github.com/TheAlphaOnes/opendraw#readme)

MIT License
