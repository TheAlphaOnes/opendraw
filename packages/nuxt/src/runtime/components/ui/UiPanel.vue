<script setup lang="ts">
defineProps<{
  /** Fixed placement of the floating panel. */
  position: 'left' | 'right' | 'bottom' | 'top-left' | 'bottom-left' | 'top-center'
}>()
</script>

<template>
  <div class="ui-panel" :class="`ui-panel--${position}`">
    <div v-if="$slots.header" class="ui-panel__header">
      <slot name="header" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* Floating surface: radius 12, hairline border, two layered neutral shadows,
   6px backdrop blur (inside the <= 8px performance budget). */
.ui-panel {
  position: fixed;
  z-index: 10;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 8px;
  background: var(--vd-surface-float);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid var(--vd-border);
  border-radius: var(--vd-radius-l);
  box-shadow: var(--vd-shadow-1), var(--vd-shadow-2);
}

.ui-panel--left {
  top: 50%;
  left: 16px;
  transform: translateY(-50%);
}

.ui-panel--right {
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
}

.ui-panel--bottom {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
}

.ui-panel--top-left {
  top: 16px;
  left: 16px;
}

.ui-panel--top-center {
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
}

.ui-panel--bottom-left {
  bottom: 16px;
  left: 16px;
}

.ui-panel__header {
  padding: 4px 6px 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vd-ink-soft);
}
</style>
