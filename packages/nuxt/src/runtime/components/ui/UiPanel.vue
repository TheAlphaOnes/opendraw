<script setup lang="ts">
defineProps<{
  /** Fixed placement of the floating panel. */
  position: 'left' | 'right' | 'bottom' | 'top-left' | 'bottom-left' | 'top-center' | 'properties'
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
   6px backdrop blur (inside the <= 8px performance budget). Panels are
   positioned inside the editor root (absolute, not fixed) so an embedded
   editor keeps its chrome within its own box — Excalidraw's container. */
.ui-panel {
  position: absolute;
  z-index: 10;
  max-width: calc(100% - 32px);
  max-height: calc(100% - 32px);
  overflow-y: auto;
  padding: 8px;
  background: var(--od-surface-float);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
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

/* Centered with auto margins, not left:50% + translate — a fixed box at
   left:50% can only shrink-to-fit into HALF the viewport, which wraps a
   wide island long before the screen runs out of room. */
.ui-panel--bottom {
  bottom: 16px;
  left: 0;
  right: 0;
  width: fit-content;
  margin-inline: auto;
}

.ui-panel--top-left {
  top: 16px;
  left: 16px;
}

.ui-panel--top-center {
  top: 16px;
  left: 0;
  right: 0;
  width: fit-content;
  margin-inline: auto;
}

.ui-panel--bottom-left {
  bottom: 16px;
  left: 16px;
}

/* Excalidraw's properties island: top-left column, clear of the zoom
   island below it; on phones it becomes a bottom sheet over the canvas. */
.ui-panel--properties {
  top: 16px;
  left: 16px;
  width: 232px;
  max-height: calc(100% - 112px);
}

@media (max-width: 640px) {
  .ui-panel--properties {
    top: auto;
    right: 16px;
    bottom: 76px;
    width: auto;
    max-height: 40%;
  }
}

.ui-panel__header {
  padding: 4px 6px 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--od-ink-soft);
}
</style>
