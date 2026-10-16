<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Point } from '@vuedraw/core'

import { useVueDraw } from '../../composables/useVueDraw.js'
import UiIconButton from '../ui/UiIconButton.vue'
import UiPanel from '../ui/UiPanel.vue'

const ctx = useVueDraw()

const hasSelection = computed(() => ctx.selectedElements.value.length > 0)
const anyLocked = computed(() => ctx.selectedElements.value.some((el) => el.locked))
const gridActive = computed(() => ctx.gridSize.value !== null)
const isDark = computed(() => ctx.theme.value === 'dark')

// ---------------------------------------------------------------------------
// View — zoom anchors at this panel's own center, falling back to the
// window center (guarded for SSR).
// ---------------------------------------------------------------------------

const rootEl = ref<HTMLElement | null>(null)

function zoomAnchor(): Point {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }
  const rect = rootEl.value?.getBoundingClientRect()
  if (rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function toggleGrid(): void {
  ctx.setGridSize(ctx.gridSize.value !== null ? null : 20)
}

// ---------------------------------------------------------------------------
// File — PNG export, JSON download, JSON import through a hidden input.
// ---------------------------------------------------------------------------

function saveJSON(): void {
  if (typeof document === 'undefined') {
    return
  }
  const blob = new Blob([ctx.toJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'vuedraw.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)

async function onLoadChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }
  try {
    ctx.loadJSON(await file.text())
  } catch (error) {
    // A malformed file must not break the editor; surfaced for debugging.
    console.error('vuedraw: failed to load file', error)
  } finally {
    input.value = ''
  }
}

// ---------------------------------------------------------------------------
// Canvas — clear everything behind an explicit confirmation.
// ---------------------------------------------------------------------------

function clearCanvas(): void {
  if (typeof window === 'undefined' || ctx.elements.value.length === 0) {
    return
  }
  if (!window.confirm('Clear the canvas? This cannot be undone.')) {
    return
  }
  ctx.doc.deleteElements(ctx.elements.value.map((el) => el.id))
}
</script>

<template>
  <UiPanel position="right">
    <div ref="rootEl" class="actions-panel">
      <div class="actions-panel__group">
        <UiIconButton icon="undo" label="Undo (Ctrl+Z)" :disabled="!ctx.canUndo.value" @click="ctx.undo()" />
        <UiIconButton icon="redo" label="Redo (Ctrl+Shift+Z)" :disabled="!ctx.canRedo.value" @click="ctx.redo()" />
      </div>

      <div class="actions-panel__group">
        <UiIconButton icon="zoomIn" label="Zoom in" @click="ctx.zoomIn(zoomAnchor())" />
        <UiIconButton icon="zoomOut" label="Zoom out" @click="ctx.zoomOut(zoomAnchor())" />
        <UiIconButton icon="resetZoom" label="Reset zoom" @click="ctx.resetZoom()" />
        <UiIconButton icon="grid" label="Toggle grid" :active="gridActive" @click="toggleGrid" />
      </div>

      <div class="actions-panel__group">
        <UiIconButton
          :icon="isDark ? 'sun' : 'moon'"
          :label="isDark ? 'Light theme' : 'Dark theme'"
          @click="ctx.toggleTheme()"
        />
      </div>

      <div class="actions-panel__group">
        <UiIconButton icon="bringFront" label="Bring to front" :disabled="!hasSelection" @click="ctx.reorderSelection('front')" />
        <UiIconButton icon="bringForward" label="Bring forward" :disabled="!hasSelection" @click="ctx.reorderSelection('forward')" />
        <UiIconButton icon="sendBackward" label="Send backward" :disabled="!hasSelection" @click="ctx.reorderSelection('backward')" />
        <UiIconButton icon="sendBack" label="Send to back" :disabled="!hasSelection" @click="ctx.reorderSelection('back')" />
        <UiIconButton
          :icon="anyLocked ? 'unlock' : 'lock'"
          :label="anyLocked ? 'Unlock' : 'Lock'"
          :disabled="!hasSelection"
          @click="ctx.toggleSelectionLock()"
        />
        <UiIconButton icon="duplicate" label="Duplicate" :disabled="!hasSelection" @click="ctx.duplicateSelection()" />
      </div>

      <div class="actions-panel__group">
        <UiIconButton icon="copy" label="Copy" :disabled="!hasSelection" @click="ctx.copySelection()" />
        <UiIconButton icon="cut" label="Cut" :disabled="!hasSelection" @click="ctx.cutSelection()" />
        <UiIconButton icon="paste" label="Paste" :disabled="ctx.clipboardSize.value === 0" @click="ctx.paste()" />
        <UiIconButton icon="trash" label="Delete" danger :disabled="!hasSelection" @click="ctx.deleteSelection()" />
      </div>

      <div class="actions-panel__group">
        <UiIconButton icon="image" label="Export PNG" @click="ctx.exportPNG()" />
        <UiIconButton icon="save" label="Save as JSON" @click="saveJSON" />
        <UiIconButton icon="load" label="Load JSON file" @click="fileInput?.click()" />
      </div>

      <div class="actions-panel__group">
        <UiIconButton icon="clear" label="Clear canvas" danger @click="clearCanvas" />
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        class="actions-panel__file-input"
        @change="onLoadChange"
      />
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

.actions-panel__file-input {
  display: none;
}
</style>
