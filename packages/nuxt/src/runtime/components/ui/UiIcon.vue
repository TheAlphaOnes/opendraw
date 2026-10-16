<script setup lang="ts">
import { computed, type Component } from 'vue'

import { iconRegistry, type IconName } from '../../constants/icons.js'

const props = withDefaults(
  defineProps<{
    /** Semantic icon name from the central registry. */
    name: IconName
    /** Square icon size in pixels. */
    size?: number
  }>(),
  { size: 18 },
)

const icon = computed<Component>(() => iconRegistry[props.name])
</script>

<template>
  <component :is="icon" class="ui-icon" :size="props.size" aria-hidden="true" />
</template>

<style scoped>
.ui-icon {
  display: block;
  flex-shrink: 0;
}
</style>
