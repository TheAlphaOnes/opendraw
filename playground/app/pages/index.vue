<template>
  <main class="page">
    <nav class="page__bar">
      <span class="page__title">vuedraw playground</span>
      <NuxtLink class="page__link" to="/headless">headless demo →</NuxtLink>
    </nav>
    <VueDraw class="draw" @change="onChange" @select="onSelect" />
  </main>
</template>

<script setup lang="ts">
/**
 * E2E mirror: the Playwright suite reads document state through these same
 * public events (mirrored onto `window.__vuedraw`) instead of poking Vue
 * internals. The hook lives in the playground, never in the library.
 */
declare global {
  interface Window {
    __vuedraw?: { elements: unknown[]; selection: string[] }
  }
}

function onChange(detail: { elements: unknown[] }): void {
  window.__vuedraw = { elements: detail.elements, selection: window.__vuedraw?.selection ?? [] }
  // eslint-disable-next-line no-console
  console.debug('[vuedraw] change', detail.elements.length)
}

function onSelect(ids: string[]): void {
  window.__vuedraw = { elements: window.__vuedraw?.elements ?? [], selection: ids }
  // eslint-disable-next-line no-console
  console.debug('[vuedraw] select', ids)
}
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.page__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #eaeaea;
  font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #495057;
}

.page__link {
  color: #0c8599;
  text-decoration: none;
}

.page__link:hover {
  text-decoration: underline;
}

.draw {
  flex: 1;
  min-height: 0;
}
</style>
