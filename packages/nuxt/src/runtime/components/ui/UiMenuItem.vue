<script setup lang="ts">
import type { IconName } from '../../constants/icons.js'

import UiIcon from './UiIcon.vue'
import UiKbd from './UiKbd.vue'

/**
 * UiMenuItem — one row of a menu: optional icon, label, shortcut hint.
 * Hover eases in (never instant); the press depresses; keyboard focus is
 * an instant focus-visible ring with no motion (keyboard nav never
 * animates).
 */
const props = withDefaults(
  defineProps<{
    label: string
    icon?: IconName
    keys?: readonly string[]
    danger?: boolean
    disabled?: boolean
  }>(),
  { icon: undefined, keys: undefined, danger: false, disabled: false },
)

const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    role="menuitem"
    class="ui-menu-item"
    :class="{ 'is-danger': props.danger }"
    :disabled="props.disabled"
    @click="emit('select')"
  >
    <span class="ui-menu-item__icon">
      <UiIcon v-if="props.icon" :name="props.icon" :size="16" />
    </span>
    <span class="ui-menu-item__label">{{ props.label }}</span>
    <UiKbd v-if="props.keys && props.keys.length > 0" :keys="props.keys" inline />
  </button>
</template>

<style scoped>
.ui-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 32px;
  padding: 0 10px 0 8px;
  border: none;
  border-radius: var(--vd-radius-m);
  background: transparent;
  color: var(--vd-ink);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--vd-fast) ease-out,
    transform var(--vd-fast) var(--vd-ease);
}

.ui-menu-item:hover {
  background: var(--vd-hover);
}

.ui-menu-item:active {
  transform: scale(0.98);
}

.ui-menu-item:focus-visible {
  outline: 2px solid var(--vd-accent);
  outline-offset: -2px;
  transition: none;
}

.ui-menu-item.is-danger {
  color: var(--vd-danger);
}

.ui-menu-item.is-danger:hover {
  background: var(--vd-danger-soft);
}

.ui-menu-item:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.ui-menu-item__icon {
  display: inline-flex;
  width: 16px;
  color: var(--vd-ink-soft);
}

.ui-menu-item.is-danger .ui-menu-item__icon {
  color: inherit;
}

.ui-menu-item__label {
  flex: 1;
  white-space: nowrap;
}
</style>
