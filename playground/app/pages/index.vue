<template>
  <OpenDrawApp :config="config" @change="onChange" @select="onSelect" />
</template>

<script setup lang="ts">
/**
 * The published demo: <OpenDrawApp> with one config — the install command
 * and the docs link top-right, the repository in the main menu.
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

const config = defineOpenDrawConfig({
  command: { text: 'npm install @opendraw/nuxt', short: 'npm i @opendraw/nuxt' },
  links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
  menuLinks: [
    { label: 'Documentation', href: '/docs', icon: 'docs' },
    { label: 'GitHub', href: 'https://github.com/TheAlphaOnes/opendraw', icon: 'github' },
  ],
})

function onChange(detail: { elements: readonly unknown[] }): void {
  window.__opendraw = { elements: detail.elements, selection: window.__opendraw?.selection ?? [] }
}

function onSelect(ids: string[]): void {
  window.__opendraw = { elements: window.__opendraw?.elements ?? [], selection: ids }
}
</script>
