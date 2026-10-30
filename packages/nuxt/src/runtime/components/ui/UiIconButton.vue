<script setup lang="ts">
import type { IconName } from '../../constants/icons.js'

import UiIcon from './UiIcon.vue'

/**
 * UiIconButton — Excalidraw's ToolIcon: a square icon button (32px, or
 * 36px for the toolbar and on-canvas buttons) with the lavender hover,
 * the accent-soft checked state and an optional key hint in its corner.
 */
const props = withDefaults(
  defineProps<{
    /** Semantic icon name rendered inside the button. */
    icon: IconName
    /** Accessible name — used as aria-label and title tooltip. */
    label: string
    /** Marks the control as engaged (active tool, grid on). */
    active?: boolean
    /** Dimmed, with all interaction blocked. */
    disabled?: boolean
    /** Destructive tint — hover turns danger red. */
    danger?: boolean
    /** md: 32px (panels); lg: 36px (toolbar, on-canvas buttons). */
    size?: 'md' | 'lg'
    /** Key hint shown in the bottom-right corner (toolbar tools). */
    keybinding?: string
    /** Filled on-canvas look: surface-low fill, no island around it. */
    filled?: boolean
  }>(),
  { active: false, disabled: false, danger: false, size: 'md', keybinding: undefined, filled: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    class="ui-icon-button"
    :class="[
      `ui-icon-button--${props.size}`,
      { 'is-active': props.active, 'is-danger': props.danger, 'is-filled': props.filled },
    ]"
    :disabled="props.disabled"
    :aria-label="props.label"
    :title="props.label"
    :aria-pressed="props.active ? 'true' : 'false'"
    @click="emit('click', $event)"
  >
    <UiIcon :name="props.icon" :size="16" />
    <span v-if="props.keybinding" class="ui-icon-button__key" aria-hidden="true">{{ props.keybinding }}</span>
  </button>
</template>

<style scoped>
/* Press feedback via transform only, never layout. */
.ui-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--od-button);
  height: var(--od-button);
  padding: 0;
  border: none;
  border-radius: var(--od-radius-l);
  background: transparent;
  color: var(--od-ink);
  cursor: pointer;
  transition:
    background-color var(--od-fast) ease-out,
    color var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.ui-icon-button--lg {
  width: var(--od-button-lg);
  height: var(--od-button-lg);
}

.ui-icon-button:hover {
  background: var(--od-hover);
}

.ui-icon-button:active {
  transform: scale(0.94);
  box-shadow: inset 0 0 0 1px var(--od-brand-active);
}

.ui-icon-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}

.ui-icon-button.is-active {
  background: var(--od-accent-soft);
  color: var(--od-on-accent-soft);
}

.ui-icon-button.is-filled {
  background: var(--od-surface-low);
  box-shadow: 0 0 0 1px var(--od-surface);
}

.ui-icon-button.is-filled:hover {
  background: var(--od-surface-high);
}

.ui-icon-button.is-danger:hover {
  background: var(--od-danger-soft);
  color: var(--od-danger);
}

.ui-icon-button:disabled {
  opacity: 0.35;
  pointer-events: none;
}

.ui-icon-button__key {
  position: absolute;
  right: 3px;
  bottom: 2px;
  font-size: 10px;
  line-height: 1;
  color: var(--od-keybinding);
  pointer-events: none;
  user-select: none;
}

.ui-icon-button.is-active .ui-icon-button__key {
  color: var(--od-on-accent-soft);
}
</style>
