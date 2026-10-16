<script setup lang="ts">
const props = defineProps<{
  colors: readonly string[]
  modelValue: string
  ariaLabel: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const TRANSPARENT = 'transparent'

function labelFor(color: string): string {
  return color === TRANSPARENT ? 'No background' : color
}

function select(color: string): void {
  if (color !== props.modelValue) {
    emit('update:modelValue', color)
  }
}
</script>

<template>
  <div class="ui-swatch-row" role="radiogroup" :aria-label="props.ariaLabel">
    <button
      v-for="color in props.colors"
      :key="color"
      type="button"
      role="radio"
      class="ui-swatch"
      :class="{ 'is-transparent': color === TRANSPARENT }"
      :style="{ backgroundColor: color === TRANSPARENT ? undefined : color }"
      :aria-checked="color === props.modelValue"
      :aria-label="labelFor(color)"
      :title="labelFor(color)"
      @click="select(color)"
    />
  </div>
</template>

<style scoped>
.ui-swatch-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ui-swatch {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  /* Hairline keeps near-white and near-black chips visible on any surface. */
  box-shadow: inset 0 0 0 1px var(--vd-border);
  transition: transform var(--vd-fast) var(--vd-ease);
}

.ui-swatch:hover {
  transform: scale(1.08);
}

.ui-swatch:active {
  transform: scale(0.96);
}

.ui-swatch:focus-visible {
  outline: 2px solid var(--vd-accent);
  outline-offset: 2px;
}

.ui-swatch.is-active {
  outline: 2px solid var(--vd-accent);
  outline-offset: 2px;
}

/* CSS checkerboard for the "no background" swatch. */
.ui-swatch.is-transparent {
  background-color: var(--vd-surface-raised);
  background-image:
    linear-gradient(
      45deg,
      rgba(73, 80, 87, 0.25) 25%,
      transparent 25%,
      transparent 75%,
      rgba(73, 80, 87, 0.25) 75%
    ),
    linear-gradient(
      45deg,
      rgba(73, 80, 87, 0.25) 25%,
      transparent 25%,
      transparent 75%,
      rgba(73, 80, 87, 0.25) 75%
    );
  background-position:
    0 0,
    4px 4px;
  background-size: 8px 8px;
}
</style>
