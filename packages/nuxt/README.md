# @opendrawjs/nuxt

Hand-drawn diagrams for **Nuxt and Vue**: an Excalidraw-style whiteboard as a native component, with the full Excalidraw UI (toolbar, properties panel, color picker, menus, context menu, shortcuts, dark mode) and autosave.

```bash
npm install @opendrawjs/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@opendrawjs/nuxt'],
})
```

```vue
<template>
  <div style="height: 100vh">
    <OpenDraw />
  </div>
</template>
```

The module auto-imports `<OpenDraw>`, `<OpenDrawCanvas>`, `<OpenDrawApp>`, `useOpenDraw()`, `useDrawingFiles()` and `defineOpenDrawConfig()`.

**Plain Vue 3 (no Nuxt):** `import { OpenDraw } from '@opendrawjs/nuxt/vue'`.

**Many drawings:** `<OpenDrawApp :config="defineOpenDrawConfig({ files: true })" />` adds a drawings sidebar to create, open, rename, duplicate, delete and search drawings, each saved on its own.

Full documentation: [https://github.com/TheAlphaOnes/opendraw](https://github.com/TheAlphaOnes/opendraw#readme)

MIT License
