<script setup lang="ts">
import { computed } from 'vue'

import type { Arrowhead, OpenDrawLinearElement } from '@opendrawjs/core'

import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiPopoverSelect, { type UiPopoverOption } from '../ui/UiPopoverSelect.vue'

/**
 * Start / end arrowhead pickers, Excalidraw's "Arrowheads" property. The
 * start options are mirrored so every glyph points the way its head will.
 */
const ctx = useOpenDraw()

const NONE = 'none'

interface HeadGlyph {
  value: Arrowhead | typeof NONE
  label: string
  icon: UiPopoverOption['icon']
  filled?: boolean
  /** Rotation that makes the glyph point right (an end head). */
  rotate?: number
}

const HEADS: readonly HeadGlyph[] = [
  { value: NONE, label: 'None', icon: 'arrowheadNone' },
  { value: 'arrow', label: 'Arrow', icon: 'arrowheadArrow' },
  { value: 'triangle', label: 'Triangle', icon: 'arrowheadTriangle', filled: true, rotate: 90 },
  { value: 'triangle_outline', label: 'Triangle (outline)', icon: 'arrowheadTriangle', rotate: 90 },
  { value: 'circle', label: 'Circle', icon: 'arrowheadCircle', filled: true },
  { value: 'circle_outline', label: 'Circle (outline)', icon: 'arrowheadCircle' },
  { value: 'diamond', label: 'Diamond', icon: 'arrowheadDiamond', filled: true },
  { value: 'diamond_outline', label: 'Diamond (outline)', icon: 'arrowheadDiamond' },
  { value: 'bar', label: 'Bar', icon: 'arrowheadBar', rotate: 90 },
]

function optionsFor(position: 'start' | 'end'): UiPopoverOption[] {
  return HEADS.map((head) => ({
    value: head.value,
    label: head.label,
    icon: head.icon,
    filled: head.filled,
    // Start heads point left: mirror by an extra half turn.
    rotate: (head.rotate ?? 0) + (position === 'start' && head.value !== NONE ? 180 : 0),
  }))
}

const startOptions = optionsFor('start')
const endOptions = optionsFor('end')

const firstArrow = computed(
  () => ctx.selectedElements.value.find((el): el is OpenDrawLinearElement => el.type === 'arrow') ?? null,
)
const current = computed(() => {
  const arrow = firstArrow.value
  return arrow
    ? { start: arrow.startArrowhead, end: arrow.endArrowhead }
    : ctx.appState.value.arrowheads
})

function set(position: 'start' | 'end', value: string): void {
  ctx.changeArrowhead(position, value === NONE ? null : (value as Arrowhead))
}
</script>

<template>
  <div class="arrowhead-picker">
    <UiPopoverSelect
      :options="startOptions"
      :model-value="current.start ?? NONE"
      ariaLabel="Start arrowhead"
      @update:model-value="set('start', $event)"
    />
    <UiPopoverSelect
      :options="endOptions"
      :model-value="current.end ?? NONE"
      ariaLabel="End arrowhead"
      @update:model-value="set('end', $event)"
    />
  </div>
</template>

<style scoped>
.arrowhead-picker {
  display: flex;
  gap: 8px;
}
</style>
