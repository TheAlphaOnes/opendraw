<script setup lang="ts">
import { computed } from 'vue'

import { actionById, runAction } from '@opendrawjs/editor'

import { useHelpDialog } from '../../composables/useHelpDialog.js'
import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiIcon from './UiIcon.vue'

/**
 * WelcomeScreen, Excalidraw's empty-canvas welcome (components/
 * welcome-screen): the wordmark, a line about local storage and two quick
 * actions in the center, plus hand-drawn hints pointing at the main menu,
 * the toolbar and the help button. It leaves with the first element.
 *
 * Each piece enters on its own clock, center first, then the toolbar
 * hint, then the corner hints, so the screen settles in stages.
 */
const ctx = useOpenDraw()
const help = useHelpDialog()
const keys = useKeyDisplay()

const visible = computed(() => ctx.elements.value.length === 0)
const openKeys = computed(() => keys.text(actionById('openFile').keys ?? []))

function openHelp(): void {
  help.value = true
}
</script>

<template>
  <Transition name="welcome">
    <div v-if="visible" class="welcome">
      <div class="welcome__hint welcome__hint--menu" aria-hidden="true">
        <svg viewBox="0 0 41 94" class="welcome__arrow welcome__arrow--menu">
          <path d="M38.5 83.5c-14-2-17.5-9-21-16.5S12 51.5 12.5 41 17 10 17 10M17 10l-8.5 9.5M17 10l8 9.5" />
        </svg>
        <span>Export, preferences, and more...</span>
      </div>

      <div class="welcome__hint welcome__hint--toolbar" aria-hidden="true">
        <svg viewBox="0 0 38 78" class="welcome__arrow welcome__arrow--toolbar">
          <path d="M1 77c14.5-5 23-17 27-29s4-24 3-35M31 13l-8 7.5M31 13l6 9" />
        </svg>
        <span>Pick a tool &amp;<br />Start drawing!</span>
      </div>

      <div class="welcome__hint welcome__hint--help" aria-hidden="true">
        <span>Shortcuts &amp; help</span>
        <svg viewBox="0 0 38 78" class="welcome__arrow welcome__arrow--help">
          <path d="M1 1c14.5 5 23 17 27 29s4 24 3 35M31 65l-8-7.5M31 65l6-9" />
        </svg>
      </div>

      <section class="welcome__center" aria-label="Welcome">
        <p class="welcome__logo">opendraw</p>
        <p class="welcome__heading">All your data is saved locally in your browser.</p>
        <div class="welcome__menu">
          <button type="button" class="welcome__item" @click="runAction(ctx.editor, 'openFile')">
            <UiIcon name="open" :size="16" />
            <span class="welcome__item-text">Open</span>
            <span class="welcome__item-shortcut">{{ openKeys }}</span>
          </button>
          <button type="button" class="welcome__item" @click="openHelp">
            <UiIcon name="help" :size="16" />
            <span class="welcome__item-text">Help</span>
            <span class="welcome__item-shortcut">?</span>
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.welcome {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  color: var(--od-keybinding);
  font-family: 'Excalifont', 'Virgil', 'Segoe Print', 'Bradley Hand', cursive;
}

/* --- center ------------------------------------------------------------ */

.welcome__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 0 16px;
}

.welcome__logo {
  margin: 0;
  font-size: 36px;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--od-accent);
  animation: welcome-rise 520ms var(--od-ease) 60ms both;
}

.welcome__heading {
  margin: -12px 0 0;
  font-size: 18px;
  line-height: 1.3;
  text-align: center;
  animation: welcome-rise 560ms var(--od-ease) 160ms both;
}

.welcome__menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: min(300px, 100%);
  font-family: var(--od-font-ui);
  animation: welcome-rise 600ms var(--od-ease) 260ms both;
}

.welcome__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--od-radius-l);
  background: transparent;
  color: var(--od-ink-soft);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  pointer-events: auto;
  transition:
    background-color var(--od-fast) ease-out,
    color var(--od-fast) ease-out;
}

.welcome__item:hover {
  background: var(--od-hover);
  color: var(--od-ink);
}

.welcome__item:active {
  border-color: var(--od-brand-active);
}

.welcome__item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--od-accent);
}

.welcome__item-text {
  flex: 1;
  text-align: left;
}

.welcome__item-shortcut {
  opacity: 0.7;
  font-size: 13px;
}

/* --- hints ------------------------------------------------------------- */

.welcome__hint {
  position: absolute;
  display: flex;
  gap: 8px;
  font-size: 16px;
  line-height: 1.25;
}

.welcome__arrow {
  flex-shrink: 0;
  overflow: visible;
}

.welcome__arrow path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 160;
  stroke-dashoffset: 160;
  animation: welcome-draw 700ms var(--od-ease) forwards;
}

.welcome__hint--menu {
  top: calc(var(--od-gutter) + var(--od-bar) + 4px);
  left: calc(var(--od-gutter) + 6px);
  align-items: flex-end;
  animation: welcome-fade 520ms ease-out 520ms both;
}

.welcome__hint--menu span {
  margin-bottom: 4px;
  max-width: 180px;
}

.welcome__arrow--menu {
  width: 30px;
  height: 70px;
}

.welcome__arrow--menu path {
  animation-delay: 560ms;
}

.welcome__hint--toolbar {
  top: calc(var(--od-gutter) + var(--od-bar) + 40px);
  left: 50%;
  align-items: flex-end;
  transform: translateX(-110px);
  animation: welcome-fade 480ms ease-out 380ms both;
}

.welcome__arrow--toolbar {
  width: 28px;
  height: 60px;
  transform: scaleX(-1);
}

.welcome__arrow--toolbar path {
  animation-delay: 420ms;
}

.welcome__hint--help {
  right: calc(var(--od-gutter) + 6px);
  bottom: calc(var(--od-gutter) + var(--od-bar) + 8px);
  align-items: flex-start;
  animation: welcome-fade 560ms ease-out 640ms both;
}

.welcome__hint--help span {
  margin-top: 4px;
}

.welcome__arrow--help {
  width: 28px;
  height: 60px;
}

.welcome__arrow--help path {
  animation-delay: 680ms;
}

@keyframes welcome-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes welcome-fade {
  from {
    opacity: 0;
  }
}

@keyframes welcome-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* Leaves as one motion on the first stroke, and goes inert at once, so
   its fading buttons never catch the next gesture. */
.welcome-leave-active {
  transition: opacity 220ms ease-out;
}

.welcome-leave-active .welcome__item {
  pointer-events: none;
}

.welcome-leave-to {
  opacity: 0;
}

/* Excalidraw hides the corner hints on short or narrow screens. */
@media (max-height: 780px), (max-width: 1024px) {
  .welcome__hint--menu,
  .welcome__hint--help {
    display: none;
  }
}

@media (max-width: 640px) {
  .welcome__hint--toolbar {
    display: none;
  }
}
</style>
