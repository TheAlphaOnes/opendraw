<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

/**
 * The bottom-right install line — `npm install @opendraw/nuxt` with a copy
 * button that confirms with a check for a moment. Lives in <OpenDraw>'s
 * `footer` slot, beside the help button.
 */
const props = withDefaults(defineProps<{ command?: string }>(), {
  command: 'npm install @opendraw/nuxt',
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
    <code class="install__command">{{ props.command }}</code>
    <button
      type="button"
      class="install__copy"
      :class="{ 'is-copied': copied }"
      :aria-label="copied ? 'Copied' : 'Copy install command'"
      :title="copied ? 'Copied' : 'Copy'"
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
.install {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--od-button-lg, 36px);
  padding: 0 4px 0 12px;
  border-radius: var(--od-radius-l, 8px);
  background: var(--od-surface, #fff);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  font-size: 13px;
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
  background: var(--od-hover, #f1f0ff);
  color: var(--od-ink, #1b1b1f);
}

.install__copy:active {
  transform: scale(0.9);
}

.install__copy.is-copied {
  color: var(--od-accent, #6965db);
}

.install__copy:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent, #6965db);
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

@media (max-width: 640px) {
  .install {
    display: none;
  }
}
</style>
