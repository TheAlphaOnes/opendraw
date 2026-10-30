<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'

/**
 * The demo's top-right "Docs" button — styled like Excalidraw's top-right
 * sidebar trigger (filled on-canvas button, icon + label). It renders in
 * <OpenDraw>'s `top-right` slot, so the editor's tokens apply.
 */
</script>

<template>
  <NuxtLink to="/docs" class="docs-button" title="Documentation">
    <BookOpen :size="16" :stroke-width="1.75" aria-hidden="true" />
    <span>Docs</span>
  </NuxtLink>
</template>

<style scoped>
.docs-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--od-button-lg, 36px);
  padding: 0 12px;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface-low, #ececf4);
  box-shadow: 0 0 0 1px var(--od-surface, #fff);
  color: var(--od-ink, #1b1b1f);
  font-size: 14px;
  text-decoration: none;
  transition:
    background-color 120ms ease-out,
    transform 90ms cubic-bezier(0.19, 1, 0.22, 1);
  animation: docs-button-in 300ms cubic-bezier(0.19, 1, 0.22, 1) 80ms both;
}

.docs-button:hover {
  background: var(--od-surface-high, #f1f0ff);
}

.docs-button:active {
  transform: scale(0.96);
  box-shadow: 0 0 0 1px var(--od-brand-active, #4440bf);
}

.docs-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent, #6965db);
}

@keyframes docs-button-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
