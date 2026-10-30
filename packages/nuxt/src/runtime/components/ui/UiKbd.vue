<script setup lang="ts">
import { computed } from 'vue'

import { useKeyDisplay } from '../../composables/useKeyDisplay.js'

/**
 * UiKbd, a key combo rendered as keycaps, platform-aware (`Mod` shows ⌘
 * on Apple platforms, Ctrl elsewhere). `inline` drops the caps for dense
 * rows like menu hints.
 */
const props = withDefaults(
  defineProps<{
    keys: readonly string[]
    inline?: boolean
  }>(),
  { inline: false },
)

const { format } = useKeyDisplay()
const display = computed(() => format(props.keys))
</script>

<template>
  <span v-if="props.inline" class="ui-kbd ui-kbd--inline">{{ display.join(display.some((key) => key.length > 1) ? '+' : '') }}</span>
  <span v-else class="ui-kbd">
    <kbd v-for="(key, index) in display" :key="`${key}-${index}`" class="ui-kbd__cap">{{ key }}</kbd>
  </span>
</template>

<style scoped>
.ui-kbd {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ui-kbd--inline {
  gap: 0;
  color: var(--od-ink-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ui-kbd__cap {
  min-width: 20px;
  padding: 2px 6px;
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-s);
  background: var(--od-surface);
  font: 500 11px/1.4 inherit;
  text-align: center;
  color: var(--od-ink);
}
</style>
