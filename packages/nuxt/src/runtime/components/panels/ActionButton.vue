<script setup lang="ts">
import { computed } from 'vue'

import { formatKeys } from '../../actions/keys.js'
import { actionById, isActionEnabled, runAction, type ActionId } from '../../actions/registry.js'
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
  }>(),
  { icon: undefined, label: undefined, active: false },
)

const ctx = useOpenDraw()
const definition = computed(() => actionById(props.action))

const accessibleName = computed(() => {
  const base = props.label ?? definition.value.label
  const keys = definition.value.keys
  if (!keys) {
    return base
  }
  const display = formatKeys(keys)
  return `${base} (${display.join(display.some((key) => key.length > 1) ? '+' : '')})`
})

const enabled = computed(() => {
  // Track document revisions: predicates read plain document state.
  void ctx.state.value.rev
  return isActionEnabled(ctx, props.action)
})
</script>

<template>
  <UiIconButton
    :icon="props.icon ?? definition.icon ?? 'shortcuts'"
    :label="accessibleName"
    :active="props.active"
    :disabled="!enabled"
    :danger="definition.danger"
    @click="runAction(ctx, props.action)"
  />
</template>
