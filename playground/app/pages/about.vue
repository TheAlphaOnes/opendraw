<script setup lang="ts">
/**
 * About opendraw: what it is, what it does, how it is built and what it
 * stands for, with a FAQ. A real, crawlable page of plain HTML, the
 * editor itself is a canvas, so this is where search engines and AI
 * assistants learn what the product is.
 */
const base = useRuntimeConfig().public.siteUrl as string
const DESCRIPTION =
  'What opendraw is, who it is for and how it is built: a free, open-source hand-drawn whiteboard for the browser and for Vue, Nuxt, React and Svelte apps. Features, principles and FAQ.'

useSiteSeo({
  path: '/about',
  title: 'About opendraw: a free, open-source hand-drawn whiteboard',
  description: DESCRIPTION,
  image: '/og-about.png',
  imageAlt: 'About opendraw: a whiteboard you can make your own',
  jsonLd: [
    {
      '@type': 'AboutPage',
      '@id': siteUrl(base, '/about#page'),
      name: 'About opendraw',
      url: siteUrl(base, '/about'),
      description: DESCRIPTION,
      inLanguage: 'en',
      isPartOf: { '@id': siteUrl(base, '/#website') },
      about: { '@id': siteUrl(base, '/#app') },
      primaryImageOfPage: siteUrl(base, '/screenshot.png'),
    },
    {
      '@type': 'FAQPage',
      mainEntity: ABOUT_FAQ.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE.name, item: siteUrl(base, '/') },
        { '@type': 'ListItem', position: 2, name: 'About', item: siteUrl(base, '/about') },
      ],
    },
  ],
})
</script>

<template>
  <div class="about">
    <SiteHeader badge="about" />
    <main class="about__main">
      <AboutHero />
      <AboutFeatures />
      <AboutStory />
      <AboutFaq />
      <SiteFooter />
    </main>
  </div>
</template>

<style scoped>
.about {
  min-height: 100vh;
  background: #fff;
  color: #1b1b1f;
  font-family: Assistant, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

.about__main {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 32px;
}

.about__main :deep(.section-title) {
  margin: 0;
  font-size: clamp(26px, 3.4vw, 32px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

@media (max-width: 640px) {
  .about__main {
    padding: 0 16px;
  }
}
</style>
