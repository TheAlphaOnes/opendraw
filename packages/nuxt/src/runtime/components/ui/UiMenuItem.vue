<script setup lang="ts">
import { computed } from 'vue'

import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import type { IconName } from '../../constants/icons.js'

import UiIcon from './UiIcon.vue'

/**
 * UiMenuItem — Excalidraw's dropdown-menu-item: a 32px row with a 16px
 * icon, a 14px label and the shortcut at half opacity on the right. With
 * `href` it is a link (opening a new tab for external URLs).
 */
const props = withDefaults(
  defineProps<{
    label: string
    icon?: IconName
    keys?: readonly string[]
    danger?: boolean
    disabled?: boolean
    /** Highlighted as the current choice. */
    selected?: boolean
    href?: string
  }>(),
  { icon: undefined, keys: undefined, danger: false, disabled: false, selected: false, href: undefined },
)

const emit = defineEmits<{ select: [] }>()

const keyDisplay = useKeyDisplay()
const shortcut = computed(() => (props.keys && props.keys.length > 0 ? keyDisplay.text(props.keys) : ''))
const external = computed(() => !!props.href && /^https?:/.test(props.href))
</script>

<template>
  <component
    :is="props.href ? 'a' : 'button'"
    :type="props.href ? undefined : 'button'"
    :href="props.href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    role="menuitem"
    class="ui-menu-item"
    :class="{ 'is-danger': props.danger, 'is-selected': props.selected }"
    :disabled="props.href ? undefined : props.disabled"
    :aria-disabled="props.disabled || undefined"
    @click="emit('select')"
  >
    <span class="ui-menu-item__icon">
      <UiIcon v-if="props.icon" :name="props.icon" :size="16" />
    </span>
    <span class="ui-menu-item__label">{{ props.label }}</span>
    <span v-if="shortcut" class="ui-menu-item__shortcut">{{ shortcut }}</span>
  </component>
</template>

<style scoped>
.ui-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: var(--od-radius-m);
  background: transparent;
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--od-fast) ease-out;
}

.ui-menu-item:hover {
  background: var(--od-hover);
}

.ui-menu-item:active {
  box-shadow: inset 0 0 0 1px var(--od-brand-active);
}

.ui-menu-item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px var(--od-accent);
  transition: none;
}

.ui-menu-item.is-selected {
  background: var(--od-accent-soft);
}

.ui-menu-item.is-danger {
  color: var(--od-danger);
}

.ui-menu-item.is-danger:hover {
  background: var(--od-danger-soft);
}

.ui-menu-item:disabled,
.ui-menu-item[aria-disabled='true'] {
  opacity: 0.5;
  pointer-events: none;
}

.ui-menu-item__icon {
  display: inline-flex;
  width: 16px;
}

.ui-menu-item__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-menu-item__shortcut {
  margin-inline-start: auto;
  padding-left: 12px;
  opacity: 0.5;
  font-size: 13px;
}
</style>
