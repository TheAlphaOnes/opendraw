<template>
  <main class="page">
    <nav class="page__bar">
      <NuxtLink class="page__link" to="/">← full editor</NuxtLink>
      <span class="page__title">headless canvas + custom chrome</span>
    </nav>

    <div class="stage">
      <!-- The canvas only; all chrome below is this page's own UI,
           driven through the same context the canvas uses. -->
      <OpenDrawCanvas class="draw" />

      <div class="dock">
        <button
          v-for="tool in TOOLS"
          :key="tool.id"
          class="dock__btn"
          :class="{ 'dock__btn--active': ctx.activeTool.value === tool.id }"
          type="button"
          @click="ctx.setActiveTool(tool.id)"
        >
          {{ tool.label }}
        </button>

        <span class="dock__sep" />

        <button class="dock__btn" type="button" :disabled="!ctx.canUndo.value" @click="ctx.undo()">
          undo
        </button>
        <button class="dock__btn" type="button" :disabled="!ctx.canRedo.value" @click="ctx.redo()">
          redo
        </button>

        <span class="dock__sep" />

        <button class="dock__btn" type="button" @click="ctx.setGridSize(ctx.gridSize.value ? null : 20)">
          grid
        </button>
        <button class="dock__btn" type="button" @click="ctx.toggleTheme()">
          {{ ctx.theme.value === 'dark' ? 'light' : 'dark' }}
        </button>
        <button class="dock__btn" type="button" @click="ctx.exportPNG('headless')">
          export
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
// A test page: reachable, but kept out of search results.
useSiteSeo({ path: '/headless', title: 'Headless canvas demo | opendraw', noindex: true })

import type { ToolId } from '@opendrawjs/core'

const ctx = createOpenDrawContext({
  // The dark theme dark-filters strokes, so the canvas background must go
  // dark with it, a dark theme over the white default is invisible ink.
  appState: { theme: 'dark', viewBackgroundColor: '#121212' },
})
// Provide for <OpenDrawCanvas> (a child); this page's own chrome talks to
// ctx directly.
provideOpenDraw(ctx)

const TOOLS: Array<{ id: ToolId; label: string }> = [
  { id: 'selection', label: 'select' },
  { id: 'rectangle', label: 'rect' },
  { id: 'ellipse', label: 'circle' },
  { id: 'arrow', label: 'arrow' },
  { id: 'freedraw', label: 'draw' },
  { id: 'text', label: 'text' },
  { id: 'eraser', label: 'erase' },
]
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.page__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #2a2a2a;
  font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #adb5bd;
}

.page__link {
  color: #9775fa;
  text-decoration: none;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.draw {
  position: absolute;
  inset: 0;
}

.dock {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(30, 30, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dock__btn {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font: 500 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e9ecef;
  background: transparent;
  cursor: pointer;
  transition: background 120ms ease-out;
}

.dock__btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dock__btn--active {
  background: #0c8599;
  color: #ffffff;
}

.dock__btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.dock__sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
}
</style>
