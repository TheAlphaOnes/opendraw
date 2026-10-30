<script setup lang="ts">
import { computed } from 'vue'

import type { ActionId } from '../../actions/registry.js'
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
/* Five 40px buttons per line fill the 232px island exactly. */
.selection-actions__row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
</style>
