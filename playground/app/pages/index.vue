<template>
  <main class="page">
    <nav class="page__bar">
      <span class="page__title">opendraw playground</span>
      <NuxtLink class="page__link" to="/headless">headless demo →</NuxtLink>
    </nav>
    <OpenDraw class="draw" @change="onChange" @select="onSelect" />
  </main>
</template>

<script setup lang="ts">
/**
 * E2E mirror: the Playwright suite reads document state through these same
 * public events (mirrored onto `window.__opendraw`) instead of poking Vue
 * internals. The hook lives in the playground, never in the library.
 */
declare global {
  interface Window {
    __opendraw?: { elements: readonly unknown[]; selection: string[] }
  }
}

function onChange(detail: { elements: readonly unknown[] }): void {
  window.__opendraw = { elements: detail.elements, selection: window.__opendraw?.selection ?? [] }
  // eslint-disable-next-line no-console
  console.debug('[opendraw] change', detail.elements.length)
}

function onSelect(ids: string[]): void {
  window.__opendraw = { elements: window.__opendraw?.elements ?? [], selection: ids }
  // eslint-disable-next-line no-console
  console.debug('[opendraw] select', ids)
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
