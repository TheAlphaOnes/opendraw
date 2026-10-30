<script setup lang="ts">
import { BookOpen, Menu, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * The docs layout: the site header, a sidebar of pages (the open page
 * lists its sections, with scroll-spy), the article column and links to
 * the previous and next page. Pages and sections are plain links, so
 * every page and heading is addressable and works without JavaScript.
 */
const props = defineProps<{ current: DocPage }>()

const groups = computed(() => {
  const byGroup = new Map<string, DocPage[]>()
  for (const page of DOC_PAGES) {
    byGroup.set(page.group, [...(byGroup.get(page.group) ?? []), page])
  }
  return [...byGroup].map(([title, pages]) => ({ title, pages }))
})

const index = computed(() => DOC_PAGES.indexOf(props.current))
const previous = computed(() => DOC_PAGES[index.value - 1] ?? null)
const next = computed(() => DOC_PAGES[index.value + 1] ?? null)

const active = ref(props.current.sections[0]?.id ?? '')
const sidebarOpen = ref(false)
let observer: IntersectionObserver | null = null

function spy(): void {
  observer?.disconnect()
  active.value = props.current.sections[0]?.id ?? ''
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) {
        active.value = visible[0].target.id
      }
    },
    { rootMargin: '-72px 0px -65% 0px' },
  )
  for (const section of props.current.sections) {
    const el = document.getElementById(section.id)
    if (el) {
      observer.observe(el)
    }
  }
}

onMounted(spy)
watch(
  () => props.current,
  async () => {
    sidebarOpen.value = false
    await nextTick()
    spy()
  },
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="docs">
    <SiteHeader badge="docs">
      <template #start>
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
      </template>
    </SiteHeader>

    <div class="docs__body">
      <nav class="docs__sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="Documentation">
        <div v-for="group in groups" :key="group.title" class="docs__group">
          <p class="docs__group-title"><BookOpen :size="13" :stroke-width="1.75" /> {{ group.title }}</p>
          <template v-for="page in group.pages" :key="page.slug">
            <NuxtLink
              :to="docPath(page)"
              class="docs__nav-link"
              :class="{ 'is-current': page === props.current }"
              :aria-current="page === props.current ? 'page' : undefined"
              @click="sidebarOpen = false"
            >
              {{ page.label }}
            </NuxtLink>
            <div v-if="page === props.current && page.sections.length > 1" class="docs__sections">
              <a
                v-for="section in page.sections"
                :key="section.id"
                :href="`#${section.id}`"
                class="docs__section-link"
                :class="{ 'is-active': active === section.id }"
                :aria-current="active === section.id ? 'location' : undefined"
                @click="sidebarOpen = false"
              >
                {{ section.label }}
              </a>
            </div>
          </template>
        </div>
      </nav>

      <main class="docs__article">
        <slot />
        <nav v-if="previous || next" class="docs__pager" aria-label="More documentation">
          <NuxtLink v-if="previous" :to="docPath(previous)" class="docs__pager-link" rel="prev">
            <span class="docs__pager-hint">Previous</span>
            <span class="docs__pager-title">{{ previous.label }}</span>
          </NuxtLink>
          <NuxtLink v-if="next" :to="docPath(next)" class="docs__pager-link docs__pager-link--next" rel="next">
            <span class="docs__pager-hint">Next</span>
            <span class="docs__pager-title">{{ next.label }}</span>
          </NuxtLink>
        </nav>
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

.docs__nav-link.is-current {
  color: var(--docs-accent);
  font-weight: 600;
}

.docs__sections {
  display: flex;
  flex-direction: column;
  margin: 2px 0 6px 10px;
  padding-left: 10px;
  border-left: 1px solid var(--docs-line);
  animation: docs-sections-in 320ms cubic-bezier(0.19, 1, 0.22, 1) both;
}

.docs__section-link {
  padding: 3px 10px;
  border-radius: 6px;
  color: var(--docs-soft);
  font-size: 13px;
  text-decoration: none;
  transition:
    background-color 120ms ease-out,
    color 120ms ease-out;
}

.docs__section-link:hover {
  color: var(--docs-ink);
}

.docs__section-link.is-active {
  background: var(--docs-accent-soft);
  color: var(--docs-accent);
  font-weight: 600;
}

@keyframes docs-sections-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.docs__pager {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--docs-line);
}

.docs__pager-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--docs-line);
  color: var(--docs-ink);
  text-decoration: none;
  transition:
    box-shadow 140ms ease-out,
    transform 90ms cubic-bezier(0.19, 1, 0.22, 1);
}

.docs__pager-link:hover {
  box-shadow: inset 0 0 0 1px #f6c9a8;
}

.docs__pager-link:active {
  transform: scale(0.98);
}

.docs__pager-link--next {
  grid-column: 2;
  text-align: right;
}

.docs__pager-hint {
  font-size: 12px;
  color: var(--docs-soft);
}

.docs__pager-title {
  font-weight: 600;
  color: var(--docs-accent);
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
}

</style>
