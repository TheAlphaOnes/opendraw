<script setup lang="ts">
import { computed } from 'vue'

import type { ActionId } from '../../actions/registry.js'
import { useVueDraw } from '../../composables/useVueDraw.js'
import UiPanel from '../ui/UiPanel.vue'
import ActionButton from './ActionButton.vue'

/**
 * The right-hand action island: history, clipboard, view and file
 * commands. Selection-specific commands (layers, align, element actions)
 * live in the properties island, as in Excalidraw.
 */
const ctx = useVueDraw()

const isDark = computed(() => ctx.theme.value === 'dark')

interface PanelSection {
  key: string
  actions: readonly ActionId[]
}

const sections = computed<PanelSection[]>(() => [
  { key: 'history', actions: ['undo', 'redo'] },
  { key: 'clipboard', actions: ['copy', 'cut', 'paste', 'deleteSelection'] },
  { key: 'view', actions: ['toggleGrid', 'toggleTheme', 'zoomToFit'] },
  { key: 'file', actions: ['exportPNG', 'exportSVG', 'saveToFile', 'openFile'] },
  { key: 'reset', actions: ['clearCanvas'] },
])

/** Per-action state the registry cannot know: toggles and swapped glyphs. */
function presentation(id: ActionId): { active?: boolean; icon?: 'sun' | 'moon'; label?: string } {
  if (id === 'toggleGrid') {
    return { active: ctx.gridSize.value !== null }
  }
  if (id === 'toggleTheme') {
    return { icon: isDark.value ? 'sun' : 'moon', label: isDark.value ? 'Light theme' : 'Dark theme' }
  }
  return {}
}
</script>

<template>
  <UiPanel position="right">
    <div class="actions-panel" role="toolbar" aria-orientation="vertical" aria-label="Editor actions">
      <div v-for="section in sections" :key="section.key" class="actions-panel__group">
        <ActionButton
          v-for="id in section.actions"
          :key="id"
          :action="id"
          v-bind="presentation(id)"
        />
      </div>
    </div>
  </UiPanel>
</template>

<style scoped>
.actions-panel {
  display: flex;
  flex-direction: column;
}

.actions-panel__group {
  display: grid;
  grid-template-columns: repeat(2, 40px);
  gap: 4px;
  justify-content: center;
}

/* Lone buttons in a group span both tracks and stay centered. */
.actions-panel__group > button:only-child {
  grid-column: 1 / -1;
  justify-self: center;
}

/* Hairline divider between action groups. */
.actions-panel__group + .actions-panel__group {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--vd-border);
}
</style>
