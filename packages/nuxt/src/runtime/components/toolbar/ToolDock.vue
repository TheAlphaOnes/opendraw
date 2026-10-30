<script setup lang="ts">
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import { TOOL_GROUPS, toolLabel, type ToolDefinition } from '../../constants/tools.js'
import UiIconButton from '../ui/UiIconButton.vue'
import UiPanel from '../ui/UiPanel.vue'

/**
 * The top-center tool island, in Excalidraw's order and grouping, led by
 * the tool lock (Q) exactly like Excalidraw's toolbar.
 */

const ctx = useOpenDraw()

function activate(entry: ToolDefinition): void {
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
      <div class="tool-dock__group">
        <UiIconButton
          icon="toolLock"
          label="Keep selected tool active after drawing (Q)"
          :active="ctx.toolLocked.value"
          @click="ctx.toggleToolLock()"
        />
      </div>
      <div v-for="(group, groupIndex) in TOOL_GROUPS" :key="groupIndex" class="tool-dock__group">
        <UiIconButton
          v-for="entry in group"
          :key="entry.tool"
          :icon="entry.icon"
          :label="toolLabel(entry)"
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
  border-left: 1px solid var(--od-border);
}

@media (max-width: 640px) {
  .tool-dock__group + .tool-dock__group {
    margin-left: 4px;
    padding-left: 4px;
  }
}
</style>
