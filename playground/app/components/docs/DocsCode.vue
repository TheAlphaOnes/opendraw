<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

/** A code block with its file name (or language) and a copy button. */
const props = withDefaults(defineProps<{ code: string; title?: string }>(), { title: undefined })

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code.trim())
    copied.value = true
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard denied: the code stays selectable.
  }
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
  }
})
</script>

<template>
  <figure class="code">
    <figcaption v-if="props.title" class="code__title">{{ props.title }}</figcaption>
    <button type="button" class="code__copy" :aria-label="copied ? 'Copied' : 'Copy code'" @click="copy">
      <Check v-if="copied" :size="14" />
      <Copy v-else :size="14" :stroke-width="1.75" />
    </button>
    <pre class="code__pre"><code>{{ props.code.trim() }}</code></pre>
  </figure>
</template>

<style scoped>
.code {
  position: relative;
  margin: 16px 0 20px;
  border: 1px solid #ececf4;
  border-radius: 10px;
  background: #f6f6f9;
  overflow: hidden;
}

.code__title {
  padding: 8px 14px;
  border-bottom: 1px solid #ececf4;
  color: #5c5c66;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}

.code__pre {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1b1b1f;
}

.code__copy {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #fff;
  color: #5c5c66;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 120ms ease-out,
    background-color 120ms ease-out;
}

.code:hover .code__copy,
.code__copy:focus-visible {
  opacity: 1;
}

.code__copy:hover {
  background: #fff4ec;
  color: #ea580c;
}
</style>
