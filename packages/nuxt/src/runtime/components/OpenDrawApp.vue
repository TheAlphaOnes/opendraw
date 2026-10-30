<script setup lang="ts">
import { computed } from 'vue'

import type { EditorController } from '@opendraw/editor'

import type { OpenDrawAppCommand, OpenDrawAppConfig, OpenDrawAppShare } from '../config/openDrawApp.js'
import type { OpenDrawChangeDetail } from '../composables/useOpenDraw.js'
import OpenDraw from './OpenDraw.vue'
import OpenDrawButton from './slots/OpenDrawButton.vue'
import OpenDrawCopyCommand from './slots/OpenDrawCopyCommand.vue'
import OpenDrawShareButton from './slots/OpenDrawShareButton.vue'

/**
 * OpenDrawApp — the opendraw demo site as one component: the full editor
 * filling the page, with your buttons, the glowing copyable command and a
 * Share button top-right, and your links in the main menu. Everything is
 * one config object; hooks arrive both as config callbacks and as events.
 *
 *   <OpenDrawApp :config="defineOpenDrawConfig({
 *     links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
 *     command: { text: 'npm install @opendraw/nuxt', short: 'npm i @opendraw/nuxt' },
 *   })" />
 *
 * The `top-right` and `footer` slots still take anything extra.
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

const share = computed<OpenDrawAppShare | null>(() => {
  const value = props.config.share
  return !value ? null : value === true ? {} : value
})

function onChange(detail: OpenDrawChangeDetail): void {
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
      :theme="props.config.theme"
      :persist="props.config.persist"
      :grid="props.config.grid"
      :initial-elements="props.config.initialElements"
      :menu-links="props.config.menuLinks"
      @change="onChange"
      @select="onSelect"
      @ready="onReady"
    >
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
