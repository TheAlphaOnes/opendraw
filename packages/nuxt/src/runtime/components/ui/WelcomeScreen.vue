<script setup lang="ts">
import { computed } from 'vue'

import { useOpenDraw } from '../../composables/useOpenDraw.js'

/**
 * WelcomeScreen — Excalidraw's empty-canvas welcome (parity copy from
 * `packages/excalidraw/components/welcome-screen/`):
 * a centered heading plus a hint under the tool dock. Purely decorative:
 * it never intercepts pointer events and disappears as soon as the first
 * element lands on the canvas.
 *
 * The entrance is deliberately segmented — heading, underline stroke and
 * dock hint each animate on their own duration/easing so the composition
 * settles in stages instead of one monotone fade.
 */
const ctx = useOpenDraw()

const visible = computed(() => ctx.elements.value.length === 0)
</script>

<template>
  <Transition name="welcome">
    <section v-if="visible" class="welcome" aria-hidden="true">
      <h1 class="welcome__heading">
        <span class="welcome__line">Diagrams.</span>
        <span class="welcome__line">Made.</span>
        <span class="welcome__line">Simple.</span>
        <svg class="welcome__underline" viewBox="0 0 220 14" preserveAspectRatio="none">
          <path d="M4 9 C 48 3, 92 12, 136 6 S 204 4, 216 8" />
        </svg>
      </h1>

      <p class="welcome__dock-hint">Pick a tool & Start drawing!</p>
      <p class="welcome__zoom-hint">Zoom & undo live here</p>
    </section>
  </Transition>
</template>

<style scoped>
.welcome {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;
  color: var(--od-ink-soft);
  font: 500 22px/1.35 'Virgil', 'Segoe UI', -apple-system, sans-serif;
}

.welcome__heading {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 44px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--od-ink);
  text-align: center;
}

/* Each word rises and fades on its own clock: 120ms of drift apart,
   the underline stroke then draws itself over a slower 700ms. */
.welcome__line {
  opacity: 0;
  animation: welcome-line 480ms var(--od-ease) forwards;
}

.welcome__line:nth-child(1) { animation-delay: 80ms }
.welcome__line:nth-child(2) { animation-delay: 220ms }
.welcome__line:nth-child(3) { animation-delay: 360ms }

@keyframes welcome-line {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome__line {
  transform: translateY(10px);
}

.welcome__underline {
  position: absolute;
  bottom: -12px;
  left: 50%;
  width: 220px;
  height: 14px;
  overflow: visible;
  transform: translateX(-50%);
}

.welcome__underline path {
  fill: none;
  stroke: var(--od-accent);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 240;
  stroke-dashoffset: 240;
  animation: welcome-stroke 700ms var(--od-ease) 520ms forwards;
}

@keyframes welcome-stroke {
  to { stroke-dashoffset: 0 }
}

.welcome__dock-hint {
  margin: 26px 0 0;
  padding-top: 14px;
  font-size: 14px;
  opacity: 0;
  animation: welcome-hint 420ms var(--od-ease) 720ms forwards;
}

.welcome__zoom-hint {
  position: absolute;
  bottom: 56px;
  left: 20px;
  margin: 0;
  font-size: 13px;
  opacity: 0;
  animation: welcome-hint 480ms var(--od-ease) 940ms forwards;
}

@keyframes welcome-hint {
  from { transform: translateY(6px) }
  to {
    opacity: 0.85;
    transform: translateY(0);
  }
}

/* Leave as one motion: the whole composition sinks away on first stroke. */
.welcome-leave-active {
  transition: opacity 300ms var(--od-ease);
}

.welcome-leave-to {
  opacity: 0;
}

/* Hand-drawn headings shout on phones; the hints duplicate visible chrome. */
@media (max-width: 640px) {
  .welcome__heading {
    font-size: 30px;
  }

  .welcome__zoom-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome__line,
  .welcome__underline path,
  .welcome__dock-hint,
  .welcome__zoom-hint {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}
</style>
