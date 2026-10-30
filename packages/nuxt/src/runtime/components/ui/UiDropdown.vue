<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * UiDropdown — Excalidraw's DropdownMenu: a trigger (slot) that opens an
 * island of menu items below it. The panel teleports to the editor root
 * so scrolling islands never clip it. Escape and an outside press close
 * it; picking an item closes it too (items emit through the default slot's
 * `close` binding). Arrow keys move between items.
 */
const props = withDefaults(
  defineProps<{
    /** Accessible name of the menu. */
    label: string
    /** Which trigger edge the panel aligns to. */
    align?: 'start' | 'center' | 'end'
    /** Panel width in px (Excalidraw's main menu is 208px wide). */
    width?: number
  }>(),
  { align: 'start', width: 208 },
)

const open = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const teleportTarget = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })

const GAP = 8
const EDGE = 8

onMounted(() => {
  teleportTarget.value = anchorRef.value?.closest<HTMLElement>('.opendraw-root') ?? null
})

function place(): void {
  const anchor = anchorRef.value
  const root = teleportTarget.value
  if (!anchor || !root) {
    return
  }
  const a = anchor.getBoundingClientRect()
  const r = root.getBoundingClientRect()
  const startX = a.left - r.left
  const left =
    props.align === 'start'
      ? startX
      : props.align === 'end'
        ? startX + a.width - props.width
        : startX + a.width / 2 - props.width / 2
  position.value = {
    left: Math.max(EDGE, Math.min(left, r.width - props.width - EDGE)),
    top: a.bottom - r.top + GAP,
  }
}

async function show(): Promise<void> {
  place()
  open.value = true
  document.addEventListener('pointerdown', onOutside, true)
  await nextTick()
  panelRef.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
}

function close(returnFocus = false): void {
  if (!open.value) {
    return
  }
  open.value = false
  document.removeEventListener('pointerdown', onOutside, true)
  if (returnFocus) {
    anchorRef.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }
}

function toggle(): void {
  if (open.value) {
    close()
  } else {
    void show()
  }
}

function onOutside(event: PointerEvent): void {
  const target = event.target as Node
  if (!panelRef.value?.contains(target) && !anchorRef.value?.contains(target)) {
    close()
  }
}

function onKeyDown(event: KeyboardEvent): void {
  // Menu keys never reach the canvas shortcuts.
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }
  event.preventDefault()
  const items = Array.from(panelRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))

defineExpose({ close })
</script>

<template>
  <div ref="anchorRef" class="ui-dropdown">
    <slot name="trigger" :open="open" :toggle="toggle" />
  </div>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <Transition name="ui-dropdown">
      <div
        v-if="open"
        ref="panelRef"
        class="ui-dropdown__panel"
        role="menu"
        :aria-label="props.label"
        :style="{ left: `${position.left}px`, top: `${position.top}px`, width: `${props.width}px` }"
        @keydown="onKeyDown"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-dropdown {
  display: inline-flex;
}

.ui-dropdown__panel {
  position: absolute;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: calc(100% - var(--od-gutter) * 2 - var(--od-button-lg));
  overflow-y: auto;
  padding: 8px;
  background: var(--od-surface);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
}

/* Opens with a short drop; items settle a beat later (staggered below). */
.ui-dropdown-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 200ms var(--od-ease);
}

.ui-dropdown-leave-active {
  transition: opacity 90ms ease-in;
}

.ui-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.985);
}

.ui-dropdown-leave-to {
  opacity: 0;
}

.ui-dropdown__panel :slotted(*) {
  animation: ui-dropdown-item 220ms var(--od-ease) both;
}

.ui-dropdown__panel :slotted(*:nth-child(2)) {
  animation-delay: 15ms;
}

.ui-dropdown__panel :slotted(*:nth-child(3)) {
  animation-delay: 30ms;
}

.ui-dropdown__panel :slotted(*:nth-child(4)) {
  animation-delay: 45ms;
}

.ui-dropdown__panel :slotted(*:nth-child(n + 5)) {
  animation-delay: 60ms;
}

@keyframes ui-dropdown-item {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
}
</style>
