<script setup lang="ts">
/**
 * ShortcutsDialog — the "?" keyboard shortcuts modal (Excalidraw help-dialog
 * parity). Owns its own window key listener: "?" toggles it, Escape and a
 * backdrop press close it. The list is generated from the shortcuts the
 * canvas actually implements (VueDrawCanvas), never from Excalidraw's full
 * set, so the dialog can never advertise a shortcut that does nothing.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import UiIconButton from './UiIconButton.vue'

interface ShortcutEntry {
  /** What the shortcut does. */
  label: string
  /** Keys as shown, e.g. `['Ctrl', 'Z']`. */
  keys: string[]
}

interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

// Mirrors `onKeyDown` / wheel handling in VueDrawCanvas.vue. Update both
// together: this dialog is the user-facing contract for that handler.
const groups: ShortcutGroup[] = [
  {
    title: 'Tools',
    entries: [
      { label: 'Selection', keys: ['1'] },
      { label: 'Hand', keys: ['H'] },
      { label: 'Rectangle', keys: ['2'] },
      { label: 'Diamond', keys: ['3'] },
      { label: 'Ellipse', keys: ['4'] },
      { label: 'Arrow', keys: ['5'] },
      { label: 'Line', keys: ['6'] },
      { label: 'Freedraw', keys: ['P'] },
      { label: 'Text', keys: ['T'] },
      { label: 'Image (opens file picker)', keys: ['9'] },
      { label: 'Eraser', keys: ['E'] },
      { label: 'Frame', keys: ['F'] },
      { label: 'Laser pointer', keys: ['K'] },
    ],
  },
  {
    title: 'View',
    entries: [
      { label: 'Pan the canvas', keys: ['Space', 'drag'] },
      { label: 'Zoom', keys: ['Ctrl / ⌘', 'scroll'] },
      { label: 'Pan horizontally', keys: ['Shift', 'scroll'] },
    ],
  },
  {
    title: 'Editing',
    entries: [
      { label: 'Undo', keys: ['Ctrl / ⌘', 'Z'] },
      { label: 'Redo', keys: ['Ctrl / ⌘', 'Shift', 'Z'] },
      { label: 'Select all', keys: ['Ctrl / ⌘', 'A'] },
      { label: 'Duplicate', keys: ['Ctrl / ⌘', 'D'] },
      { label: 'Cut', keys: ['Ctrl / ⌘', 'X'] },
      { label: 'Copy', keys: ['Ctrl / ⌘', 'C'] },
      { label: 'Paste', keys: ['Ctrl / ⌘', 'V'] },
      { label: 'Delete selection', keys: ['Del'] },
      { label: 'Move selection', keys: ['arrows'] },
      { label: 'Move selection (large step)', keys: ['Shift', 'arrows'] },
      { label: 'Bring forward', keys: [']'] },
      { label: 'Send backward', keys: ['['] },
      { label: 'Deselect', keys: ['Esc'] },
    ],
  },
]

const open = ref(false)

/** Typing contexts own their keys — "?" in the text editor must stay literal. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement
    && (target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable)
  )
}

function onKeydown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) {
    return
  }
  if (event.key === '?') {
    event.preventDefault()
    open.value = !open.value
    return
  }
  if (open.value && event.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
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
                <kbd v-for="key in entry.keys" :key="key" class="shortcuts__key">{{ key }}</kbd>
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
  border: 1px solid var(--vd-border);
  border-radius: var(--vd-radius-l);
  background: var(--vd-surface-raised);
  box-shadow: var(--vd-shadow-2);
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
  color: var(--vd-ink);
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
  color: var(--vd-ink-soft);
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
  color: var(--vd-ink);
}

.shortcuts__keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcuts__key {
  min-width: 20px;
  padding: 2px 6px;
  border: 1px solid var(--vd-border);
  border-radius: var(--vd-radius-s);
  background: var(--vd-surface);
  font: 500 11px/1.4 inherit;
  text-align: center;
  color: var(--vd-ink);
}
</style>
