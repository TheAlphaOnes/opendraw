<script lang="ts">
import type { IconName } from '../../constants/icons.js'

export interface UiSegmentedOption {
  /** Stable value emitted on selection. */
  value: string
  /** Accessible name, tooltip, and (when no icon is set) the visible text. */
  label: string
  /** Optional registry icon — icon options render as 32x32 hit areas. */
  icon?: IconName
  /** Shorter visible text when the label is too long for the track. */
  text?: string
}
</script>

<script setup lang="ts">
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
      <UiIcon v-if="option.icon" :name="option.icon" :size="16" />
      <span v-else class="ui-segmented__label">{{ option.text ?? option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Compact pill track; active option raises above it. */
.ui-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: var(--vd-hover);
}

.ui-segmented--block {
  display: flex;
  width: 100%;
}

.ui-segmented--block .ui-segmented__option {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 4px;
}

.ui-segmented__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: var(--vd-radius-m);
  background: transparent;
  color: var(--vd-ink-soft);
  cursor: pointer;
  transition:
    background-color 150ms var(--vd-ease),
    color 150ms var(--vd-ease),
    box-shadow 150ms var(--vd-ease),
    transform var(--vd-fast) var(--vd-ease);
}

.ui-segmented__option:hover {
  color: var(--vd-ink);
}

.ui-segmented__option:active {
  transform: scale(0.96);
}

.ui-segmented__option:focus-visible {
  outline: 2px solid var(--vd-accent);
  outline-offset: 1px;
}

.ui-segmented__option.is-active {
  background: var(--vd-surface-raised);
  color: var(--vd-ink);
  box-shadow: var(--vd-shadow-1);
}

.ui-segmented__label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
</style>
