<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'

import type { OpenDrawElement } from '@opendraw/core'

import {
  createOpenDrawContext,
  provideOpenDraw,
  type OpenDrawChangeDetail,
} from '../composables/useOpenDraw.js'
import { useScenePersistence } from '../composables/useScenePersistence.js'
import {
  DEFAULT_SCENE_STORAGE_KEY,
  resolveThemeDefault,
  type CanvasContextMenuRequest,
  type ThemeDefault,
} from '@opendraw/editor'
import OpenDrawCanvas from './OpenDrawCanvas.vue'
import ToolDock from './toolbar/ToolDock.vue'
import StylePanel from './panels/StylePanel.vue'
import ActionsPanel from './panels/ActionsPanel.vue'
import ZoomControls from './panels/ZoomControls.vue'
import ContextMenu from './menus/ContextMenu.vue'
import ShortcutsDialog from './ui/ShortcutsDialog.vue'
import WelcomeScreen from './ui/WelcomeScreen.vue'

/**
 * OpenDraw — the full editor, ready to drop into any page:
 *
 *   <OpenDraw theme="dark" ui="full" />
 *
 * `ui` gates the chrome: "full" adds dock + panels + context menu,
 * "minimal" keeps only the tool dock, "none" is a pure canvas for
 * building your own UI with useOpenDraw().
 */
export interface OpenDrawProps {
  /**
   * Starting theme. `"system"` (the default) follows the browser color
   * scheme, matching Excalidraw's first-load detection; a persisted
   * theme always wins over it.
   */
  theme?: ThemeDefault
  ui?: 'full' | 'minimal' | 'none'
  grid?: boolean | number
  initialElements?: OpenDrawElement[]
  /**
   * Automatic localStorage persistence (Excalidraw parity). `true` (default)
   * saves the scene under the shared key; a string saves under that key;
   * `false` disables persistence.
   */
  persist?: boolean | string
}

const props = withDefaults(defineProps<OpenDrawProps>(), {
  theme: 'system',
  ui: 'full',
  grid: false,
  initialElements: () => [],
  persist: true,
})

const emit = defineEmits<{
  (e: 'change', detail: OpenDrawChangeDetail): void
  (e: 'select', ids: string[]): void
}>()

// The context always holds a concrete theme: an explicit prop maps straight
// onto it. `'system'` starts as light on the server AND the hydration
// render (both must agree — the media query only exists after mount), then
// the persisted restore runs first and, when a theme was saved, wins; a
// fresh scene resolves the system scheme on mount.
const ctx = createOpenDrawContext({
  elements: props.initialElements,
  appState: { theme: props.theme === 'system' ? 'light' : resolveThemeDefault(props.theme) },
})
provideOpenDraw(ctx)

// Prop → context sync. `'system'` is a first-load default, not a live state
// to push — after mount the editor owns the theme (and persists it).
watch(
  () => props.theme,
  (theme) => {
    if (theme !== 'system') {
      ctx.setTheme(theme)
    }
  },
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

// Automatic save/restore. Registered after the change-event wiring above so
// the restored scene is announced to consumers through the public event.
if (props.persist !== false) {
  useScenePersistence(ctx, {
    storageKey: props.persist === true ? DEFAULT_SCENE_STORAGE_KEY : props.persist,
    themeDefault: props.theme,
  })
} else if (props.theme === 'system') {
  // Without persistence there is no saved theme to prefer, so the system
  // color scheme decides the first-load theme (Excalidraw parity).
  onMounted(() => ctx.setTheme(resolveThemeDefault('system')))
}

onBeforeUnmount(() => {
  unsubscribe()
})

// Context menu (full UI only).
const menu = reactive<CanvasContextMenuRequest & { visible: boolean }>({
  x: 0,
  y: 0,
  target: 'canvas',
  visible: false,
})
function openMenu(payload: CanvasContextMenuRequest) {
  Object.assign(menu, payload, { visible: true })
}
function closeMenu() {
  menu.visible = false
}

const themeAttr = computed(() => ctx.theme.value)
</script>

<template>
  <div class="opendraw-root" data-opendraw-root :data-theme="themeAttr">
    <OpenDrawCanvas @contextmenu="openMenu" />
    <ToolDock v-if="ui !== 'none'" />
    <StylePanel v-if="ui === 'full'" />
    <ActionsPanel v-if="ui !== 'none'" />
    <ZoomControls v-if="ui !== 'none'" />
    <ContextMenu
      v-if="ui === 'full'"
      :x="menu.x"
      :y="menu.y"
      :visible="menu.visible"
      :target="menu.target"
      @close="closeMenu"
    />
    <ShortcutsDialog v-if="ui !== 'none'" />
    <WelcomeScreen v-if="ui === 'full'" />
  </div>
</template>

<style>
@import '../styles/opendraw.css';
</style>
