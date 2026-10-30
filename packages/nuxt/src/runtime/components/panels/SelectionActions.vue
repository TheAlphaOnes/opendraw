<script setup lang="ts">
import { computed } from 'vue'

import type { ActionId } from '@opendrawjs/editor'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import ActionButton from './ActionButton.vue'
import StyleSection from './StyleSection.vue'

/**
 * The selection-only tail of the properties island — Excalidraw's
 * "Layers", "Align" and "Actions" rows. Align appears from two selected
 * elements, distribute from three.
 */
const ctx = useOpenDraw()
const count = computed(() => ctx.selectedElements.value.length)
const anyLocked = computed(() => ctx.selectedElements.value.some((el) => el.locked))

const LAYERS: readonly ActionId[] = ['sendToBack', 'sendBackward', 'bringForward', 'bringToFront']
const ALIGN: readonly ActionId[] = [
  'alignLeft', 'alignHorizontalCenter', 'alignRight',
  'alignTop', 'alignVerticalCenter', 'alignBottom',
]
const DISTRIBUTE: readonly ActionId[] = ['distributeHorizontally', 'distributeVertically']
const ACTIONS: readonly ActionId[] = ['duplicate', 'deleteSelection', 'group', 'ungroup', 'flipHorizontal', 'flipVertical', 'toggleLock']
</script>

<template>
  <StyleSection label="Layers">
    <div class="selection-actions__row">
      <ActionButton v-for="id in LAYERS" :key="id" :action="id" />
    </div>
  </StyleSection>
  <StyleSection v-if="count > 1" label="Align">
    <div class="selection-actions__row">
      <ActionButton v-for="id in ALIGN" :key="id" :action="id" />
      <template v-if="count > 2">
        <ActionButton v-for="id in DISTRIBUTE" :key="id" :action="id" />
      </template>
    </div>
  </StyleSection>
  <StyleSection label="Actions">
    <div class="selection-actions__row">
      <template v-for="id in ACTIONS" :key="id">
        <ActionButton
          v-if="id === 'toggleLock'"
          :action="id"
          :icon="anyLocked ? 'unlock' : 'lock'"
          :label="anyLocked ? 'Unlock' : 'Lock'"
        />
        <ActionButton v-else :action="id" />
      </template>
    </div>
  </StyleSection>
</template>

<style scoped>
/* Excalidraw's buttonList: 32px outline buttons, 8px apart. */
.selection-actions__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selection-actions__row :deep(.ui-icon-button) {
  border: 1px solid var(--od-border);
}
</style>
