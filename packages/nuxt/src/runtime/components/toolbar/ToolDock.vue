<script setup lang="ts">
import { computed } from 'vue'

import { TOOLS, toolKeyHint, toolLabel, type ToolDefinition } from '@opendraw/editor'

import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiDropdown from '../ui/UiDropdown.vue'
import UiIconButton from '../ui/UiIconButton.vue'
import UiMenuItem from '../ui/UiMenuItem.vue'
import ToolHint from './ToolHint.vue'

/**
 * The top-center toolbar — Excalidraw's shapes section: the tool lock, a
 * divider, every tool with its key hint, another divider and the "More
 * tools" dropdown (frame, laser). An extra tool in use takes over the
 * dropdown trigger's glyph, as in Excalidraw. The contextual hint sits
 * under the island.
 */
const ctx = useOpenDraw()

const mainTools = TOOLS.filter((def) => !def.more)
const moreTools = TOOLS.filter((def) => def.more)
const activeMore = computed(() => moreTools.find((def) => def.tool === ctx.activeTool.value) ?? null)

function activate(entry: ToolDefinition): void {
  if (entry.opensPicker) {
    ctx.openImagePicker()
    return
  }
  ctx.setActiveTool(entry.tool)
}
</script>

<template>
  <div class="tool-dock-stack">
    <div class="tool-dock" role="toolbar" aria-label="Drawing tools">
      <UiIconButton
        size="lg"
        :icon="ctx.toolLocked.value ? 'lock' : 'unlock'"
        label="Keep selected tool active after drawing (Q)"
        :active="ctx.toolLocked.value"
        @click="ctx.toggleToolLock()"
      />
      <span class="tool-dock__divider" aria-hidden="true" />
      <UiIconButton
        v-for="entry in mainTools"
        :key="entry.tool"
        size="lg"
        :icon="entry.icon"
        :label="toolLabel(entry)"
        :keybinding="toolKeyHint(entry)"
        :active="!entry.opensPicker && ctx.activeTool.value === entry.tool"
        @click="activate(entry)"
      />
      <span class="tool-dock__divider" aria-hidden="true" />
      <UiDropdown label="More tools" align="center" :width="200">
        <template #trigger="{ toggle, open }">
          <UiIconButton
            size="lg"
            :icon="activeMore?.icon ?? 'moreTools'"
            label="More tools"
            :active="open || activeMore !== null"
            @click="toggle"
          />
        </template>
        <template #default="{ close }">
          <UiMenuItem
            v-for="entry in moreTools"
            :key="entry.tool"
            :icon="entry.icon"
            :label="entry.name"
            :keys="[entry.keys[0]!.toUpperCase()]"
            :selected="ctx.activeTool.value === entry.tool"
            @select="() => { activate(entry); close() }"
          />
        </template>
      </UiDropdown>
    </div>
    <ToolHint />
  </div>
</template>

<style scoped>
.tool-dock-stack {
  position: absolute;
  z-index: 10;
  top: var(--od-gutter);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-inline: auto;
  width: fit-content;
  max-width: calc(100% - 2 * var(--od-gutter));
  pointer-events: none;
}

/* Excalidraw's toolbar island: 4px padding, 4px between tools. */
.tool-dock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  background: var(--od-surface);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  pointer-events: auto;
  animation: tool-dock-in 260ms var(--od-ease) both;
}

@keyframes tool-dock-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.tool-dock__divider {
  align-self: stretch;
  width: 1px;
  margin: 6px 2px;
  background: var(--od-divider);
}

@media (max-width: 640px) {
  .tool-dock {
    gap: 2px;
  }
}
</style>
