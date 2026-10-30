<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import UiIcon from '../ui/UiIcon.vue'

/**
 * OpenDrawCopyCommand — a copyable command pill for <OpenDraw>'s slots,
 * e.g. `<OpenDrawCopyCommand command="npm install @opendraw/nuxt" />` in
 * the top-right slot.
 *
 * A light sweeps its border and a soft accent halo breathes behind it
 * (`:glow="false"` turns both off; reduced motion stills them). Beside the
 * toolbar it gives way as the screen narrows: the full command on wide
 * screens, `shortCommand` on laptops, and on tablets and phones a labelled
 * button ("Install") that opens a card showing the full command with its
 * copy button — so it is always clear what gets copied, and the top row
 * never overlaps the tools.
 */
const props = withDefaults(
  defineProps<{
    command: string
    /** Shown instead of `command` on laptop widths. */
    shortCommand?: string
    /** The prompt glyph before the command; empty for none. */
    prompt?: string
    glow?: boolean
    /** Shrink with the screen (full → short → a labelled button). */
    responsive?: boolean
    /** The narrow-screen button's label. */
    compactLabel?: string
  }>(),
  { shortCommand: undefined, prompt: '$', glow: true, responsive: true, compactLabel: 'Install' },
)

const emit = defineEmits<{ copy: [command: string] }>()

const copied = ref(false)
const cardOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
const label = computed(() => (copied.value ? 'Copied' : `Copy: ${props.command}`))

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.command)
  } catch {
    // Clipboard denied (insecure context): the command stays selectable.
    return
  }
  copied.value = true
  emit('copy', props.command)
  if (timer) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => (copied.value = false), 1600)
}

function onOutside(event: PointerEvent): void {
  if (!rootRef.value?.contains(event.target as Node)) {
    closeCard()
  }
}

function toggleCard(): void {
  if (cardOpen.value) {
    closeCard()
    return
  }
  cardOpen.value = true
  document.addEventListener('pointerdown', onOutside, true)
}

function closeCard(): void {
  cardOpen.value = false
  document.removeEventListener('pointerdown', onOutside, true)
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
  }
  document.removeEventListener('pointerdown', onOutside, true)
})
</script>

<template>
  <div
    ref="rootRef"
    class="od-command"
    :class="{ 'is-glowing': props.glow, 'is-responsive': props.responsive, 'has-short': !!props.shortCommand }"
    @keydown.escape="closeCard"
  >
    <span v-if="props.prompt" class="od-command__prompt" aria-hidden="true">{{ props.prompt }}</span>
    <code class="od-command__text od-command__text--full">{{ props.command }}</code>
    <code v-if="props.shortCommand" class="od-command__text od-command__text--short">{{ props.shortCommand }}</code>
    <button
      type="button"
      class="od-command__copy"
      :class="{ 'is-copied': copied }"
      :aria-label="label"
      :title="label"
      @click="copy"
    >
      <Transition name="od-command-icon" mode="out-in">
        <UiIcon v-if="copied" key="check" name="check" :size="14" />
        <UiIcon v-else key="copy" name="copy" :size="14" />
      </Transition>
    </button>

    <!-- Narrow screens: a labelled button that reveals the command. -->
    <button
      type="button"
      class="od-command__compact"
      :aria-expanded="cardOpen"
      :aria-label="`${props.compactLabel}: ${props.command}`"
      @click="toggleCard"
    >
      <UiIcon name="terminal" :size="16" />
      <span>{{ props.compactLabel }}</span>
    </button>
    <Transition name="od-command-card">
      <div v-if="cardOpen" class="od-command__card" role="dialog" :aria-label="props.compactLabel">
        <p class="od-command__card-head">
          <UiIcon name="terminal" :size="14" />
          <span>{{ props.compactLabel }}</span>
        </p>
        <div class="od-command__card-row">
          <span v-if="props.prompt" class="od-command__prompt" aria-hidden="true">{{ props.prompt }}</span>
          <code class="od-command__card-text">{{ props.command }}</code>
          <button
            type="button"
            class="od-command__copy od-command__card-copy"
            :class="{ 'is-copied': copied }"
            :aria-label="copied ? 'Copied' : 'Copy command'"
            @click="copy"
          >
            <Transition name="od-command-icon" mode="out-in">
              <UiIcon v-if="copied" key="check" name="check" :size="14" />
              <UiIcon v-else key="copy" name="copy" :size="14" />
            </Transition>
          </button>
        </div>
        <p class="od-command__card-hint" :class="{ 'is-copied': copied }">
          {{ copied ? 'Copied to clipboard' : 'Run it in your project' }}
        </p>
      </div>
    </Transition>

    <span class="od-command__status" role="status">{{ copied ? 'Copied to clipboard' : '' }}</span>
  </div>
</template>

<style scoped>
@property --od-command-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.od-command {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--od-bar, 40px);
  padding: 0 6px 0 12px;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  font-size: 13px;
  animation: od-command-in 420ms var(--od-ease) 120ms both;
}

/* The sweeping light: a conic gradient masked down to a 1px ring. */
.od-command.is-glowing::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  padding: 1px;
  border-radius: inherit;
  background: conic-gradient(
    from var(--od-command-angle),
    transparent 0 55%,
    color-mix(in srgb, var(--od-accent) 15%, transparent) 65%,
    var(--od-accent) 82%,
    var(--od-brand-active) 90%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box exclude,
    linear-gradient(#000 0 0);
  animation: od-command-sweep 3.2s linear infinite;
}

/* The halo breathes on its own, slower clock. */
.od-command.is-glowing::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: inherit;
  box-shadow:
    0 0 14px 1px color-mix(in srgb, var(--od-accent) 35%, transparent),
    0 0 32px 4px color-mix(in srgb, var(--od-accent) 18%, transparent);
  animation: od-command-breathe 2.6s ease-in-out infinite;
}

.od-command.is-glowing:hover::after {
  animation-duration: 1.4s;
}

.od-command__prompt,
.od-command__text {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

.od-command__prompt {
  color: var(--od-keybinding);
}

.od-command__text {
  color: var(--od-ink);
  white-space: nowrap;
  user-select: all;
}

.od-command__text--short {
  display: none;
}

.od-command__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--od-ink-soft);
  cursor: pointer;
  transition:
    background-color var(--od-fast, 120ms) ease-out,
    color var(--od-fast, 120ms) ease-out,
    transform 90ms var(--od-ease);
}

.od-command__copy:hover {
  background: var(--od-hover);
  color: var(--od-ink);
}

.od-command__copy:active {
  transform: scale(0.9);
}

.od-command__copy.is-copied {
  color: var(--od-accent);
}

.od-command__copy:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}

.od-command__status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* The compact button and its card exist only on narrow screens. */
.od-command__compact {
  display: none;
}

/* Beside the centered toolbar: full → short → a labelled button. */
@media (max-width: 1379px) {
  .od-command.is-responsive.has-short > .od-command__text--full {
    display: none;
  }

  .od-command.is-responsive.has-short > .od-command__text--short {
    display: inline;
  }
}

@media (max-width: 1259px) {
  .od-command.is-responsive {
    padding: 0 4px;
  }

  .od-command.is-responsive > .od-command__prompt,
  .od-command.is-responsive > .od-command__text,
  .od-command.is-responsive > .od-command__copy {
    display: none !important;
  }

  .od-command.is-responsive > .od-command__compact {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--od-ink);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .od-command__compact:hover,
  .od-command__compact[aria-expanded='true'] {
    background: var(--od-hover);
  }

  .od-command__compact:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--od-accent);
  }
}

.od-command__card {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 2 * var(--od-gutter, 12px));
  padding: 10px;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
}

.od-command__card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--od-ink-soft);
}

/* The snippet: a bordered code row with its copy button inside. */
.od-command__card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
  border: 1px solid var(--od-divider);
  border-radius: 6px;
  background: color-mix(in srgb, var(--od-ink) 4%, var(--od-surface));
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}

.od-command__card-text {
  flex: 1;
  color: var(--od-ink);
  overflow-wrap: anywhere;
  user-select: all;
}

.od-command__card-copy {
  flex-shrink: 0;
}

.od-command__card-hint {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  color: var(--od-ink-soft);
  transition: color var(--od-fast, 120ms) ease-out;
}

.od-command__card-hint.is-copied {
  color: var(--od-accent);
}

.od-command-icon-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.od-command-icon-leave-active {
  transition: opacity 80ms ease-in;
}

.od-command-icon-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.od-command-icon-leave-to {
  opacity: 0;
}

.od-command-card-enter-active {
  transition:
    opacity 140ms ease-out,
    transform 220ms var(--od-ease);
}

.od-command-card-leave-active {
  transition: opacity 90ms ease-in;
}

.od-command-card-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.od-command-card-leave-to {
  opacity: 0;
}

@keyframes od-command-sweep {
  to {
    --od-command-angle: 360deg;
  }
}

@keyframes od-command-breathe {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

@keyframes od-command-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .od-command,
  .od-command::before,
  .od-command::after {
    animation: none;
  }
}
</style>
