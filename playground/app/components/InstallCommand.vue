<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

/**
 * The top-right install line — `npm install @opendraw/nuxt` with a copy
 * button that confirms with a check for a moment. A light sweeps around its
 * border and a soft orange halo breathes behind it, so the one thing a
 * visitor should do next is the thing that glows. Lives in <OpenDraw>'s
 * `top-right` slot, beside Docs.
 */
const props = withDefaults(defineProps<{ command?: string; shortCommand?: string }>(), {
  command: 'npm install @opendraw/nuxt',
  shortCommand: 'npm i @opendraw/nuxt',
})

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.command)
    copied.value = true
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Clipboard denied (insecure context): the command stays selectable.
  }
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
  }
})
</script>

<template>
  <div class="install">
    <span class="install__prompt" aria-hidden="true">$</span>
    <code class="install__command install__command--full">{{ props.command }}</code>
    <code class="install__command install__command--short">{{ props.shortCommand }}</code>
    <button
      type="button"
      class="install__copy"
      :class="{ 'is-copied': copied }"
      :aria-label="copied ? 'Copied' : `Copy install command: ${props.command}`"
      :title="copied ? 'Copied' : `Copy: ${props.command}`"
      @click="copy"
    >
      <Transition name="install-icon" mode="out-in">
        <Check v-if="copied" key="check" :size="14" :stroke-width="2" aria-hidden="true" />
        <Copy v-else key="copy" :size="14" :stroke-width="1.75" aria-hidden="true" />
      </Transition>
    </button>
    <span class="install__status" role="status">{{ copied ? 'Copied to clipboard' : '' }}</span>
  </div>
</template>

<style scoped>
@property --install-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.install {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--od-button-lg, 36px);
  padding: 0 4px 0 12px;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface, #fff);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  font-size: 13px;
  animation: install-in 420ms cubic-bezier(0.19, 1, 0.22, 1) 120ms both;
}

/* The sweeping light: a conic gradient masked down to a 1px border ring. */
.install::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  padding: 1px;
  border-radius: inherit;
  background: conic-gradient(
    from var(--install-angle),
    transparent 0 55%,
    rgba(234, 88, 12, 0.15) 65%,
    var(--od-accent, #ea580c) 82%,
    #fdba74 90%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box exclude,
    linear-gradient(#000 0 0);
  animation: install-sweep 3.2s linear infinite;
}

/* The halo: a soft orange glow that breathes on its own, slower clock. */
.install::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: inherit;
  box-shadow:
    0 0 14px 1px rgba(234, 88, 12, 0.35),
    0 0 32px 4px rgba(251, 146, 60, 0.18);
  animation: install-breathe 2.6s ease-in-out infinite;
}

.install:hover::after {
  animation-duration: 1.4s;
}

@keyframes install-sweep {
  to {
    --install-angle: 360deg;
  }
}

@keyframes install-breathe {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

@keyframes install-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .install::before,
  .install::after {
    animation: none;
  }
}

.install__prompt {
  color: var(--od-keybinding, #b8b8b8);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

.install__command {
  color: var(--od-ink, #1b1b1f);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  white-space: nowrap;
  user-select: all;
}

.install__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--od-ink-soft, #707070);
  cursor: pointer;
  transition:
    background-color 120ms ease-out,
    color 120ms ease-out,
    transform 90ms cubic-bezier(0.19, 1, 0.22, 1);
}

.install__copy:hover {
  background: var(--od-hover, #fff4ec);
  color: var(--od-ink, #1b1b1f);
}

.install__copy:active {
  transform: scale(0.9);
}

.install__copy.is-copied {
  color: var(--od-accent, #ea580c);
}

.install__copy:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent, #ea580c);
}

.install__status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.install-icon-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.install-icon-leave-active {
  transition: opacity 80ms ease-in;
}

.install-icon-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.install-icon-leave-to {
  opacity: 0;
}

/* The top row never overlaps the centered toolbar (Excalidraw's grid):
   the full command on wide screens, the short one on laptops, only the
   glowing copy button on tablets, nothing on phones. */
.install__command--short {
  display: none;
}

@media (max-width: 1379px) {
  .install__command--full {
    display: none;
  }

  .install__command--short {
    display: inline;
  }
}

@media (max-width: 1259px) {
  .install {
    padding: 0 4px;
  }

  .install__prompt,
  .install__command--short {
    display: none;
  }
}

@media (max-width: 640px) {
  .install {
    display: none;
  }
}
</style>
