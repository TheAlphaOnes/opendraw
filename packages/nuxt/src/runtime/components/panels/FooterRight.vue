<script setup lang="ts">
import { useHelpDialog } from '../../composables/useHelpDialog.js'
import UiIconButton from '../ui/UiIconButton.vue'

/**
 * The bottom-right footer — the host's own content (the `footer` slot of
 * <OpenDraw>) beside Excalidraw's filled "?" help button.
 */
const help = useHelpDialog()

function toggleHelp(): void {
  help.value = !help.value
}
</script>

<template>
  <div class="footer-right">
    <slot />
    <UiIconButton size="lg" icon="help" label="Help (?)" filled @click="toggleHelp" />
  </div>
</template>

<style scoped>
.footer-right {
  position: absolute;
  z-index: 10;
  right: var(--od-gutter);
  bottom: var(--od-gutter);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: footer-right-in 320ms var(--od-ease) 60ms both;
}

@keyframes footer-right-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
</style>
