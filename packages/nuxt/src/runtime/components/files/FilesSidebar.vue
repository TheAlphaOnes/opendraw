<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useDrawingFiles } from '../../composables/useDrawingFiles.js'
import UiIcon from '../ui/UiIcon.vue'
import UiIconButton from '../ui/UiIconButton.vue'
import FileListItem from './FileListItem.vue'

/**
 * The drawings sidebar, Excalidraw's right-docked Sidebar, holding the
 * browser's drawings: search, a new-drawing button and the list, most
 * recently edited first. Opening a drawing swaps the canvas in place.
 *
 * It closes on Escape, the close button or a press outside it (menus it
 * opened don't count), and hands focus back to whatever opened it. Keys
 * pressed inside never reach the canvas shortcuts.
 */
const props = defineProps<{ open: boolean; id: string }>()
const emit = defineEmits<{ close: [] }>()

const files = useDrawingFiles()
const query = ref('')
const panelRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return needle === '' ? files.files.value : files.files.value.filter((file) => file.name.toLowerCase().includes(needle))
})

// The captions count from a clock that only ticks while the list is shown.
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

function stopClock(): void {
  if (clock !== null) {
    clearInterval(clock)
    clock = null
  }
}

function onOutside(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  // A row's menu is teleported out of the panel; picking from it is inside.
  if (target && !panelRef.value?.contains(target) && !target.closest('.ui-dropdown__panel, [data-files-trigger]')) {
    emit('close')
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      now.value = Date.now()
      clock = setInterval(() => (now.value = Date.now()), 30_000)
      document.addEventListener('pointerdown', onOutside, true)
      await nextTick()
      // A touch screen would raise its keyboard over the list: focus the
      // panel there (screen readers still land in it), the search field
      // where a keyboard is at hand.
      const typing = window.matchMedia('(pointer: fine)').matches
      ;(typing ? searchRef.value : panelRef.value)?.focus({ preventScroll: true })
    } else {
      stopClock()
      document.removeEventListener('pointerdown', onOutside, true)
      query.value = ''
    }
  },
)

onBeforeUnmount(() => {
  stopClock()
  document.removeEventListener('pointerdown', onOutside, true)
})

function onKeyDown(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    if (query.value !== '' && event.target === searchRef.value) {
      query.value = ''
    } else {
      emit('close')
    }
  }
}

/** Arrow keys walk the rows from the search field and between rows. */
function onListKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }
  const rows = Array.from(panelRef.value?.querySelectorAll<HTMLElement>('.file-item__open') ?? [])
  if (rows.length === 0) {
    return
  }
  event.preventDefault()
  const index = rows.indexOf(document.activeElement as HTMLElement)
  const next = index === -1 ? (event.key === 'ArrowDown' ? 0 : rows.length - 1) : index + (event.key === 'ArrowDown' ? 1 : -1)
  if (next < 0) {
    searchRef.value?.focus()
  } else {
    rows[Math.min(next, rows.length - 1)]?.focus()
  }
}

function openFile(id: string): void {
  files.open(id)
  // On a phone the list covers the canvas: get out of the way.
  if (window.matchMedia('(max-width: 640px)').matches) {
    emit('close')
  }
}

function createFile(): void {
  query.value = ''
  files.create()
  void nextTick(() => panelRef.value?.querySelector<HTMLElement>('.file-item.is-active .file-item__open')?.focus())
}
</script>

<template>
  <Transition name="files-sidebar">
    <aside
      v-if="props.open"
      :id="props.id"
      ref="panelRef"
      class="files-sidebar"
      role="dialog"
      aria-modal="false"
      aria-labelledby="files-sidebar-title"
      tabindex="-1"
      @keydown="onKeyDown"
    >
      <header class="files-sidebar__header">
        <h2 id="files-sidebar-title" class="files-sidebar__title">
          Drawings
          <span class="files-sidebar__count">{{ files.files.value.length }}</span>
        </h2>
        <button type="button" class="files-sidebar__new" @click="createFile">
          <UiIcon name="newFile" :size="16" />
          <span>New</span>
        </button>
        <UiIconButton icon="close" label="Close drawings" @click="emit('close')" />
      </header>

      <div class="files-sidebar__search" @keydown="onListKey">
        <UiIcon name="search" :size="16" class="files-sidebar__search-icon" />
        <label class="files-sidebar__sr" for="files-sidebar-search">Search drawings</label>
        <input
          id="files-sidebar-search"
          ref="searchRef"
          v-model="query"
          class="files-sidebar__search-input"
          type="search"
          placeholder="Search drawings"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <TransitionGroup tag="ul" name="files-row" class="files-sidebar__list" aria-label="Drawings" @keydown="onListKey">
        <FileListItem
          v-for="(file, index) in visible"
          :key="file.id"
          :style="{ '--row-delay': `${Math.min(index, 8) * 28}ms` }"
          :file="file"
          :active="file.id === files.active.value?.id"
          :thumbnail="file.thumbnailAt === null ? null : files.thumbnail(file.id)"
          :now="now"
          @open="openFile(file.id)"
          @rename="files.rename(file.id, $event)"
          @duplicate="files.duplicate(file.id)"
          @delete="files.remove(file.id)"
        />
      </TransitionGroup>

      <p v-if="visible.length === 0" class="files-sidebar__empty" role="status">
        No drawings match “{{ query.trim() }}”.
      </p>

      <footer class="files-sidebar__footer">Drawings are saved in this browser only.</footer>
    </aside>
  </Transition>
</template>

<style scoped>
.files-sidebar {
  position: absolute;
  z-index: 30;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 320px;
  max-width: 100%;
  border-left: 1px solid var(--od-divider);
  background: var(--od-surface);
  box-shadow: var(--od-shadow-1), -12px 0 32px -16px rgba(0, 0, 0, 0.16);
  contain: layout style;
  outline: none;
}

.files-sidebar__header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 12px;
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--od-divider);
}

.files-sidebar__title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--od-ink);
}

.files-sidebar__count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--od-surface-low);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  color: var(--od-ink-soft);
}

.files-sidebar__new {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: var(--od-radius-l);
  background: var(--od-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.files-sidebar__new:hover {
  background: var(--od-brand-active);
}

.files-sidebar__new:active {
  transform: scale(0.96);
}

.files-sidebar__new:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-surface), 0 0 0 4px var(--od-accent);
}

.files-sidebar__search {
  position: relative;
  margin: 12px 12px 4px;
}

.files-sidebar__search-icon {
  position: absolute;
  top: 50%;
  left: 10px;
  color: var(--od-ink-soft);
  transform: translateY(-50%);
  pointer-events: none;
}

.files-sidebar__search-input {
  width: 100%;
  height: 34px;
  padding: 0 10px 0 34px;
  border: 1px solid var(--od-divider);
  border-radius: var(--od-radius-l);
  outline: none;
  background: var(--od-surface-low);
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  transition:
    border-color var(--od-fast) ease-out,
    box-shadow var(--od-fast) ease-out,
    background-color var(--od-fast) ease-out;
}

.files-sidebar__search-input::placeholder {
  color: var(--od-ink-soft);
}

.files-sidebar__search-input:focus {
  border-color: var(--od-accent);
  background: var(--od-surface);
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}

.files-sidebar__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 8px 8px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.files-sidebar__empty {
  margin: 0;
  padding: 0 20px 24px;
  font-size: 13px;
  text-align: center;
  color: var(--od-ink-soft);
}

.files-sidebar__footer {
  margin: 0 12px;
  padding: 10px 0 12px;
  border-top: 1px solid var(--od-divider);
  font-size: 12px;
  color: var(--od-ink-soft);
}

.files-sidebar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/*
 * Opening, in segments that land at different times: the panel slides in,
 * the header and search follow, then the rows cascade (--row-delay).
 */
.files-sidebar-enter-active {
  transition:
    transform 320ms var(--od-ease),
    opacity 180ms ease-out;
}

.files-sidebar-enter-active .files-sidebar__header {
  animation: files-rise 260ms var(--od-ease) 60ms both;
}

.files-sidebar-enter-active .files-sidebar__search {
  animation: files-rise 280ms var(--od-ease) 110ms both;
}

.files-sidebar-enter-active :deep(.file-item) {
  animation: files-rise 300ms var(--od-ease) calc(150ms + var(--row-delay, 0ms)) both;
}

.files-sidebar-enter-active .files-sidebar__footer {
  animation: files-fade 240ms ease-out 260ms both;
}

.files-sidebar-leave-active {
  transition:
    transform 200ms cubic-bezier(0.4, 0, 1, 1),
    opacity 160ms ease-in 40ms;
}

.files-sidebar-enter-from,
.files-sidebar-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* Rows added, removed or re-sorted while open. */
.files-row-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 260ms var(--od-ease);
}

.files-row-leave-active {
  position: absolute;
  right: 8px;
  left: 8px;
  transition:
    opacity 140ms ease-in,
    transform 180ms ease-in;
}

.files-row-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.files-row-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.files-row-move {
  transition: transform 280ms var(--od-ease);
}

@keyframes files-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@keyframes files-fade {
  from {
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .files-sidebar {
    width: 100%;
    border-left: none;
  }
}
</style>
