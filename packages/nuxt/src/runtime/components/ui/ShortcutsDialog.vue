<script setup lang="ts">
/**
 * ShortcutsDialog — the "?" keyboard shortcuts modal (Excalidraw help-dialog
 * parity). Owns its own window key listener: "?" toggles it, Escape and a
 * backdrop press close it. Entries are generated from the tool table and
 * the action registry — the same definitions the keyboard handler
 * dispatches — so the dialog can never advertise a shortcut that does
 * nothing.
 */
import { onBeforeUnmount, onMounted } from 'vue'

import { TOOLS, actionById, isTypingTarget, type ActionId } from '@opendraw/editor'
import { useHelpDialog } from '../../composables/useHelpDialog.js'
import UiIconButton from './UiIconButton.vue'
import UiKbd from './UiKbd.vue'

interface ShortcutEntry {
  /** What the shortcut does. */
  label: string
  /** Alternative combos, each one a key list, e.g. `[['Mod', 'Z']]`. */
  combos: readonly (readonly string[])[]
}

interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

function fromActions(ids: readonly ActionId[]): ShortcutEntry[] {
  return ids.flatMap((id) => {
    const action = actionById(id)
    return action.keys ? [{ label: action.label, combos: [action.keys] }] : []
  })
}

/** Pointer gestures and gesture-local keys the canvas handles itself. */
const GESTURES: ShortcutEntry[] = [
  { label: 'Pan the canvas', combos: [['Space', 'drag'], ['Wheel']] },
  { label: 'Zoom', combos: [['Mod', 'Wheel']] },
  { label: 'Pan horizontally', combos: [['Shift', 'Wheel']] },
]

const groups: ShortcutGroup[] = [
  {
    title: 'Tools',
    entries: TOOLS.map((def) => ({
      label: def.opensPicker ? `${def.name} (opens file picker)` : def.name,
      combos: def.keys.map((key) => [key.toUpperCase()]),
    })),
  },
  {
    title: 'View',
    entries: [
      ...GESTURES,
      ...fromActions([
        'zoomIn', 'zoomOut', 'resetZoom', 'zoomToFit', 'zoomToSelectionInViewport', 'zoomToSelection',
        'toggleGrid', 'toggleTheme',
      ]),
    ],
  },
  {
    title: 'Editor',
    entries: [
      ...fromActions([
        'undo', 'redo', 'cut', 'copy', 'paste', 'copyStyles', 'pasteStyles', 'selectAll',
        'duplicate', 'deleteSelection', 'toggleLock', 'toolLock',
      ]),
      { label: 'Duplicate while dragging', combos: [['Alt', 'drag']] },
      { label: 'Move selection', combos: [['←↑→↓']] },
      { label: 'Move selection (large step)', combos: [['Shift', '←↑→↓']] },
      { label: 'Finish line / Deselect / Exit group', combos: [['Esc']] },
      { label: 'Edit group members', combos: [['Double-click']] },
    ],
  },
  {
    title: 'Arrange',
    entries: fromActions([
      'group', 'ungroup', 'sendBackward', 'bringForward', 'sendToBack', 'bringToFront',
      'alignLeft', 'alignRight', 'alignTop', 'alignBottom', 'distributeHorizontally', 'distributeVertically',
      'flipHorizontal', 'flipVertical',
    ]),
  },
  {
    title: 'Text & files',
    entries: fromActions(['increaseFontSize', 'decreaseFontSize', 'saveToFile', 'openFile', 'clearCanvas']),
  },
]

const open = useHelpDialog()

function onKeydown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) {
    return
  }
  if (event.key === '?') {
    event.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value) {
    return
  }
  // A modal owns the keyboard: editor shortcuts must not act behind it
  // (Tab still moves focus within the dialog).
  if (event.key !== 'Tab') {
    event.stopPropagation()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
}

onMounted(() => {
  // Capture phase: the open dialog sees keys before the editor does.
  window.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div v-if="open" class="shortcuts">
    <div class="shortcuts__backdrop" @click="open = false" />
    <div
      class="shortcuts__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <header class="shortcuts__header">
        <h2 id="shortcuts-title" class="shortcuts__title">Keyboard shortcuts</h2>
        <UiIconButton icon="close" label="Close shortcuts dialog" @click="open = false" />
      </header>

      <div class="shortcuts__groups">
        <section
          v-for="group in groups"
          :key="group.title"
          class="shortcuts__group"
          :aria-label="group.title"
        >
          <h3 class="shortcuts__group-title">{{ group.title }}</h3>
          <ul class="shortcuts__list">
            <li v-for="entry in group.entries" :key="entry.label" class="shortcuts__entry">
              <span class="shortcuts__label">{{ entry.label }}</span>
              <span class="shortcuts__keys">
                <template v-for="(combo, index) in entry.combos" :key="index">
                  <span v-if="index > 0" class="shortcuts__or">or</span>
                  <UiKbd :keys="combo" />
                </template>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcuts {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.shortcuts__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(30, 30, 30, 0.32);
}

.shortcuts__dialog {
  position: relative;
  width: min(680px, 100%);
  max-height: min(80vh, 560px);
  overflow-y: auto;
  padding: 20px 24px 24px;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-l);
  background: var(--od-surface-raised);
  box-shadow: var(--od-shadow-2);
}

.shortcuts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.shortcuts__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--od-ink);
}

.shortcuts__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px 24px;
}

.shortcuts__group-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--od-ink-soft);
}

.shortcuts__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shortcuts__entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shortcuts__label {
  font-size: 13px;
  color: var(--od-ink);
}

.shortcuts__keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcuts__or {
  font-size: 11px;
  color: var(--od-ink-soft);
}
</style>
