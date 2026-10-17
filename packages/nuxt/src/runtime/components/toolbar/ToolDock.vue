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
  /**
   * True for the image tool: its button is an insertion gesture that opens
   * the file picker, so it never shows a persistent active state.
   */
  opensPicker?: boolean
}

/**
 * Tools in Excalidraw's island order: hand + selection, then the shape
 * group, then freedraw/text/image/eraser, then frame and laser — grouped by
 * dividers exactly like Excalidraw's top-center toolbar.
 */
const TOOL_GROUPS: DockTool[][] = [
  [
    { tool: 'hand', icon: 'hand', label: 'Hand (H)' },
    { tool: 'selection', icon: 'selection', label: 'Selection (1)' },
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
    { tool: 'image', icon: 'imageTool', label: 'Image (9)', opensPicker: true },
    { tool: 'eraser', icon: 'eraser', label: 'Eraser (E)' },
  ],
  [
    { tool: 'frame', icon: 'frameTool', label: 'Frame (F)' },
    { tool: 'laser', icon: 'laserTool', label: 'Laser (K)' },
  ],
]

const ctx = useVueDraw()

function activate(entry: DockTool): void {
  if (entry.opensPicker) {
    ctx.openImagePicker()
    return
  }
  ctx.setActiveTool(entry.tool)
}
</script>

<template>
  <UiPanel position="top-center" role="toolbar" aria-label="Drawing tools">
    <div class="tool-dock">
      <div v-for="(group, groupIndex) in TOOL_GROUPS" :key="groupIndex" class="tool-dock__group">
        <UiIconButton
          v-for="entry in group"
          :key="entry.tool"
          :icon="entry.icon"
          :label="entry.label"
          :active="!entry.opensPicker && ctx.activeTool.value === entry.tool"
          @click="activate(entry)"
        />
      </div>
    </div>
  </UiPanel>
</template>

<style scoped>
.tool-dock {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  /* Narrow viewports wrap instead of overflowing the island. */
  flex-wrap: wrap;
  justify-content: center;
  max-width: calc(100vw - 32px);
}

.tool-dock__group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

/* The visual divider: extra air between tool groups. */
.tool-dock__group + .tool-dock__group {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--vd-border);
}

@media (max-width: 640px) {
  .tool-dock__group + .tool-dock__group {
    margin-left: 4px;
    padding-left: 4px;
  }
}
</style>
