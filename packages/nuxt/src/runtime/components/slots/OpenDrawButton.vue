<script setup lang="ts">
import { computed, getCurrentInstance, type Component } from 'vue'

import type { IconName } from '../../constants/icons.js'
import UiIcon from '../ui/UiIcon.vue'

/**
 * OpenDrawButton — a ready-made button for <OpenDraw>'s `top-right` and
 * `footer` slots, styled like Excalidraw's on-canvas buttons:
 *
 *   <template #top-right>
 *     <OpenDrawButton icon="docs" label="Docs" to="/docs" />
 *     <OpenDrawButton icon="share" label="Share" variant="primary" @click="share" />
 *   </template>
 *
 * `to` navigates inside the app (NuxtLink in Nuxt, a plain link in a bare
 * Vue app), `href` links out (new tab for external URLs); otherwise it is
 * a button. With an icon, phones show the
 * icon alone so the top row stays clear.
 */
const props = withDefaults(
  defineProps<{
    label: string
    icon?: IconName
    /** filled: on-canvas grey (Excalidraw's Library) · primary: accent (Share) · ghost: no fill. */
    variant?: 'filled' | 'primary' | 'ghost'
    /** An in-app route, rendered with NuxtLink. */
    to?: string
    /** A URL; external ones open in a new tab. */
    href?: string
    /** Show only the icon (the label stays the accessible name). */
    iconOnly?: boolean
    disabled?: boolean
  }>(),
  { icon: undefined, variant: 'filled', to: undefined, href: undefined, iconOnly: false, disabled: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

// NuxtLink when the app has it (Nuxt registers it globally); plain Vue apps
// get an ordinary anchor for `to`.
const NuxtLink = getCurrentInstance()?.appContext.components.NuxtLink as Component | undefined
const external = computed(() => !!props.href && /^https?:/.test(props.href))
const tag = computed(() => (props.to ? (NuxtLink ?? 'a') : props.href ? 'a' : 'button'))
const linkAttrs = computed(() =>
  props.to
    ? NuxtLink
      ? { to: props.to }
      : { href: props.to }
    : props.href
      ? { href: props.href, target: external.value ? '_blank' : undefined, rel: external.value ? 'noopener noreferrer' : undefined }
      : { type: 'button', disabled: props.disabled },
)
</script>

<template>
  <component
    :is="tag"
    v-bind="linkAttrs"
    class="od-slot-button"
    :class="[`od-slot-button--${props.variant}`, { 'is-icon-only': props.iconOnly, 'has-icon': !!props.icon }]"
    :aria-label="props.label"
    :title="props.label"
    @click="emit('click', $event)"
  >
    <UiIcon v-if="props.icon" :name="props.icon" :size="16" />
    <span class="od-slot-button__label">{{ props.label }}</span>
    <UiIcon v-if="external && !props.iconOnly" name="externalLink" :size="12" class="od-slot-button__external" />
  </component>
</template>

<style scoped>
.od-slot-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--od-bar, 40px);
  min-width: var(--od-bar, 40px);
  padding: 0 12px;
  border: none;
  border-radius: var(--od-radius-l, 8px);
  font: inherit;
  font-size: 14px;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--od-fast, 120ms) ease-out,
    box-shadow var(--od-fast, 120ms) ease-out,
    transform 90ms var(--od-ease);
  animation: od-slot-in 300ms var(--od-ease) both;
}

/* The same island as every other on-canvas control. */
.od-slot-button--filled {
  background: var(--od-surface);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  color: var(--od-ink);
}

.od-slot-button--filled:hover {
  background: var(--od-hover);
}

.od-slot-button--primary {
  background: var(--od-accent);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  color: #fff;
}

.od-slot-button--primary:hover {
  background: var(--od-brand-active);
}

.od-slot-button--ghost {
  background: transparent;
  color: var(--od-ink);
}

.od-slot-button--ghost:hover {
  background: var(--od-hover);
}

.od-slot-button:active {
  transform: scale(0.96);
}

.od-slot-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}

.od-slot-button[disabled] {
  opacity: 0.4;
  pointer-events: none;
}

.od-slot-button.is-icon-only {
  padding: 0;
}

.od-slot-button.is-icon-only .od-slot-button__label {
  display: none;
}

.od-slot-button__external {
  opacity: 0.6;
}

/* Phones: icon-only, so the top row never crowds the menu. */
@media (max-width: 640px) {
  .od-slot-button.has-icon {
    padding: 0;
  }

  .od-slot-button.has-icon .od-slot-button__label,
  .od-slot-button.has-icon .od-slot-button__external {
    display: none;
  }
}

@keyframes od-slot-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .od-slot-button {
    animation: none;
  }
}
</style>
