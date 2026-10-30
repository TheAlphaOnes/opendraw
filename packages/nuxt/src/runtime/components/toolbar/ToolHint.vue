<script setup lang="ts">
import { computed } from 'vue'

import { isTextContainer } from '@opendraw/core'

import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'

/**
 * The hint line under the toolbar — Excalidraw's HintViewer, with its
 * copy (locales/en.json "hints"). Only hints for behavior opendraw has are
 * listed; a hint never advertises a gesture that does nothing.
 */
const ctx = useOpenDraw()
const keys = useKeyDisplay()

const hint = computed<string | null>(() => {
  if (ctx.editingId.value !== null) {
    return `Press Escape or ${keys.text(['Mod', 'Enter'])} to finish editing`
  }
  switch (ctx.activeTool.value) {
    case 'arrow':
    case 'line':
      return 'Click to start multiple points, drag for single line'
    case 'freedraw':
      return "Click and drag, release when you're finished"
    case 'text':
      return 'Tip: you can also add text by double-clicking anywhere with the selection tool'
    case 'stickynote':
      return 'Click to place a note, or drag to size it'
    case 'hand':
      return 'To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool'
    case 'selection': {
      const selected = ctx.selectedElements.value
      const only = selected.length === 1 ? selected[0]! : null
      if (only?.type === 'text') {
        return 'Double-click or press Enter to edit text'
      }
      if (only && isTextContainer(only) && !only.locked) {
        return 'Press Enter to add text'
      }
      return null
    }
    default:
      return null
  }
})
</script>

<template>
  <Transition name="tool-hint" mode="out-in">
    <p v-if="hint" :key="hint" class="tool-hint">{{ hint }}</p>
  </Transition>
</template>

<style scoped>
.tool-hint {
  margin: 0;
  padding: 0 8px;
  max-width: 100%;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  color: var(--od-ink-soft);
  pointer-events: none;
  user-select: none;
}

.tool-hint-enter-active {
  transition:
    opacity 180ms ease-out,
    transform 220ms var(--od-ease);
}

.tool-hint-leave-active {
  transition: opacity 90ms ease-in;
}

.tool-hint-enter-from {
  opacity: 0;
  transform: translateY(-2px);
}

.tool-hint-leave-to {
  opacity: 0;
}
</style>
