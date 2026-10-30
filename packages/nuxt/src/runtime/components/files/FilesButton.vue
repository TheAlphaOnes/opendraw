<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'

import { useDrawingFiles } from '../../composables/useDrawingFiles.js'
import UiIcon from '../ui/UiIcon.vue'
import FilesSidebar from './FilesSidebar.vue'

/**
 * The drawings button beside the main menu, naming the open drawing (where
 * a document app shows its title). It opens the drawings sidebar, which it
 * teleports into the editor root so the sidebar takes the editor's theme
 * and spans its height. The name gets whatever room the centered toolbar
 * leaves; below that, the icon stands alone.
 */
const files = useDrawingFiles()
const open = files.sidebarOpen
const buttonRef = ref<HTMLButtonElement | null>(null)
const root = ref<HTMLElement | null>(null)
const sidebarId = `od-files-${useId()}`

// Until mount the name is unknown (the server has no storage): a neutral
// label keeps the server markup and the hydration render identical.
const name = computed(() => files.active.value?.name ?? 'Drawings')

onMounted(() => {
  root.value = buttonRef.value?.closest<HTMLElement>('.opendraw-root') ?? null
})

// Focus goes back to whatever opened the sidebar — this button, or the
// main menu's trigger on phones, where this button is hidden.
let opener: HTMLElement | null = null
watch(open, (isOpen) => {
  if (isOpen) {
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    if (opener?.closest('.ui-dropdown__panel')) {
      opener = buttonRef.value?.closest('.opendraw-root')?.querySelector<HTMLElement>('[aria-label="Main menu"]') ?? null
    }
  }
})

function toggle(): void {
  if (open.value) {
    close()
  } else {
    open.value = true
  }
}

function close(): void {
  if (!open.value) {
    return
  }
  open.value = false
  const target = opener?.isConnected && opener.offsetParent !== null ? opener : buttonRef.value
  void nextTick(() => target?.focus({ preventScroll: true }))
}
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    class="files-button"
    :class="{ 'is-open': open }"
    data-files-trigger
    :aria-label="`Drawings — ${name}`"
    :title="name"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-controls="sidebarId"
    @click="toggle"
  >
    <UiIcon name="files" :size="16" />
    <span class="files-button__name">{{ name }}</span>
  </button>
  <Teleport v-if="root" :to="root">
    <FilesSidebar :id="sidebarId" :open="open" @close="close" />
  </Teleport>
</template>

<style scoped>
.files-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--od-bar, 40px);
  min-width: var(--od-bar, 40px);
  /* Half the width, less the toolbar's half (~274px), the gutter, the menu
     button and a breathing gap: the name never runs under the toolbar. */
  max-width: min(240px, calc(50vw - 350px));
  padding: 0 12px;
  border: none;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color var(--od-fast, 120ms) ease-out,
    transform 90ms var(--od-ease);
  animation: files-button-in 300ms var(--od-ease) both;
}

.files-button:hover {
  background: var(--od-hover);
}

.files-button:active {
  transform: scale(0.97);
}

.files-button.is-open {
  background: var(--od-accent-soft);
  color: var(--od-on-accent-soft);
}

.files-button:focus-visible {
  outline: none;
  box-shadow: var(--od-shadow-1), 0 0 0 2px var(--od-accent);
}

.files-button__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@keyframes files-button-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (max-width: 1023px) {
  .files-button {
    justify-content: center;
    padding: 0;
  }

  .files-button__name {
    display: none;
  }
}

/* Phones: the top row holds the menu and history; the menu opens drawings. */
@media (max-width: 640px) {
  .files-button {
    display: none;
  }
}
</style>
