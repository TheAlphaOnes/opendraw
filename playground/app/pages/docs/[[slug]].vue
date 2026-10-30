<script setup lang="ts">
import { defineAsyncComponent, type Component } from 'vue'

/**
 * One documentation page per URL (/docs, /docs/component, …), so each
 * topic can be found, linked and indexed on its own. DOC_PAGES decides
 * which page exists and what it is called; this file renders it.
 */
const SECTIONS: Record<string, Component> = {
  '': defineAsyncComponent(() => import('../../components/docs/sections/GettingStarted.vue')),
  'opendraw-app': defineAsyncComponent(() => import('../../components/docs/sections/AppComponent.vue')),
  component: defineAsyncComponent(() => import('../../components/docs/sections/ComponentApi.vue')),
  composables: defineAsyncComponent(() => import('../../components/docs/sections/ComposableApi.vue')),
  'react-svelte': defineAsyncComponent(() => import('../../components/docs/sections/ReactSvelte.vue')),
  packages: defineAsyncComponent(() => import('../../components/docs/sections/EngineApi.vue')),
  adapters: defineAsyncComponent(() => import('../../components/docs/sections/AdapterGuide.vue')),
}

// One instance per page: each sets its own title, description and data.
definePageMeta({ key: (route) => route.path })

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''))
const page = computed(() => DOC_PAGES.find((candidate) => candidate.slug === slug.value))
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Documentation page not found', fatal: true })
}
const current = computed(() => page.value!)

const base = useRuntimeConfig().public.siteUrl as string
const isHome = computed(() => current.value.slug === '')

useSiteSeo({
  path: docPath(current.value),
  title: isHome.value
    ? 'opendraw docs: add a hand-drawn whiteboard to Vue, Nuxt, React or Svelte'
    : `${current.value.title} | opendraw docs`,
  description: current.value.description,
  image: '/og-docs.png',
  imageAlt: 'opendraw documentation: add a whiteboard in one line',
  type: 'article',
  jsonLd: [
    {
      '@type': 'TechArticle',
      '@id': siteUrl(base, `${docPath(current.value)}#article`),
      headline: current.value.title,
      description: current.value.description,
      url: siteUrl(base, docPath(current.value)),
      image: siteUrl(base, '/og-docs.png'),
      inLanguage: 'en',
      author: { '@type': 'Person', name: SITE.author },
      about: { '@type': 'SoftwareSourceCode', name: SITE.name, codeRepository: SITE.repository },
      isPartOf: { '@id': siteUrl(base, '/#website') },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE.name, item: siteUrl(base, '/') },
        { '@type': 'ListItem', position: 2, name: 'Documentation', item: siteUrl(base, '/docs') },
        ...(isHome.value
          ? []
          : [{ '@type': 'ListItem', position: 3, name: current.value.title, item: siteUrl(base, docPath(current.value)) }]),
      ],
    },
  ],
})

// Links written when the docs were one page (/docs#react) still land on
// the section, now on its own page.
onMounted(() => {
  const anchor = route.hash.slice(1)
  if (anchor && !document.getElementById(anchor)) {
    const target = docPageForAnchor(anchor)
    if (target) {
      void navigateTo({ path: docPath(target), hash: route.hash }, { replace: true })
    }
  }
})
</script>

<template>
  <DocsShell :current="current">
    <article class="prose">
      <h1 v-if="!isHome" class="prose__title">{{ current.title }}</h1>
      <p v-if="!isHome" class="lead">{{ current.description }}</p>
      <component :is="SECTIONS[current.slug]" />
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

.prose :deep(h1),
.prose .prose__title {
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
