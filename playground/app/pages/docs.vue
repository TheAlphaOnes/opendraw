<script setup lang="ts">
import type { DocsNavGroup } from '../components/docs/DocsShell.vue'

/** The opendraw documentation: usage, API reference and the adapter guide. */
useHead({ title: 'Docs — opendraw' })

const NAV: DocsNavGroup[] = [
  {
    title: 'Getting started',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'quick-start', label: 'Quick start' },
      { id: 'opendraw-app', label: '<OpenDrawApp>' },
    ],
  },
  {
    title: 'Vue & Nuxt',
    items: [
      { id: 'component', label: '<OpenDraw>' },
      { id: 'use-opendraw', label: 'useOpenDraw()' },
      { id: 'custom-ui', label: 'Custom UI' },
    ],
  },
  {
    title: 'React & Svelte',
    items: [
      { id: 'react-svelte', label: 'Overview' },
      { id: 'react', label: 'React' },
      { id: 'svelte', label: 'Svelte' },
    ],
  },
  {
    title: 'Packages',
    items: [
      { id: 'core', label: '@opendraw/core' },
      { id: 'editor', label: '@opendraw/editor' },
    ],
  },
  {
    title: 'Guides',
    items: [{ id: 'adapters', label: 'Build an adapter' }],
  },
]
</script>

<template>
  <DocsShell :nav="NAV">
    <article class="prose">
      <DocsSectionsGettingStarted />
      <DocsSectionsAppComponent />
      <DocsSectionsComponentApi />
      <DocsSectionsComposableApi />
      <DocsSectionsReactSvelte />
      <DocsSectionsEngineApi />
      <DocsSectionsAdapterGuide />
    </article>
  </DocsShell>
</template>

<style scoped>
.prose :deep(.doc-section) {
  scroll-margin-top: 76px;
  padding-bottom: 32px;
  animation: doc-rise 420ms cubic-bezier(0.19, 1, 0.22, 1) both;
}

.prose :deep(.doc-section:nth-child(2)) {
  animation-delay: 40ms;
}

.prose :deep(.doc-section:nth-child(n + 3)) {
  animation-delay: 80ms;
}

@keyframes doc-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.prose :deep(h1) {
  margin: 0 0 12px;
  font-family: 'Excalifont', 'Virgil', 'Segoe Print', 'Bradley Hand', cursive;
  font-size: 44px;
  font-weight: 400;
  line-height: 1.15;
  color: #ea580c;
}

.prose :deep(h2) {
  margin: 24px 0 12px;
  padding-top: 24px;
  border-top: 1px solid #ececf4;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.prose :deep(h3) {
  margin: 28px 0 8px;
  scroll-margin-top: 76px;
  font-size: 19px;
  font-weight: 700;
}

.prose :deep(p),
.prose :deep(li) {
  color: #33333b;
}

.prose :deep(.lead) {
  font-size: 19px;
  color: #5c5c66;
}

.prose :deep(ul),
.prose :deep(ol) {
  padding-left: 22px;
}

.prose :deep(li + li) {
  margin-top: 6px;
}

.prose :deep(code) {
  padding: 1px 6px;
  border-radius: 5px;
  background: #fff4ec;
  color: #c2410c;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.86em;
}

.prose :deep(pre code) {
  padding: 0;
  background: none;
  color: inherit;
  font-size: inherit;
}

.prose :deep(kbd) {
  display: inline-block;
  min-width: 20px;
  padding: 0 5px;
  border: 1px solid #ececf4;
  border-bottom-width: 2px;
  border-radius: 5px;
  background: #fff;
  font-family: inherit;
  font-size: 0.82em;
  text-align: center;
}

.prose :deep(.table-wrap) {
  margin: 12px 0 20px;
  overflow-x: auto;
  border: 1px solid #ececf4;
  border-radius: 10px;
}

.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.prose :deep(th),
.prose :deep(td) {
  padding: 10px 14px;
  border-bottom: 1px solid #ececf4;
  text-align: left;
  vertical-align: top;
}

.prose :deep(th) {
  background: #f6f6f9;
  font-weight: 600;
}

.prose :deep(tr:last-child td) {
  border-bottom: none;
}

.prose :deep(td code) {
  white-space: nowrap;
}

.prose :deep(td:last-child code) {
  white-space: normal;
}
</style>
