<script setup lang="ts">
import { OpenDraw, type OpenDrawChangeDetail } from '@opendrawjs/nuxt/vue'

/** The Vue test app: the full editor in a plain Vue 3 app, no Nuxt. */
function onChange(detail: OpenDrawChangeDetail): void {
  // The e2e suite reads the scene through the public change event.
  ;(window as unknown as { __opendraw: unknown }).__opendraw = {
    elements: detail.elements,
    theme: detail.appState.theme,
  }
}
</script>

<template>
  <main class="page">
    <OpenDraw @change="onChange" />
  </main>
</template>
