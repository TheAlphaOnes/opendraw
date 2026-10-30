<script lang="ts">
import type { IconName } from '../../constants/icons.js'

/**
 * A host entry in the main menu: a link (`href`; external URLs open in a
 * new tab) or an action (`onSelect`).
 */
export interface MainMenuLink {
  label: string
  href?: string
  onSelect?: () => void
  icon?: IconName
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { actionById, isActionEnabled, runAction, type ActionId } from '@opendrawjs/editor'

import { useHelpDialog } from '../../composables/useHelpDialog.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiDropdown from '../ui/UiDropdown.vue'
import UiIconButton from '../ui/UiIconButton.vue'
import UiMenuItem from '../ui/UiMenuItem.vue'
import UiMenuSeparator from '../ui/UiMenuSeparator.vue'
import CanvasBackgroundPicker from './CanvasBackgroundPicker.vue'

/**
 * The top-left hamburger — Excalidraw's MainMenu with its default items:
 * open, save, export, help and reset; then the host's own links; then
 * preferences — theme, grid and canvas background.
 */
const props = withDefaults(defineProps<{ links?: readonly MainMenuLink[] }>(), { links: () => [] })

const ctx = useOpenDraw()
const help = useHelpDialog()

const FILE_ACTIONS: readonly ActionId[] = ['openFile', 'saveToFile', 'exportPNG', 'exportSVG']

const LABELS: Partial<Record<ActionId, string>> = {
  openFile: 'Open',
  saveToFile: 'Save to...',
  exportPNG: 'Export image as PNG',
  exportSVG: 'Export image as SVG',
}

const dark = computed(() => ctx.theme.value === 'dark')
const gridOn = computed(() => ctx.gridSize.value !== null)

function enabled(id: ActionId): boolean {
  void ctx.revision.value
  return isActionEnabled(ctx.editor, id)
}

function openHelp(close: () => void): void {
  close()
  help.value = true
}

function run(id: ActionId, close: () => void): void {
  close()
  runAction(ctx.editor, id)
}
</script>

<template>
  <UiDropdown label="Main menu" align="start" :width="220">
    <template #trigger="{ toggle, open }">
      <UiIconButton size="lg" icon="menu" label="Main menu" filled :active="open" @click="toggle" />
    </template>
    <template #default="{ close }">
      <UiMenuItem
        v-for="id in FILE_ACTIONS"
        :key="id"
        :icon="actionById(id).icon"
        :label="LABELS[id] ?? actionById(id).label"
        :keys="actionById(id).keys"
        :disabled="!enabled(id)"
        @select="run(id, close)"
      />
      <UiMenuItem icon="help" label="Help" :keys="['?']" @select="openHelp(close)" />
      <UiMenuItem
        icon="clear"
        label="Reset the canvas"
        :disabled="!enabled('clearCanvas')"
        @select="run('clearCanvas', close)"
      />
      <template v-if="props.links.length > 0">
        <UiMenuSeparator />
        <UiMenuItem
          v-for="link in props.links"
          :key="link.label"
          :icon="link.icon"
          :label="link.label"
          :href="link.href"
          @select="close(), link.onSelect?.()"
        />
      </template>
      <UiMenuSeparator />
      <UiMenuItem
        :icon="dark ? 'sun' : 'moon'"
        :label="dark ? 'Light mode' : 'Dark mode'"
        :keys="actionById('toggleTheme').keys"
        @select="run('toggleTheme', close)"
      />
      <UiMenuItem
        icon="grid"
        :label="gridOn ? 'Hide grid' : 'Show grid'"
        :keys="actionById('toggleGrid').keys"
        :selected="gridOn"
        @select="run('toggleGrid', close)"
      />
      <CanvasBackgroundPicker />
    </template>
  </UiDropdown>
</template>
