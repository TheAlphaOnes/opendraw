<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'

import type { OpenDrawElement } from '@opendrawjs/core'

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
  type EditorController,
  type ThemeDefault,
} from '@opendrawjs/editor'
import OpenDrawCanvas from './OpenDrawCanvas.vue'
import ToolDock from './toolbar/ToolDock.vue'
import StylePanel from './panels/StylePanel.vue'
import ZoomControls from './panels/ZoomControls.vue'
import FooterRight from './panels/FooterRight.vue'
import ContextMenu from './menus/ContextMenu.vue'
import MainMenu, { type MainMenuLink } from './menus/MainMenu.vue'
import { provideHelpDialog } from '../composables/useHelpDialog.js'
import ShortcutsDialog from './ui/ShortcutsDialog.vue'
import WelcomeScreen from './ui/WelcomeScreen.vue'

/**
 * OpenDraw, the full editor, ready to drop into any page:
 *
 *   <OpenDraw theme="dark" ui="full" />
 *
 * `ui` gates the chrome: "full" adds dock + panels + context menu,
 * "minimal" keeps only the tool dock, "none" is a pure canvas for
 * building your own UI with useOpenDraw().
 *
 * Slots place host content in Excalidraw's layout: `top-left` (after the
 * main menu, e.g. the open document's name), `top-right` (beside the
 * toolbar, e.g. a Docs link) and `footer` (bottom-right, before the help
 * button). `menuLinks` adds the host's links to the main menu.
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
   * `false` disables persistence. Changing the key while mounted opens the
   * scene saved under the new one in place (how drawing files switch);
   * turning persistence on or off takes effect on the next mount.
   */
  persist?: boolean | string
  /** The host's own links in the main menu (docs, repository, ...). */
  menuLinks?: readonly MainMenuLink[]
}

const props = withDefaults(defineProps<OpenDrawProps>(), {
  theme: 'system',
  ui: 'full',
  grid: false,
  initialElements: () => [],
  persist: true,
  menuLinks: () => [],
})

const emit = defineEmits<{
  (e: 'change', detail: OpenDrawChangeDetail): void
  (e: 'select', ids: string[]): void
  /** Mounted: the controller, to drive the editor from outside. */
  (e: 'ready', editor: EditorController): void
}>()

// The context always holds a concrete theme: an explicit prop maps straight
// onto it. `'system'` starts as light on the server AND the hydration
// render (both must agree, the media query only exists after mount), then
// the persisted restore runs first and, when a theme was saved, wins; a
// fresh scene resolves the system scheme on mount.
const ctx = createOpenDrawContext({
  elements: props.initialElements,
  appState: { theme: props.theme === 'system' ? 'light' : resolveThemeDefault(props.theme) },
})
provideOpenDraw(ctx)
provideHelpDialog()

// Prop → context sync. `'system'` is a first-load default, not a live state
// to push, after mount the editor owns the theme (and persists it).
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
const storageKeyOf = (persist: boolean | string): string | null =>
  persist === false ? null : persist === true ? DEFAULT_SCENE_STORAGE_KEY : persist
const initialKey = storageKeyOf(props.persist)
const persistence = initialKey === null ? null : useScenePersistence(ctx, { storageKey: initialKey, themeDefault: props.theme })
if (persistence) {
  watch(
    () => storageKeyOf(props.persist),
    (key) => {
      if (key !== null) {
        persistence.switchTo(key)
      }
    },
  )
} else if (props.theme === 'system') {
  // Without persistence there is no saved theme to prefer, so the system
  // color scheme decides the first-load theme (Excalidraw parity).
  onMounted(() => ctx.setTheme(resolveThemeDefault('system')))
}

onMounted(() => emit('ready', ctx.editor))

onBeforeUnmount(() => {
  unsubscribe()
})

defineExpose({
  editor: ctx.editor,
  context: ctx,
  /** Writes a pending autosave now (before reading the scene from storage). */
  flush: () => persistence?.flush(),
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
    <div v-if="ui === 'full'" class="opendraw-root__top-left">
      <MainMenu :links="menuLinks" />
      <slot name="top-left" />
    </div>
    <ToolDock v-if="ui !== 'none'" />
    <div v-if="ui === 'full' && $slots['top-right']" class="opendraw-root__top-right">
      <slot name="top-right" />
    </div>
    <StylePanel v-if="ui === 'full'" />
    <ZoomControls v-if="ui !== 'none'" />
    <FooterRight v-if="ui === 'full'">
      <slot name="footer" />
    </FooterRight>
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

.opendraw-root__top-left {
  position: absolute;
  z-index: 11;
  top: var(--od-gutter);
  left: var(--od-gutter);
  display: flex;
  align-items: center;
  gap: 8px;
}

.opendraw-root__top-right {
  position: absolute;
  z-index: 11;
  top: var(--od-gutter);
  right: var(--od-gutter);
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
