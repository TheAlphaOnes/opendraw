<script setup lang="ts">
import { computed } from 'vue'

import { TOOLS, toolKeyHint, toolLabel, type ToolDefinition } from '@opendraw/editor'

import { useMediaQuery } from '../../composables/useMediaQuery.js'
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
 *
 * Phones (Excalidraw's mobile toolbar): the bar must fit without
 * scrolling, so it keeps the core tools and moves the tool lock, diamond,
 * sticky note and image — and the line on the narrowest screens — into
 * "More tools".
 */
const ctx = useOpenDraw()

const phone = useMediaQuery('(max-width: 640px)')
const narrow = useMediaQuery('(max-width: 360px)')

/** Tools that live in "More tools" on phones. */
const PHONE_MORE = new Set(['diamond', 'stickynote', 'image'])

function inMoreMenu(def: ToolDefinition): boolean {
  return !!def.more || (phone.value && PHONE_MORE.has(def.tool)) || (narrow.value && def.tool === 'line')
}

const mainTools = computed(() => TOOLS.filter((def) => !inMoreMenu(def)))
const moreTools = computed(() => TOOLS.filter(inMoreMenu))
const activeMore = computed(() => moreTools.value.find((def) => def.tool === ctx.activeTool.value && !def.opensPicker) ?? null)

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
      <template v-if="!phone">
        <UiIconButton
          size="lg"
          :icon="ctx.toolLocked.value ? 'lock' : 'unlock'"
          label="Keep selected tool active after drawing (Q)"
          :active="ctx.toolLocked.value"
          @click="ctx.toggleToolLock()"
        />
        <span class="tool-dock__divider" aria-hidden="true" />
      </template>
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
            :selected="!entry.opensPicker && ctx.activeTool.value === entry.tool"
            @select="() => { activate(entry); close() }"
          />
          <UiMenuItem
            v-if="phone"
            :icon="ctx.toolLocked.value ? 'lock' : 'unlock'"
            label="Keep tool active"
            :keys="['Q']"
            :selected="ctx.toolLocked.value"
            @select="() => { ctx.toggleToolLock(); close() }"
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

/* The toolbar island: 36px tools in 2px of padding — the shared 40px bar. */
.tool-dock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: var(--od-bar);
  padding: 2px;
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

/* Phones (Excalidraw's mobile layout): the toolbar becomes the bottom bar —
   one row that scrolls sideways, no key hints, no hint line. */
@media (max-width: 640px) {
  .tool-dock-stack {
    top: auto;
    bottom: var(--od-gutter);
    width: auto;
    left: var(--od-gutter);
    right: var(--od-gutter);
    max-width: none;
  }

  /* Sized to fit: 32px tools, no gaps, no sideways scrolling. */
  .tool-dock {
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .tool-dock > * {
    flex-shrink: 0;
  }

  .tool-dock :deep(.ui-icon-button--lg) {
    width: var(--od-button);
    height: var(--od-button);
  }

  .tool-dock {
    padding: 4px;
  }

  .tool-dock :deep(.ui-icon-button__key) {
    display: none;
  }

  .tool-dock-stack :deep(.tool-hint) {
    display: none;
  }
}

/* The narrowest phones need the divider's few pixels for the tools. */
@media (max-width: 360px) {
  .tool-dock__divider {
    display: none;
  }
}
</style>
