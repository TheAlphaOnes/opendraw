<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { COLOR_OUTLINE_CONTRAST_THRESHOLD, isColorDark, themeColor } from '@opendraw/core'

import UiColorPickerContent from './UiColorPickerContent.vue'

/**
 * UiColorPicker — Excalidraw's color row: five top picks, a divider and
 * the active-color swatch, which opens the full picker beside the panel.
 * Swatches show colors as the canvas paints them (dark-filtered in the
 * dark theme); the value stays the stored color.
 */
const props = defineProps<{
  modelValue: string
  topPicks: readonly string[]
  kind: 'stroke' | 'background'
  /** Section name for labels ("Stroke", "Background"). */
  label: string
  customColors: readonly string[]
  dark: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const teleportTarget = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0, arrow: 0, above: false })

/** Popover offset from the trigger, leaving room for the pointer triangle. */
const POPOVER_GAP = 14
const EDGE_MARGIN = 8

const display = (color: string): string => themeColor(color, props.dark)
const outlined = (color: string): boolean => !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD)
const describe = (color: string): string => (color === 'transparent' ? 'Transparent' : color)

function select(color: string): void {
  if (color !== props.modelValue) {
    emit('update:modelValue', color)
  }
}

onMounted(() => {
  teleportTarget.value = triggerRef.value?.closest<HTMLElement>('.opendraw-root') ?? null
})

/**
 * Right of the panel, top-aligned with the trigger, kept inside the editor.
 * Without room on the right (phones, where the panel spans the width) it
 * opens above the trigger instead, centered on it, with no pointer.
 */
async function place(): Promise<void> {
  const trigger = triggerRef.value
  const root = teleportTarget.value
  if (!trigger || !root) {
    return
  }
  const panel = trigger.closest<HTMLElement>('.ui-panel') ?? trigger
  const t = trigger.getBoundingClientRect()
  const r = root.getBoundingClientRect()
  await nextTick()
  const width = popoverRef.value?.offsetWidth ?? 0
  const height = popoverRef.value?.offsetHeight ?? 0
  const left = Math.max(panel.getBoundingClientRect().right, t.right) - r.left + POPOVER_GAP
  if (left + width <= r.width - EDGE_MARGIN) {
    const top = Math.max(EDGE_MARGIN, Math.min(t.top - r.top - 12, r.height - height - EDGE_MARGIN))
    position.value = { left, top, arrow: t.top - r.top + t.height / 2 - top, above: false }
    return
  }
  const centered = t.left - r.left + t.width / 2 - width / 2
  position.value = {
    left: Math.max(EDGE_MARGIN, Math.min(centered, r.width - width - EDGE_MARGIN)),
    top: Math.max(EDGE_MARGIN, t.top - r.top - height - EDGE_MARGIN),
    arrow: 0,
    above: true,
  }
}

async function show(): Promise<void> {
  open.value = true
  document.addEventListener('pointerdown', onOutsidePointer, true)
  await place()
}

function hide(returnFocus: boolean): void {
  open.value = false
  document.removeEventListener('pointerdown', onOutsidePointer, true)
  if (returnFocus) {
    triggerRef.value?.focus({ preventScroll: true })
  }
}

function onOutsidePointer(event: PointerEvent): void {
  const target = event.target as Node
  if (!popoverRef.value?.contains(target) && !triggerRef.value?.contains(target)) {
    hide(false)
  }
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutsidePointer, true))
</script>

<template>
  <div class="ui-color-picker">
    <div class="ui-color-picker__picks" role="radiogroup" :aria-label="`${props.label} color`">
      <button
        v-for="color in props.topPicks"
        :key="color"
        type="button"
        role="radio"
        class="ui-color-picker__pick"
        :class="{ 'is-transparent': color === 'transparent', 'has-outline': outlined(color) }"
        :style="{ '--swatch': display(color) }"
        :aria-checked="color === props.modelValue"
        :aria-label="describe(color)"
        :title="describe(color)"
        @click="select(color)"
      />
    </div>
    <span class="ui-color-picker__divider" aria-hidden="true" />
    <button
      ref="triggerRef"
      type="button"
      class="ui-color-picker__trigger"
      :class="{ 'is-transparent': props.modelValue === 'transparent', 'has-outline': outlined(props.modelValue) }"
      :style="{ '--swatch': display(props.modelValue) }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="`${props.label} color picker`"
      :title="`Show ${props.label.toLowerCase()} color picker`"
      @click="open ? hide(false) : show()"
    />
  </div>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <Transition name="ui-color-popover">
      <div
        v-if="open"
        ref="popoverRef"
        class="ui-color-popover"
        :class="{ 'is-above': position.above }"
        role="dialog"
        :aria-label="`${props.label} color picker`"
        :style="{ left: `${position.left}px`, top: `${position.top}px`, '--arrow-y': `${position.arrow}px` }"
      >
        <UiColorPickerContent
          :model-value="props.modelValue"
          :kind="props.kind"
          :custom-colors="props.customColors"
          :dark="props.dark"
          @change="select"
          @close="hide(true)"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-color-picker {
  display: grid;
  grid-template-columns: 1fr 15px 26px;
  align-items: center;
  padding: 4px 0;
}

.ui-color-picker__picks {
  display: flex;
  justify-content: space-between;
  gap: 5px;
}

/* Phones: the panel spans the screen, so the row packs left instead of spreading. */
@media (max-width: 640px) {
  .ui-color-picker {
    grid-template-columns: auto 15px 26px;
    justify-content: start;
  }

  .ui-color-picker__picks {
    gap: 8px;
  }
}

.ui-color-picker__pick,
.ui-color-picker__trigger {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: var(--swatch);
  cursor: pointer;
  transition:
    box-shadow var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.ui-color-picker__trigger {
  width: 26px;
  height: 26px;
  border-radius: 5px;
}

.has-outline {
  box-shadow: 0 0 0 1px var(--od-border);
}

.ui-color-picker__pick:hover,
.ui-color-picker__trigger:hover {
  box-shadow: 0 0 0 1px var(--od-accent);
}

.ui-color-picker__pick:active,
.ui-color-picker__trigger:active {
  transform: scale(0.92);
}

.ui-color-picker__pick[aria-checked='true']::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--od-accent);
}

.ui-color-picker__pick:focus-visible,
.ui-color-picker__trigger:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 2px;
}

.ui-color-picker__divider {
  justify-self: center;
  width: 1px;
  height: 20px;
  background: var(--od-border);
}

.is-transparent {
  background-color: var(--od-surface-raised);
  background-image:
    linear-gradient(45deg, rgba(73, 80, 87, 0.25) 25%, transparent 25%, transparent 75%, rgba(73, 80, 87, 0.25) 75%),
    linear-gradient(45deg, rgba(73, 80, 87, 0.25) 25%, transparent 25%, transparent 75%, rgba(73, 80, 87, 0.25) 75%);
  background-position:
    0 0,
    4px 4px;
  background-size: 8px 8px;
}

.ui-color-popover {
  position: absolute;
  z-index: 30;
  padding: 12px 8px;
  background: var(--od-surface);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
}

/* Opened above the trigger (no room beside the panel): no pointer. */
.ui-color-popover.is-above::before {
  display: none;
}

/* The pointer triangle, aimed at the trigger. */
.ui-color-popover::before {
  content: '';
  position: absolute;
  top: calc(var(--arrow-y) - 9px);
  left: -9px;
  border-style: solid;
  border-width: 9px 10px 9px 0;
  border-color: transparent var(--od-surface) transparent transparent;
  filter: drop-shadow(-1px 0 0 var(--od-border));
}

.ui-color-popover-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 200ms var(--od-ease);
}

.ui-color-popover-leave-active {
  transition: opacity 90ms ease-in;
}

.ui-color-popover-enter-from {
  opacity: 0;
  transform: translateX(-6px) scale(0.98);
}

.ui-color-popover-leave-to {
  opacity: 0;
}
</style>
