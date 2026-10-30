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
/* Excalidraw's .Island: opaque, 8px radius, the three-layer island shadow.
   Panels are positioned inside the editor root (absolute, not fixed) so an
   embedded editor keeps its chrome within its own box. */
.ui-panel {
  position: absolute;
  z-index: 10;
  max-width: calc(100% - 2 * var(--od-gutter));
  max-height: calc(100% - 2 * var(--od-gutter));
  overflow-y: auto;
  padding: 4px;
  background: var(--od-surface);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  animation: ui-panel-in 180ms var(--od-ease) both;
}

@keyframes ui-panel-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}

.ui-panel--left {
  top: 50%;
  left: var(--od-gutter);
  transform: translateY(-50%);
}

.ui-panel--right {
  top: 50%;
  right: var(--od-gutter);
  transform: translateY(-50%);
}

/* Centered with auto margins, not left:50% + translate — a box at left:50%
   can only shrink-to-fit into HALF the viewport. */
.ui-panel--bottom {
  bottom: var(--od-gutter);
  left: 0;
  right: 0;
  width: fit-content;
  margin-inline: auto;
}

.ui-panel--top-left {
  top: var(--od-gutter);
  left: var(--od-gutter);
}

.ui-panel--top-center {
  top: var(--od-gutter);
  left: 0;
  right: 0;
  width: fit-content;
  margin-inline: auto;
}

.ui-panel--bottom-left {
  bottom: var(--od-gutter);
  left: var(--od-gutter);
}

/* Excalidraw's selected-shape actions: a 12px-padded column under the main
   menu trigger, clear of the footer; a bottom sheet on phones. */
.ui-panel--properties {
  top: calc(var(--od-gutter) * 2 + var(--od-button-lg));
  left: var(--od-gutter);
  width: 202px;
  max-height: calc(100% - var(--od-gutter) * 4 - var(--od-button-lg) * 2);
  padding: 12px;
}

@media (max-width: 640px) {
  .ui-panel--properties {
    top: auto;
    left: var(--od-gutter);
    right: var(--od-gutter);
    bottom: calc(var(--od-gutter) * 2 + var(--od-button-lg) + 8px);
    width: auto;
    max-height: 42%;
    padding: 8px;
  }
}

.ui-panel__header {
  padding: 4px 6px 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--od-ink-soft);
}
</style>
