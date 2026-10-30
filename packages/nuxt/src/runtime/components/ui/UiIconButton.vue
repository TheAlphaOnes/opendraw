<script setup lang="ts">
import type { IconName } from '../../constants/icons.js'

import UiIcon from './UiIcon.vue'

const props = withDefaults(
  defineProps<{
    /** Semantic icon name rendered inside the button. */
    icon: IconName
    /** Accessible name — used as aria-label and title tooltip. */
    label: string
    /** Marks the control as engaged (active tool, grid on). */
    active?: boolean
    /** 40% opacity with all interaction blocked. */
    disabled?: boolean
    /** Destructive tint — hover turns danger red. */
    danger?: boolean
  }>(),
  { active: false, disabled: false, danger: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    class="ui-icon-button"
    :class="{ 'is-active': props.active, 'is-danger': props.danger }"
    :disabled="props.disabled"
    :aria-label="props.label"
    :title="props.label"
    :aria-pressed="props.active ? 'true' : 'false'"
    @click="emit('click', $event)"
  >
    <UiIcon :name="props.icon" />
  </button>
</template>

<style scoped>
/* 40x40 hit area (Fitts); press feedback via transform only, never layout. */
.ui-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--od-radius-m);
  background: transparent;
  color: var(--od-ink);
  cursor: pointer;
  transition:
    background-color var(--od-fast) var(--od-ease),
    color var(--od-fast) var(--od-ease),
    transform var(--od-fast) var(--od-ease);
}

.ui-icon-button:hover {
  background: var(--od-hover);
}

.ui-icon-button:active {
  transform: scale(0.96);
}

.ui-icon-button:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 2px;
}

.ui-icon-button.is-active {
  background: var(--od-accent-soft);
  color: var(--od-accent);
}

.ui-icon-button.is-danger:hover {
  background: var(--od-danger-soft);
  color: var(--od-danger);
}

.ui-icon-button:disabled {
  opacity: 0.4;
  pointer-events: none;
}
</style>
