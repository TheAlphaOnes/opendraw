<script lang="ts">
import type { IconName } from '../../constants/icons.js'

export interface UiPopoverOption {
  value: string
  /** Accessible name and tooltip. */
  label: string
  icon: IconName
  /** Solid glyph variant. */
  filled?: boolean
  /** Glyph rotation in degrees. */
  rotate?: number
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import UiIcon from './UiIcon.vue'

/**
 * UiPopoverSelect, a compact trigger showing the current choice that opens
 * a grid of icon options (Excalidraw's arrowhead / font pickers).
 *
 * The popover teleports to the editor root: panels scroll and carry a
 * backdrop-filter, either of which would clip or re-anchor a popover left
 * inside them. Keyboard: arrows move between options, Enter/Space pick,
 * Escape closes and returns focus to the trigger.
 */
const props = withDefaults(
  defineProps<{
    options: UiPopoverOption[]
    modelValue: string
    ariaLabel: string
    /** Grid columns in the popover. */
    columns?: number
  }>(),
  { columns: 3 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const teleportTarget = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })

const current = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? props.options[0]!,
)

const POPOVER_GAP = 6

onMounted(() => {
  teleportTarget.value = triggerRef.value?.closest<HTMLElement>('.opendraw-root') ?? null
})

function place(): void {
  const trigger = triggerRef.value
  const root = teleportTarget.value
  if (!trigger || !root) {
    return
  }
  const t = trigger.getBoundingClientRect()
  const r = root.getBoundingClientRect()
  position.value = { left: t.left - r.left, top: t.bottom - r.top + POPOVER_GAP }
}

async function show(): Promise<void> {
  place()
  open.value = true
  document.addEventListener('pointerdown', onOutsidePointer, true)
  await nextTick()
  popoverRef.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
}

function hide(returnFocus: boolean): void {
  open.value = false
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  if (returnFocus) {
    triggerRef.value?.focus({ preventScroll: true })
  }
}

function toggle(): void {
  if (open.value) {
    hide(false)
  } else {
    void show()
  }
}

function onOutsidePointer(event: PointerEvent): void {
  const target = event.target as Node
  if (!popoverRef.value?.contains(target) && !triggerRef.value?.contains(target)) {
    hide(false)
  }
}

function pick(value: string): void {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
  hide(true)
}

function onPopoverKeyDown(event: KeyboardEvent): void {
  const items = Array.from(popoverRef.value?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
  const index = items.indexOf(document.activeElement as HTMLElement)
  const step: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: props.columns,
    ArrowUp: -props.columns,
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    hide(true)
  } else if (event.key in step && items.length > 0) {
    event.preventDefault()
    event.stopPropagation()
    const next = Math.min(items.length - 1, Math.max(0, (index === -1 ? 0 : index) + step[event.key]!))
    items[next]!.focus()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer, true)
})
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="ui-popover-select"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-label="`${props.ariaLabel}: ${current.label}`"
    :title="`${props.ariaLabel}: ${current.label}`"
    @click="toggle"
  >
    <UiIcon :name="current.icon" :filled="current.filled" :rotate="current.rotate" :size="18" />
    <UiIcon name="chevronDown" :size="12" class="ui-popover-select__caret" />
  </button>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <Transition name="ui-popover">
      <div
        v-if="open"
        ref="popoverRef"
        class="ui-popover"
        role="listbox"
        :aria-label="props.ariaLabel"
        :style="{
          left: `${position.left}px`,
          top: `${position.top}px`,
          gridTemplateColumns: `repeat(${props.columns}, 36px)`,
        }"
        @keydown="onPopoverKeyDown"
      >
        <button
          v-for="option in props.options"
          :key="option.value"
          type="button"
          role="option"
          class="ui-popover__option"
          :class="{ 'is-active': option.value === props.modelValue }"
          :aria-selected="option.value === props.modelValue"
          :aria-label="option.label"
          :title="option.label"
          @click="pick(option.value)"
        >
          <UiIcon :name="option.icon" :filled="option.filled" :rotate="option.rotate" :size="18" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-popover-select {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 36px;
  padding: 0 6px 0 10px;
  border: none;
  border-radius: var(--od-radius-m);
  background: var(--od-hover);
  color: var(--od-ink);
  cursor: pointer;
  transition:
    background-color var(--od-fast) ease-out,
    transform var(--od-fast) var(--od-ease);
}

.ui-popover-select:hover {
  background: var(--od-accent-soft);
}

.ui-popover-select:active {
  transform: scale(0.96);
}

.ui-popover-select:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 1px;
}

.ui-popover-select__caret {
  color: var(--od-ink-soft);
}

.ui-popover {
  position: absolute;
  z-index: 30;
  display: grid;
  gap: 4px;
  padding: 6px;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
}

.ui-popover__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--od-radius-m);
  background: transparent;
  color: var(--od-ink);
  cursor: pointer;
  transition: background-color var(--od-fast) ease-out;
}

.ui-popover__option:hover {
  background: var(--od-hover);
}

.ui-popover__option.is-active {
  background: var(--od-accent-soft);
  color: var(--od-accent);
}

.ui-popover__option:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: -2px;
}

/* A transient panel: a short ease-out rise in, a faster fade out. */
.ui-popover-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 140ms ease-out;
}

.ui-popover-leave-active {
  transition: opacity 90ms ease-in;
}

.ui-popover-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.ui-popover-leave-to {
  opacity: 0;
}
</style>
