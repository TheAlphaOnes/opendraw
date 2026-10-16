<script setup lang="ts">
import type { ToolId } from '@vuedraw/core'

import { useVueDraw } from '../../composables/useVueDraw.js'
import type { IconName } from '../../constants/icons.js'
import UiIconButton from '../ui/UiIconButton.vue'
import UiPanel from '../ui/UiPanel.vue'

interface DockTool {
  tool: ToolId
  icon: IconName
  label: string
}

/** Tools in dock order, split into visual groups. */
const TOOL_GROUPS: DockTool[][] = [
  [
    { tool: 'selection', icon: 'selection', label: 'Selection (1)' },
    { tool: 'hand', icon: 'hand', label: 'Hand (H)' },
  ],
  [
    { tool: 'rectangle', icon: 'rectangle', label: 'Rectangle (2)' },
    { tool: 'diamond', icon: 'diamond', label: 'Diamond (3)' },
    { tool: 'ellipse', icon: 'ellipse', label: 'Ellipse (4)' },
    { tool: 'arrow', icon: 'arrow', label: 'Arrow (5)' },
    { tool: 'line', icon: 'line', label: 'Line (6)' },
  ],
  [
    { tool: 'freedraw', icon: 'freedraw', label: 'Freedraw (P)' },
    { tool: 'text', icon: 'text', label: 'Text (T)' },
    { tool: 'eraser', icon: 'eraser', label: 'Eraser (E)' },
  ],
]

const ctx = useVueDraw()
</script>

<template>
  <UiPanel position="left">
    <div class="tool-dock">
      <div v-for="(group, groupIndex) in TOOL_GROUPS" :key="groupIndex" class="tool-dock__group">
        <UiIconButton
          v-for="entry in group"
          :key="entry.tool"
          :icon="entry.icon"
          :label="entry.label"
          :active="ctx.activeTool.value === entry.tool"
          @click="ctx.setActiveTool(entry.tool)"
        />
      </div>
    </div>
  </UiPanel>
</template>

<style scoped>
.tool-dock {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-dock__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* The visual divider: an extra 4px of air between tool groups. */
.tool-dock__group + .tool-dock__group {
  margin-top: 4px;
}
</style>
