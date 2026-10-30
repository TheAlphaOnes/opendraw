<script setup lang="ts">
import { computed, type Component } from 'vue'

import { iconRegistry, type IconName } from '../../constants/icons.js'

const props = withDefaults(
  defineProps<{
    /** Semantic icon name from the central registry. */
    name: IconName
    /** Square icon size in pixels. */
    size?: number
    /** Fill the glyph with the current color (solid variants). */
    filled?: boolean
    /** Rotation in degrees (e.g. a triangle pointing along an arrow). */
    rotate?: number
  }>(),
  { size: 18, filled: false, rotate: 0 },
)

const icon = computed<Component>(() => iconRegistry[props.name])
</script>

<template>
  <component
    :is="icon"
    class="ui-icon"
    :size="props.size"
    :stroke-width="1.75"
    :fill="props.filled ? 'currentColor' : 'none'"
    :style="props.rotate ? { transform: `rotate(${props.rotate}deg)` } : undefined"
    aria-hidden="true"
  />
</template>

<style scoped>
.ui-icon {
  display: block;
  flex-shrink: 0;
}
</style>
