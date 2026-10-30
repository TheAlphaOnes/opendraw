<template>
  <main class="page">
    <OpenDraw class="draw" :menu-links="MENU_LINKS" @change="onChange" @select="onSelect">
      <template #top-right>
        <InstallCommand />
        <DocsButton />
      </template>
    </OpenDraw>
  </main>
</template>

<script setup lang="ts">
/**
 * The published demo: the editor fills the page, Excalidraw-style, with
 * the install command and the docs link top-right.
 *
 * E2E mirror: the Playwright suite reads document state through the public
 * change/select events (mirrored onto `window.__opendraw`) instead of
 * poking Vue internals. The hook lives here, never in the library.
 */
declare global {
  interface Window {
    __opendraw?: { elements: readonly unknown[]; selection: string[] }
  }
}

useHead({ title: 'opendraw — hand-drawn diagrams for Vue & Nuxt' })

const MENU_LINKS = [
  { label: 'Documentation', href: '/docs', icon: 'docs' },
  { label: 'GitHub', href: 'https://github.com/TheAlphaOnes/opendraw', icon: 'github' },
] as const

function onChange(detail: { elements: readonly unknown[] }): void {
  window.__opendraw = { elements: detail.elements, selection: window.__opendraw?.selection ?? [] }
}

function onSelect(ids: string[]): void {
  window.__opendraw = { elements: window.__opendraw?.elements ?? [], selection: ids }
}
</script>

<style scoped>
.page {
  height: 100vh;
  height: 100dvh;
}

.draw {
  height: 100%;
}
</style>
