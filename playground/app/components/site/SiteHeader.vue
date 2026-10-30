<script setup lang="ts">
import { BookOpen, Github, Info, PenLine } from 'lucide-vue-next'

/**
 * The site header for the content pages (docs, about): the logo with an
 * optional section badge, and the site's links with the current page
 * marked. The `start` slot holds a page control before the logo (the
 * docs' navigation toggle on small screens). Phones show icons only.
 */
const props = defineProps<{ badge?: string }>()

// A section is current on its own page and every page under it (/docs/…).
const route = useRoute()
const isCurrent = (to: string): boolean => (to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`))

const LINKS = [
  { to: '/', label: 'Open editor', icon: PenLine },
  { to: '/docs', label: 'Docs', icon: BookOpen },
  { to: '/about', label: 'About', icon: Info },
] as const
</script>

<template>
  <header class="site-header">
    <slot name="start" />
    <NuxtLink to="/" class="site-header__brand">
      <img src="/logo.svg" alt="opendraw" class="site-header__logo" width="145" height="32" />
      <span v-if="props.badge" class="site-header__badge">{{ props.badge }}</span>
    </NuxtLink>
    <nav class="site-header__links" aria-label="Site">
      <NuxtLink
        v-for="link in LINKS"
        :key="link.to"
        :to="link.to"
        class="site-header__link"
        :class="{ 'is-current': isCurrent(link.to) }"
        :aria-current="isCurrent(link.to) ? 'page' : undefined"
        :aria-label="link.label"
        active-class=""
        exact-active-class=""
      >
        <component :is="link.icon" :size="16" :stroke-width="1.75" aria-hidden="true" />
        <span class="site-header__label">{{ link.label }}</span>
      </NuxtLink>
      <a :href="SITE.repository" class="site-header__link" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
        <Github :size="16" :stroke-width="1.75" aria-hidden="true" />
        <span class="site-header__label">GitHub</span>
      </a>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid #ececf4;
}

.site-header__brand {
  display: inline-flex;
  flex-shrink: 0;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.site-header__logo {
  display: block;
  height: 32px;
  width: auto;
}

.site-header__badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff4ec;
  color: #ea580c;
  font-size: 12px;
  font-weight: 600;
}

.site-header__links {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.site-header__link {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  color: #1b1b1f;
  font-size: 14px;
  white-space: nowrap;
  text-decoration: none;
  transition: background-color 120ms ease-out, color 120ms ease-out;
}

.site-header__link:hover {
  background: #fff4ec;
}

/* The page you are on. */
.site-header__link.is-current {
  color: #ea580c;
  font-weight: 600;
}

.site-header__link:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .site-header__link {
    padding: 0 8px;
  }
}

/* Phones: icon-only links (named by aria-label), a smaller logo. */
@media (max-width: 640px) {
  .site-header {
    gap: 8px;
    padding: 0 12px;
  }

  .site-header__links {
    gap: 0;
  }

  .site-header__link {
    width: 36px;
    justify-content: center;
    padding: 0;
  }

  .site-header__label {
    display: none;
  }

  .site-header__logo {
    height: 28px;
  }
}

@media (max-width: 400px) {
  .site-header__badge {
    display: none;
  }
}
</style>
