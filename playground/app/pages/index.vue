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
function onChange(detail: { elements: unknown[] }) {
  // eslint-disable-next-line no-console
  console.debug('[vuedraw] change', detail.elements.length)
}

function onSelect(ids: string[]) {
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
  color: #6965db;
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
