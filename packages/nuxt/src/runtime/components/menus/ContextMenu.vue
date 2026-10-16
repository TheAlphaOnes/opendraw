<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import { useVueDraw } from '../../composables/useVueDraw.js'

const props = defineProps<{
  /** Viewport coordinates of the menu's top-left corner. */
  x: number
  y: number
  visible: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const ctx = useVueDraw()

const rootEl = ref<HTMLElement | null>(null)

/** Estimated footprint used to keep the menu inside the viewport. */
const MENU_WIDTH = 200
const MENU_HEIGHT = 260

const menuX = computed(() => {
  if (typeof window === 'undefined') {
    return props.x
  }
  return Math.max(8, Math.min(props.x, window.innerWidth - MENU_WIDTH - 8))
})

const menuY = computed(() => {
  if (typeof window === 'undefined') {
    return props.y
  }
  return Math.max(8, Math.min(props.y, window.innerHeight - MENU_HEIGHT - 8))
})

const modKey = computed(() => {
  if (typeof navigator === 'undefined') {
    return 'Ctrl'
  }
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
})

/** Clicks outside the menu dismiss it. */
function onPointerDown(event: PointerEvent): void {
  if (rootEl.value?.contains(event.target as Node)) {
    return
  }
  emit('close')
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (typeof document === 'undefined') {
      return
    }
    if (visible) {
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeyDown, true)
    } else {
      detachListeners()
    }
  },
  { immediate: true },
)

function detachListeners(): void {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    detachListeners()
  }
})

/** Runs the action then closes — every menu item dismisses on click. */
function run(action: () => void): void {
  action()
  emit('close')
}
</script>

<!-- Design law: no entrance animation on context menus; the exit is an
     instant unmount, so exits stay faster than any entrance. -->
<template>
  <div
    v-if="props.visible"
    ref="rootEl"
    class="context-menu"
    role="menu"
    :style="{ left: `${menuX}px`, top: `${menuY}px` }"
  >
    <button type="button" role="menuitem" class="context-menu__item" @click="run(() => ctx.duplicateSelection())">
      <span>Duplicate</span>
      <span class="context-menu__hint">{{ modKey }}D</span>
    </button>

    <button type="button" role="menuitem" class="context-menu__item" @click="run(() => ctx.copySelection())">
      <span>Copy</span>
      <span class="context-menu__hint">{{ modKey }}C</span>
    </button>

    <button type="button" role="menuitem" class="context-menu__item" @click="run(() => ctx.cutSelection())">
      <span>Cut</span>
      <span class="context-menu__hint">{{ modKey }}X</span>
    </button>

    <button
      type="button"
      role="menuitem"
      class="context-menu__item"
      :disabled="ctx.clipboardSize.value === 0"
      @click="run(() => ctx.paste())"
    >
      <span>Paste</span>
      <span class="context-menu__hint">{{ modKey }}V</span>
    </button>

    <div class="context-menu__separator" role="separator" />

    <button
      type="button"
      role="menuitem"
      class="context-menu__item is-danger"
      @click="run(() => ctx.deleteSelection())"
    >
      <span>Delete</span>
      <span class="context-menu__hint">Del</span>
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 20;
  min-width: 200px;
  padding: 4px;
  background: var(--vd-surface);
  border: 1px solid var(--vd-border);
  border-radius: var(--vd-radius-l);
  box-shadow: var(--vd-shadow-1), var(--vd-shadow-2);
}

.context-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 0 8px 0 10px;
  border: none;
  border-radius: var(--vd-radius-m);
  background: transparent;
  color: var(--vd-ink);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--vd-fast) var(--vd-ease);
}

.context-menu__item:hover {
  background: var(--vd-hover);
}

.context-menu__item:focus-visible {
  outline: 2px solid var(--vd-accent);
  outline-offset: -2px;
}

.context-menu__item.is-danger {
  color: var(--vd-danger);
}

.context-menu__item.is-danger:hover {
  background: var(--vd-danger-soft);
}

.context-menu__item:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.context-menu__hint {
  color: var(--vd-ink-soft);
  font-size: 12px;
}

.context-menu__separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--vd-border);
}
</style>
