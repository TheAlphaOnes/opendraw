<script setup lang="ts">
/**
 * UiSlider — the central range control, mirroring Excalidraw's opacity
 * slider: a filled progress track, a native thumb, and a live value readout.
 * Dumb by design — a value in, an update out; no domain logic.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Current value. */
    modelValue: number
    /** Range minimum. */
    min?: number
    /** Range maximum. */
    max?: number
    /** Step granularity; Excalidraw's sliders step by 10. */
    step?: number
    /** Accessible name for the range input. */
    ariaLabel: string
    /** Unit appended to the value readout (e.g. `%`). */
    suffix?: string
  }>(),
  { min: 0, max: 100, step: 10, suffix: '' },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()

/** Filled share of the track, kept off the native input so the fill animates. */
const progress = computed(
  () => ((props.modelValue - props.min) / (props.max - props.min || 1)) * 100,
)

function onInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <div class="ui-slider">
    <div class="ui-slider__track" aria-hidden="true">
      <div class="ui-slider__fill" :style="{ width: `${progress}%` }" />
    </div>
    <input
      class="ui-slider__input"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :aria-label="ariaLabel"
      @input="onInput"
    />
    <span class="ui-slider__value" aria-hidden="true">{{ modelValue }}{{ suffix }}</span>
  </div>
</template>

<style scoped>
.ui-slider {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 140px;
}

/* The painted track sits behind the native input, which keeps its own
   invisible track so dragging and keyboard control stay fully native. */
.ui-slider__track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--vd-border);
  overflow: hidden;
}

.ui-slider__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--vd-accent);
  transition: width var(--vd-fast) var(--vd-ease);
}

.ui-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  cursor: pointer;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
}

/* Align the invisible native track with the painted one. */
.ui-slider__input::-webkit-slider-runnable-track {
  height: 14px;
  background: transparent;
}

.ui-slider__input::-moz-range-track {
  height: 14px;
  background: transparent;
}

.ui-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: 0;
  border: 2px solid var(--vd-surface-raised);
  border-radius: 50%;
  background: var(--vd-accent);
  box-shadow: var(--vd-shadow-1);
}

.ui-slider__input::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 2px solid var(--vd-surface-raised);
  border-radius: 50%;
  background: var(--vd-accent);
  box-shadow: var(--vd-shadow-1);
}

.ui-slider__input:focus-visible {
  outline: 2px solid var(--vd-accent);
  outline-offset: 4px;
}

.ui-slider__value {
  min-width: 34px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--vd-ink-soft);
  text-align: right;
}
</style>
