<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'

import type { VueDrawElement } from '@vuedraw/core'

import {
  createVueDrawContext,
  provideVueDraw,
  type VueDrawChangeDetail,
} from '../composables/useVueDraw.js'
import VueDrawCanvas from './VueDrawCanvas.vue'
import ToolDock from './toolbar/ToolDock.vue'
import StylePanel from './panels/StylePanel.vue'
import ActionsPanel from './panels/ActionsPanel.vue'
import ContextMenu from './menus/ContextMenu.vue'

/**
 * VueDraw — the full editor, ready to drop into any page:
 *
 *   <VueDraw theme="dark" ui="full" />
 *
 * `ui` gates the chrome: "full" adds dock + panels + context menu,
 * "minimal" keeps only the tool dock, "none" is a pure canvas for
 * building your own UI with useVueDraw().
 */
export interface VueDrawProps {
  theme?: 'light' | 'dark'
  ui?: 'full' | 'minimal' | 'none'
  grid?: boolean | number
  initialElements?: VueDrawElement[]
}

const props = withDefaults(defineProps<VueDrawProps>(), {
  theme: 'light',
  ui: 'full',
  grid: false,
  initialElements: () => [],
})

const emit = defineEmits<{
  (e: 'change', detail: VueDrawChangeDetail): void
  (e: 'select', ids: string[]): void
}>()

const ctx = createVueDrawContext({
  elements: props.initialElements,
  appState: { theme: props.theme },
})
provideVueDraw(ctx)

// Prop → context sync.
watch(
  () => props.theme,
  (theme) => ctx.setTheme(theme),
)
watch(
  () => props.grid,
  (grid) => ctx.setGridSize(grid === true ? 20 : grid === false ? null : grid),
  { immediate: true },
)

// Context → consumer events.
const unsubscribe = ctx.doc.subscribe((state) => {
  emit('change', { elements: state.elements, appState: state.appState })
})
watch(
  () => ctx.selectedElements.value.map((el) => el.id),
  (ids) => emit('select', [...ids]),
)

onBeforeUnmount(() => {
  unsubscribe()
})

// Context menu (full UI only).
const menu = reactive({ x: 0, y: 0, visible: false })

function openMenu(payload: { x: number; y: number }) {
  menu.x = payload.x
  menu.y = payload.y
  menu.visible = true
}

function closeMenu() {
  menu.visible = false
}

const themeAttr = computed(() => ctx.theme.value)
</script>

<template>
  <div class="vuedraw-root" :data-theme="themeAttr">
    <VueDrawCanvas @contextmenu="openMenu" />
    <ToolDock v-if="ui !== 'none'" />
    <StylePanel v-if="ui === 'full'" />
    <ActionsPanel v-if="ui !== 'none'" />
    <ContextMenu
      v-if="ui === 'full'"
      :x="menu.x"
      :y="menu.y"
      :visible="menu.visible"
      @close="closeMenu"
    />
  </div>
</template>

<style>
@import '../styles/vuedraw.css';
</style>
