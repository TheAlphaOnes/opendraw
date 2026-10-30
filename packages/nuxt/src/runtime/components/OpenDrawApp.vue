<script setup lang="ts">
import { computed, ref } from 'vue'

import type { EditorController } from '@opendrawjs/editor'

import type { OpenDrawAppCommand, OpenDrawAppConfig, OpenDrawAppShare } from '../config/openDrawApp.js'
import type { OpenDrawChangeDetail } from '../composables/useOpenDraw.js'
import { createDrawingFilesContext, provideDrawingFiles, type DrawingFilesContext } from '../composables/useDrawingFiles.js'
import OpenDraw from './OpenDraw.vue'
import FilesButton from './files/FilesButton.vue'
import OpenDrawButton from './slots/OpenDrawButton.vue'
import OpenDrawCopyCommand from './slots/OpenDrawCopyCommand.vue'
import OpenDrawShareButton from './slots/OpenDrawShareButton.vue'

/**
 * OpenDrawApp, the opendraw demo site as one component: the full editor
 * filling the page, with your buttons, the glowing copyable command and a
 * Share button top-right, and your links in the main menu. Everything is
 * one config object; hooks arrive both as config callbacks and as events.
 *
 *   <OpenDrawApp :config="defineOpenDrawConfig({
 *     links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
 *     command: { text: 'npm install @opendrawjs/nuxt', short: 'npm i @opendrawjs/nuxt' },
 *   })" />
 *
 * The `top-right` and `footer` slots still take anything extra. With
 * `files`, the editor holds many drawings: the Drawings button opens them,
 * and autosave follows whichever one is open.
 */
const props = withDefaults(defineProps<{ config?: OpenDrawAppConfig }>(), { config: () => ({}) })

const emit = defineEmits<{
  change: [detail: OpenDrawChangeDetail]
  select: [ids: string[]]
  ready: [editor: EditorController]
  copy: [command: string]
  share: [url: string]
}>()

const command = computed<OpenDrawAppCommand | null>(() => {
  const value = props.config.command
  return value === undefined ? null : typeof value === 'string' ? { text: value } : value
})

const editorRef = ref<InstanceType<typeof OpenDraw> | null>(null)

// Drawing files are set up once: the library owns storage for this mount.
const filesConfig = props.config.files
const files: DrawingFilesContext | null = filesConfig
  ? createDrawingFilesContext({
      ...(typeof filesConfig === 'object' && filesConfig.indexKey ? { indexKey: filesConfig.indexKey } : {}),
      flushScene: () => editorRef.value?.flush(),
    })
  : null
if (files) {
  provideDrawingFiles(files)
}

// With files, autosave writes the open drawing; switching drawings is
// switching this key (OpenDraw loads the new scene in place).
const persist = computed(() => (files ? files.storageKey.value : props.config.persist))

// The main menu also opens the drawings, the only way in on phones.
const menuLinks = computed(() => [
  ...(files ? [{ label: 'Drawings', icon: 'files' as const, onSelect: () => (files.sidebarOpen.value = true) }] : []),
  ...(props.config.menuLinks ?? []),
])

const share = computed<OpenDrawAppShare | null>(() => {
  const value = props.config.share
  return !value ? null : value === true ? {} : value
})

function onChange(detail: OpenDrawChangeDetail): void {
  files?.record({
    elements: detail.elements,
    viewBackgroundColor: detail.appState.viewBackgroundColor,
    theme: detail.appState.theme,
  })
  props.config.onChange?.(detail)
  emit('change', detail)
}

function onSelect(ids: string[]): void {
  props.config.onSelect?.(ids)
  emit('select', ids)
}

function onReady(editor: EditorController): void {
  props.config.onReady?.(editor)
  emit('ready', editor)
}

function onCopy(text: string): void {
  props.config.onCopy?.(text)
  emit('copy', text)
}

function onShare(url: string): void {
  props.config.onShare?.(url)
  emit('share', url)
}
</script>

<template>
  <div class="od-app" :class="{ 'od-app--fullscreen': props.config.fullscreen !== false }">
    <OpenDraw
      ref="editorRef"
      :theme="props.config.theme"
      :persist="persist"
      :grid="props.config.grid"
      :initial-elements="props.config.initialElements"
      :menu-links="menuLinks"
      @change="onChange"
      @select="onSelect"
      @ready="onReady"
    >
      <template v-if="files" #top-left>
        <FilesButton />
      </template>
      <template #top-right>
        <OpenDrawCopyCommand
          v-if="command"
          :command="command.text"
          :short-command="command.short"
          :glow="command.glow ?? true"
          :prompt="command.prompt ?? '$'"
          @copy="onCopy"
        />
        <OpenDrawButton
          v-for="link in props.config.links ?? []"
          :key="link.label"
          :label="link.label"
          :icon="link.icon"
          :to="link.to"
          :href="link.href"
          :variant="link.variant ?? 'filled'"
          @click="link.onClick?.()"
        />
        <OpenDrawShareButton v-if="share" :url="share.url" :title="share.title" :label="share.label" @share="onShare" />
        <slot name="top-right" />
      </template>
      <template #footer>
        <slot name="footer" />
      </template>
    </OpenDraw>
  </div>
</template>

<style scoped>
.od-app {
  width: 100%;
  height: 100%;
}

.od-app--fullscreen {
  height: 100vh;
  height: 100dvh;
}
</style>
