<script setup lang="ts">
import { computed } from 'vue'

import { actionById, isActionEnabled, runAction, type ActionId } from '@opendrawjs/editor'

import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import type { IconName } from '../../constants/icons.js'
import UiIconButton from '../ui/UiIconButton.vue'

/**
 * An icon button bound to a registry action: its label and shortcut become
 * the accessible name and tooltip ("Undo (⌘Z)"), its predicate drives the
 * disabled state, and a click runs it — one definition, every surface.
 */
const props = withDefaults(
  defineProps<{
    action: ActionId
    /** Overrides the action's own icon (state-dependent glyphs). */
    icon?: IconName
    /** Overrides the action's label (state-dependent wording). */
    label?: string
    active?: boolean
    size?: 'md' | 'lg'
  }>(),
  { icon: undefined, label: undefined, active: false, size: 'md' },
)

const ctx = useOpenDraw()
const keys = useKeyDisplay()
const definition = computed(() => actionById(props.action))

const accessibleName = computed(() => {
  const base = props.label ?? definition.value.label
  const shortcut = definition.value.keys
  if (!shortcut) {
    return base
  }
  return `${base} (${keys.text(shortcut)})`
})

const enabled = computed(() => {
  // Track every change: predicates read the plain controller state.
  void ctx.revision.value
  return isActionEnabled(ctx.editor, props.action)
})
</script>

<template>
  <UiIconButton
    :icon="props.icon ?? definition.icon ?? 'shortcuts'"
    :label="accessibleName"
    :active="props.active"
    :disabled="!enabled"
    :danger="definition.danger"
    :size="props.size"
    @click="runAction(ctx.editor, props.action)"
  />
</template>
