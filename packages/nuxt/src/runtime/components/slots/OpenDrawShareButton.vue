<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import OpenDrawButton from './OpenDrawButton.vue'

/**
 * OpenDrawShareButton, Excalidraw's primary "Share" button for the
 * `top-right` slot. Uses the platform share sheet where there is one
 * (phones), otherwise copies the link and says so for a moment.
 *
 *   <template #top-right>
 *     <OpenDrawShareButton />
 *   </template>
 */
const props = withDefaults(
  defineProps<{
    /** The link to share; defaults to the current page. */
    url?: string
    /** Title for the share sheet. */
    title?: string
    label?: string
  }>(),
  { url: undefined, title: undefined, label: 'Share' },
)

const emit = defineEmits<{ share: [url: string] }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
const shownLabel = computed(() => (copied.value ? 'Link copied' : props.label))

async function share(): Promise<void> {
  const url = props.url ?? window.location.href
  const title = props.title ?? document.title
  if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ url, title })
      emit('share', url)
    } catch {
      // Dismissed: nothing was shared.
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    return
  }
  copied.value = true
  emit('share', url)
  if (timer) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => (copied.value = false), 1800)
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
  }
})
</script>

<template>
  <OpenDrawButton :icon="copied ? 'check' : 'share'" :label="shownLabel" variant="primary" @click="share" />
</template>
