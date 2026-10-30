<script lang="ts">
import type { IconName } from '../../constants/icons.js'
import type { StyleGlyphName } from './StyleGlyph.vue'

export interface UiSegmentedOption {
  /** Stable value emitted on selection. */
  value: string
  /** Accessible name, tooltip, and (when no icon is set) the visible text. */
  label: string
  /** Optional registry icon, icon options render as 32x32 hit areas. */
  icon?: IconName
  /** A drawing of the style value itself (fill, stroke, sloppiness, edges). */
  glyph?: StyleGlyphName
  /** Shorter visible text when the label is too long for the track. */
  text?: string
}
</script>

<script setup lang="ts">
import StyleGlyph from './StyleGlyph.vue'
import UiIcon from './UiIcon.vue'

const props = withDefaults(
  defineProps<{
    options: UiSegmentedOption[]
    modelValue: string
    ariaLabel: string
    /** Stretch the track to its container, options sharing the width. */
    block?: boolean
  }>(),
  { block: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function select(option: UiSegmentedOption): void {
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
  }
}

/** Arrow-key navigation expected of a radiogroup. */
function onKeyDown(event: KeyboardEvent): void {
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
  const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
  if (!forward && !backward) {
    return
  }
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  const nextIndex = (index + (forward ? 1 : -1) + props.options.length) % props.options.length
  const next = props.options[nextIndex]
  if (!next) {
    return
  }
  event.preventDefault()
  select(next)
}
</script>

<template>
  <div class="ui-segmented" :class="{ 'ui-segmented--block': props.block }" role="radiogroup" :aria-label="props.ariaLabel" @keydown="onKeyDown">
    <button
      v-for="option in props.options"
      :key="option.value"
      type="button"
      role="radio"
      class="ui-segmented__option"
      :class="{ 'is-active': option.value === props.modelValue }"
      :aria-checked="option.value === props.modelValue"
      :aria-label="option.label"
      :title="option.label"
      @click="select(option)"
    >
      <StyleGlyph v-if="option.glyph" :name="option.glyph" />
      <UiIcon v-else-if="option.icon" :name="option.icon" :size="16" />
      <span v-else class="ui-segmented__label">{{ option.text ?? option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Excalidraw's .buttonList: separate 32px outline buttons, 8px apart; the
   checked one fills with the selected tone. */
.ui-segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ui-segmented__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--od-button);
  height: var(--od-button);
  padding: 0;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-l);
  background: var(--od-surface);
  color: var(--od-ink);
  cursor: pointer;
  transition:
    background-color var(--od-fast) ease-out,
    border-color var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.ui-segmented__option:hover {
  background: var(--od-hover);
}

.ui-segmented__option:active {
  transform: scale(0.94);
  border-color: var(--od-brand-active);
}

.ui-segmented__option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--od-accent);
}

.ui-segmented__option.is-active {
  background: var(--od-accent-soft);
  border-color: var(--od-accent-soft);
  color: var(--od-on-accent-soft);
}

.ui-segmented__label {
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
}
</style>
