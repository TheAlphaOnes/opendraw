<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { actionById, isActionEnabled, runAction, type ActionId } from '@opendrawjs/editor'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiMenuItem from '../ui/UiMenuItem.vue'

/**
 * The right-click menu — Excalidraw's App.getContextMenuItems, generated
 * from the action registry. Actions that do not apply right now are left
 * out (Excalidraw's contextItemPredicate), and separators collapse so the
 * menu never shows an empty section.
 */
const props = defineProps<{
  /** Viewport coordinates the menu opens at. */
  x: number
  y: number
  visible: boolean
  target: 'element' | 'canvas'
}>()

const emit = defineEmits<{ close: [] }>()

const ctx = useOpenDraw()
const rootEl = ref<HTMLElement | null>(null)

const SEPARATOR = '|'
type MenuEntry = ActionId | typeof SEPARATOR

const ELEMENT_MENU: readonly MenuEntry[] = [
  'cut', 'copy', 'paste', SEPARATOR,
  'copyStyles', 'pasteStyles', SEPARATOR,
  'group', 'ungroup', SEPARATOR,
  'sendBackward', 'bringForward', 'sendToBack', 'bringToFront', SEPARATOR,
  'flipHorizontal', 'flipVertical', SEPARATOR,
  'duplicate', 'toggleLock', SEPARATOR,
  'deleteSelection',
]

const CANVAS_MENU: readonly MenuEntry[] = [
  'paste', SEPARATOR,
  'selectAll', SEPARATOR,
  'zoomToFit', 'toggleGrid', 'toggleTheme', SEPARATOR,
  'exportPNG', 'exportSVG',
]

interface MenuSection {
  key: string
  items: ActionId[]
}

/** Enabled actions, split into non-empty sections. */
const sections = computed<MenuSection[]>(() => {
  // Track every change so the menu follows the selection while open.
  void ctx.revision.value
  const entries = props.target === 'element' ? ELEMENT_MENU : CANVAS_MENU
  const result: MenuSection[] = []
  let current: ActionId[] = []
  for (const entry of entries) {
    if (entry === SEPARATOR) {
      if (current.length > 0) {
        result.push({ key: current.join(','), items: current })
      }
      current = []
    } else if (isActionEnabled(ctx.editor, entry)) {
      current.push(entry)
    }
  }
  if (current.length > 0) {
    result.push({ key: current.join(','), items: current })
  }
  return result
})

// ---------------------------------------------------------------------------
// Placement — measured after mount, clamped inside the viewport
// ---------------------------------------------------------------------------

const VIEWPORT_MARGIN = 8
const position = ref({ left: 0, top: 0 })

async function place(): Promise<void> {
  position.value = { left: props.x, top: props.y }
  await nextTick()
  const el = rootEl.value
  if (!el || typeof window === 'undefined') {
    return
  }
  const { width, height } = el.getBoundingClientRect()
  position.value = {
    left: Math.max(VIEWPORT_MARGIN, Math.min(props.x, window.innerWidth - width - VIEWPORT_MARGIN)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(props.y, window.innerHeight - height - VIEWPORT_MARGIN)),
  }
  // The menu itself takes focus (no ring on a mouse-opened item); the
  // arrow keys then step into the items.
  el.focus({ preventScroll: true })
}

// ---------------------------------------------------------------------------
// Dismissal & keyboard navigation
// ---------------------------------------------------------------------------

function onPointerDown(event: PointerEvent): void {
  if (!rootEl.value?.contains(event.target as Node)) {
    emit('close')
  }
}

function focusSibling(step: 1 | -1): void {
  const items = Array.from(rootEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  if (items.length === 0) {
    return
  }
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = index === -1 ? (step === 1 ? 0 : items.length - 1) : (index + step + items.length) % items.length
  items[next]!.focus()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusSibling(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusSibling(-1)
  }
}

function detachListeners(): void {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeyDown, true)
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
      void place()
    } else {
      detachListeners()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    detachListeners()
  }
})

/** Every item runs its action, then dismisses the menu. */
function select(id: ActionId): void {
  runAction(ctx.editor, id)
  emit('close')
}
</script>

<!-- Design law: no entrance animation on context menus; only a quick exit
     fade, so dismissal always feels faster than opening. -->
<template>
  <Transition name="context-menu">
    <div
      v-if="props.visible && sections.length > 0"
      ref="rootEl"
      class="context-menu"
      role="menu"
      tabindex="-1"
      :aria-label="props.target === 'element' ? 'Element actions' : 'Canvas actions'"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    >
      <template v-for="(section, index) in sections" :key="section.key">
        <div v-if="index > 0" class="context-menu__separator" role="separator" />
        <UiMenuItem
          v-for="id in section.items"
          :key="id"
          :label="actionById(id).label"
          :icon="actionById(id).icon"
          :keys="actionById(id).keys"
          :danger="actionById(id).danger"
          @select="select(id)"
        />
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 20;
  min-width: 220px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: 4px;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
}

.context-menu:focus {
  outline: none;
}

.context-menu__separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--od-border);
}

.context-menu-enter-active {
  transition: none;
}

.context-menu-leave-active {
  transition: opacity 100ms ease-in;
}

.context-menu-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .context-menu-leave-active {
    transition: none;
  }
}
</style>
