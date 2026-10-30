<script setup lang="ts">
import { BookOpen, Github, Menu, PenLine, X } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * The docs layout — header, a sidebar of sections with scroll-spy, and the
 * article column. Sections are plain anchors, so every heading is
 * linkable and the page works without JavaScript.
 */
export interface DocsNavGroup {
  title: string
  items: { id: string; label: string }[]
}

const props = defineProps<{ nav: readonly DocsNavGroup[] }>()

const active = ref(props.nav[0]?.items[0]?.id ?? '')
const sidebarOpen = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const ids = props.nav.flatMap((group) => group.items.map((item) => item.id))
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) {
        active.value = visible[0].target.id
      }
    },
    { rootMargin: '-72px 0px -65% 0px' },
  )
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el) {
      observer.observe(el)
    }
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="docs">
    <header class="docs__header">
      <button
        type="button"
        class="docs__menu"
        :aria-label="sidebarOpen ? 'Close navigation' : 'Open navigation'"
        :aria-expanded="sidebarOpen"
        @click="sidebarOpen = !sidebarOpen"
      >
        <X v-if="sidebarOpen" :size="18" />
        <Menu v-else :size="18" />
      </button>
      <NuxtLink to="/" class="docs__brand">
        <img src="/favicon.svg" alt="" class="docs__mark" width="28" height="28" />
        <span class="docs__logo">opendraw</span>
        <span class="docs__badge">docs</span>
      </NuxtLink>
      <nav class="docs__top-links" aria-label="Site">
        <NuxtLink to="/" class="docs__top-link"><PenLine :size="16" :stroke-width="1.75" /> Open editor</NuxtLink>
        <a href="https://github.com/TheAlphaOnes/opendraw" class="docs__top-link" target="_blank" rel="noopener noreferrer">
          <Github :size="16" :stroke-width="1.75" /> GitHub
        </a>
      </nav>
    </header>

    <div class="docs__body">
      <aside class="docs__sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="Documentation">
        <div v-for="group in props.nav" :key="group.title" class="docs__group">
          <p class="docs__group-title"><BookOpen :size="13" :stroke-width="1.75" /> {{ group.title }}</p>
          <a
            v-for="item in group.items"
            :key="item.id"
            :href="`#${item.id}`"
            class="docs__nav-link"
            :class="{ 'is-active': active === item.id }"
            :aria-current="active === item.id ? 'location' : undefined"
            @click="sidebarOpen = false"
          >
            {{ item.label }}
          </a>
        </div>
      </aside>

      <main class="docs__article">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.docs {
  --docs-accent: #ea580c;
  --docs-accent-soft: #fff4ec;
  --docs-ink: #1b1b1f;
  --docs-soft: #5c5c66;
  --docs-line: #ececf4;
  --docs-code-bg: #f6f6f9;

  min-height: 100vh;
  background: #fff;
  color: var(--docs-ink);
  font-family: Assistant, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.65;
}

.docs__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--docs-line);
}

.docs__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.docs__mark {
  display: block;
  border-radius: 7px;
}

.docs__logo {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--docs-ink);
}

.docs__badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--docs-accent-soft);
  color: var(--docs-accent);
  font-size: 12px;
  font-weight: 600;
}

.docs__top-links {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.docs__top-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--docs-ink);
  font-size: 14px;
  text-decoration: none;
  transition: background-color 120ms ease-out;
}

.docs__top-link:hover {
  background: var(--docs-accent-soft);
}

.docs__menu {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.docs__body {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  max-width: 1200px;
  margin: 0 auto;
}

.docs__sidebar {
  position: sticky;
  top: 60px;
  align-self: start;
  height: calc(100vh - 60px);
  overflow-y: auto;
  padding: 24px 16px 48px 24px;
  border-right: 1px solid var(--docs-line);
}

.docs__group + .docs__group {
  margin-top: 20px;
}

.docs__group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  padding: 0 10px;
  color: var(--docs-soft);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.docs__nav-link {
  display: block;
  padding: 5px 10px;
  border-radius: 6px;
  color: var(--docs-ink);
  font-size: 14px;
  text-decoration: none;
  transition:
    background-color 120ms ease-out,
    color 120ms ease-out;
}

.docs__nav-link:hover {
  background: var(--docs-accent-soft);
}

.docs__nav-link.is-active {
  background: var(--docs-accent-soft);
  color: var(--docs-accent);
  font-weight: 600;
}

.docs__article {
  min-width: 0;
  max-width: 780px;
  padding: 40px 48px 120px;
}

a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--docs-accent);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .docs__menu {
    display: inline-flex;
  }

  .docs__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .docs__sidebar {
    position: fixed;
    top: 60px;
    left: 0;
    z-index: 15;
    width: 280px;
    background: #fff;
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.08);
    transform: translateX(-100%);
    transition: transform 240ms cubic-bezier(0.19, 1, 0.22, 1);
  }

  .docs__sidebar.is-open {
    transform: none;
  }

  .docs__article {
    padding: 28px 16px 96px;
  }

  .docs__top-link {
    padding: 0 8px;
  }
}
</style>
