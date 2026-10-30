<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { DrawingFile } from '@opendraw/editor'

import { formatEditedAgo } from '../../utils/relativeTime.js'
import UiDropdown from '../ui/UiDropdown.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiIconButton from '../ui/UiIconButton.vue'
import UiMenuItem from '../ui/UiMenuItem.vue'
import UiMenuSeparator from '../ui/UiMenuSeparator.vue'

/**
 * One drawing in the files sidebar: its preview, name and last edit, with
 * rename, duplicate and delete. Presentational — every change is an event;
 * the only state here is which inline mode the row is in (renaming, or
 * asking before a delete). F2 renames and Delete asks, as in a file list.
 */
const props = defineProps<{
  file: DrawingFile
  active: boolean
  thumbnail: string | null
  /** The clock the captions count from (ticked by the list). */
  now: number
}>()

const emit = defineEmits<{
  open: []
  rename: [name: string]
  duplicate: []
  delete: []
}>()

type Mode = 'idle' | 'renaming' | 'confirming'
const mode = ref<Mode>('idle')
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const rowRef = ref<HTMLElement | null>(null)

const caption = computed(() => {
  const count = props.file.elementCount
  const content = count === 0 ? 'Empty' : `${count} ${count === 1 ? 'element' : 'elements'}`
  return `${formatEditedAgo(props.file.updatedAt, props.now)} · ${content}`
})

async function startRename(): Promise<void> {
  draft.value = props.file.name
  mode.value = 'renaming'
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

/** Enter or leaving the field saves; Escape restores the old name. */
function finishRename(save: boolean): void {
  if (mode.value !== 'renaming') {
    return
  }
  mode.value = 'idle'
  if (save && draft.value.trim() !== '') {
    emit('rename', draft.value)
  }
  void nextTick(() => rowRef.value?.querySelector<HTMLElement>('.file-item__open')?.focus())
}

function onRenameKey(event: KeyboardEvent): void {
  // Typing a name never reaches the canvas shortcuts or closes the sidebar.
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    finishRename(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    finishRename(false)
  }
}

async function askDelete(): Promise<void> {
  mode.value = 'confirming'
  await nextTick()
  rowRef.value?.querySelector<HTMLElement>('.file-item__confirm-cancel')?.focus()
}

function cancelDelete(): void {
  mode.value = 'idle'
  void nextTick(() => rowRef.value?.querySelector<HTMLElement>('.file-item__open')?.focus())
}

function onRowKey(event: KeyboardEvent): void {
  if (mode.value !== 'idle') {
    if (mode.value === 'confirming' && event.key === 'Escape') {
      event.stopPropagation()
      cancelDelete()
    }
    return
  }
  if (event.key === 'F2') {
    event.preventDefault()
    void startRename()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    event.stopPropagation()
    void askDelete()
  }
}

function pick(action: 'rename' | 'duplicate' | 'delete', close: () => void): void {
  close()
  if (action === 'rename') {
    void startRename()
  } else if (action === 'duplicate') {
    emit('duplicate')
  } else {
    void askDelete()
  }
}
</script>

<template>
  <li
    ref="rowRef"
    class="file-item"
    :class="{ 'is-active': props.active, [`is-${mode}`]: mode !== 'idle' }"
    @keydown="onRowKey"
  >
    <div class="file-item__body">
      <span class="file-item__thumb" aria-hidden="true">
        <img v-if="props.thumbnail" :src="props.thumbnail" alt="" class="file-item__image" draggable="false" />
        <UiIcon v-else name="drawing" :size="20" class="file-item__placeholder" />
      </span>

      <div v-if="mode === 'renaming'" class="file-item__text">
        <label class="file-item__sr" :for="`rename-${props.file.id}`">Drawing name</label>
        <input
          :id="`rename-${props.file.id}`"
          ref="inputRef"
          v-model="draft"
          class="file-item__input"
          type="text"
          maxlength="80"
          autocomplete="off"
          spellcheck="false"
          @keydown="onRenameKey"
          @blur="finishRename(true)"
        />
        <span class="file-item__meta">Enter to save · Esc to cancel</span>
      </div>
      <button
        v-else
        type="button"
        class="file-item__open"
        :aria-current="props.active ? 'true' : undefined"
        :aria-label="`${props.file.name}${props.active ? ' (open)' : ''}, ${caption}`"
        @click="emit('open')"
      >
        <span class="file-item__text">
          <span class="file-item__name">{{ props.file.name }}</span>
          <span class="file-item__meta">{{ caption }}</span>
        </span>
      </button>

      <UiDropdown v-if="mode === 'idle'" :label="`Actions for ${props.file.name}`" align="end" :width="180">
        <template #trigger="{ toggle, open }">
          <span class="file-item__more" :class="{ 'is-open': open }">
            <UiIconButton icon="moreActions" :label="`Actions for ${props.file.name}`" :active="open" @click="toggle" />
          </span>
        </template>
        <template #default="{ close }">
          <UiMenuItem icon="rename" label="Rename" :keys="['F2']" @select="pick('rename', close)" />
          <UiMenuItem icon="duplicate" label="Duplicate" @select="pick('duplicate', close)" />
          <UiMenuSeparator />
          <UiMenuItem icon="trash" label="Delete" danger @select="pick('delete', close)" />
        </template>
      </UiDropdown>
    </div>

    <Transition name="file-item-confirm">
      <div v-if="mode === 'confirming'" class="file-item__confirm" role="alertdialog" :aria-label="`Delete ${props.file.name}?`">
        <span class="file-item__confirm-text">Delete this drawing? This can’t be undone.</span>
        <div class="file-item__confirm-actions">
          <button type="button" class="file-item__confirm-cancel" @click="cancelDelete">Cancel</button>
          <button type="button" class="file-item__confirm-delete" @click="emit('delete')">Delete</button>
        </div>
      </div>
    </Transition>
  </li>
</template>

<style scoped>
.file-item {
  position: relative;
  list-style: none;
  border-radius: var(--od-radius-l);
  transition: background-color var(--od-fast) ease-out;
}

.file-item:hover,
.file-item:focus-within {
  background: var(--od-hover);
}

.file-item.is-active {
  background: var(--od-surface-high);
}

/* The open drawing carries the accent on its edge. */
.file-item::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--od-accent);
  transform: scaleY(0);
  transition: transform 260ms var(--od-ease);
}

.file-item.is-active::before {
  transform: scaleY(1);
}

.file-item__body {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 6px 6px 8px;
}

.file-item__thumb {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 40px;
  overflow: hidden;
  border: 1px solid var(--od-divider);
  border-radius: var(--od-radius-m);
  background: var(--od-surface);
}

.file-item__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: file-item-fade 240ms ease-out both;
}

.file-item__placeholder {
  color: var(--od-keybinding);
}

.file-item__open {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  align-self: stretch;
  padding: 0 0 0 8px;
  border: none;
  border-radius: var(--od-radius-m);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.file-item__open:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}

.file-item__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.file-item.is-renaming .file-item__text {
  padding-left: 8px;
}

.file-item__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--od-ink);
}

.file-item__meta {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--od-ink-soft);
}

.file-item__input {
  width: 100%;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--od-accent);
  border-radius: var(--od-radius-s);
  outline: none;
  background: var(--od-surface);
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}

/* The menu button stays out of the way until the row is engaged. */
.file-item__more {
  display: inline-flex;
  opacity: 0;
  transition: opacity var(--od-fast) ease-out;
}

.file-item:hover .file-item__more,
.file-item:focus-within .file-item__more,
.file-item.is-active .file-item__more,
.file-item__more.is-open {
  opacity: 1;
}

@media (hover: none) {
  .file-item__more {
    opacity: 1;
  }
}

.file-item__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 8px 8px;
  padding: 8px 10px;
  border-radius: var(--od-radius-m);
  background: var(--od-danger-soft);
}

.file-item__confirm-text {
  font-size: 12px;
  color: var(--od-ink);
}

.file-item__confirm-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.file-item__confirm-actions button {
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: var(--od-radius-m);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.file-item__confirm-actions button:active {
  transform: scale(0.96);
}

.file-item__confirm-actions button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}

.file-item__confirm-cancel {
  background: var(--od-surface);
  color: var(--od-ink);
}

.file-item__confirm-cancel:hover {
  background: var(--od-surface-low);
}

.file-item__confirm-delete {
  background: var(--od-danger);
  color: #fff;
}

.file-item__confirm-delete:hover {
  filter: brightness(0.92);
}

.file-item__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* The confirm strip unfolds in two beats: height first, then its content. */
.file-item-confirm-enter-active {
  transition:
    opacity 160ms ease-out 40ms,
    transform 220ms var(--od-ease);
}

.file-item-confirm-leave-active {
  transition: opacity 100ms ease-in;
}

.file-item-confirm-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.file-item-confirm-leave-to {
  opacity: 0;
}

@keyframes file-item-fade {
  from {
    opacity: 0;
  }
}
</style>
