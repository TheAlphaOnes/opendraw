<template>
  <main class="home">
    <!-- The page is a canvas: its heading and summary are for screen
         readers and crawlers. -->
    <h1 class="sr-only">{{ SITE.title }}</h1>
    <p class="sr-only">{{ SITE.description }}</p>
    <OpenDrawApp :config="config" @change="onChange" @select="onSelect" />
  </main>
</template>

<script setup lang="ts">
/**
 * The published demo: <OpenDrawApp> with one config — the drawings button,
 * the install command and the docs link top-right, the repository in the
 * main menu.
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

const base = useRuntimeConfig().public.siteUrl as string

useSiteSeo({
  path: '/',
  jsonLd: [
    {
      '@type': 'WebSite',
      '@id': siteUrl(base, '/#website'),
      name: SITE.name,
      url: siteUrl(base, '/'),
      description: SITE.description,
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': siteUrl(base, '/#app'),
      name: SITE.name,
      url: siteUrl(base, '/'),
      description: SITE.description,
      applicationCategory: 'DesignApplication',
      applicationSubCategory: 'Diagramming whiteboard',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript and a modern browser.',
      image: siteUrl(base, '/og.png'),
      screenshot: siteUrl(base, '/og.png'),
      featureList: SITE.features,
      softwareVersion: SITE.version,
      license: SITE.license,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Person', name: SITE.author },
      sameAs: [SITE.repository, SITE.npm],
    },
    {
      '@type': 'SoftwareSourceCode',
      name: SITE.name,
      description: SITE.description,
      codeRepository: SITE.repository,
      programmingLanguage: ['TypeScript', 'Vue', 'React', 'Svelte'],
      runtimePlatform: 'Web browser',
      license: SITE.license,
      author: { '@type': 'Person', name: SITE.author },
    },
  ],
})

// The canvas owns pinch and pan, so the page itself never zooms (as on
// excalidraw.com); the docs page keeps normal zoom for accessibility.
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' }],
  // Placed by the head manager, outside the hydrated app: a <noscript> in
  // the template hydrates as text and mismatches the server render.
  noscript: [
    {
      tagPosition: 'bodyOpen',
      innerHTML: `<p style="margin:16px;padding:12px 16px;border-radius:8px;background:#fff4ec;font:15px/1.5 system-ui,sans-serif;color:#1b1b1f">${SITE.name} is an Excalidraw-style whiteboard and needs JavaScript to draw. Read the <a href="/docs">documentation</a> or the <a href="${SITE.repository}">source on GitHub</a>.</p>`,
    },
  ],
})

const config = defineOpenDrawConfig({
  files: true,
  command: { text: 'npm install @opendrawjs/nuxt', short: 'npm i @opendrawjs/nuxt' },
  links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
  menuLinks: [
    { label: 'Documentation', href: '/docs', icon: 'docs' },
    { label: 'GitHub', href: SITE.repository, icon: 'github' },
  ],
})

function onChange(detail: { elements: readonly unknown[] }): void {
  window.__opendraw = { elements: detail.elements, selection: window.__opendraw?.selection ?? [] }
}

function onSelect(ids: string[]): void {
  window.__opendraw = { elements: window.__opendraw?.elements ?? [], selection: ids }
}
</script>
