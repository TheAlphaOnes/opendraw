<script setup lang="ts">
/** One labelled row of the properties island (presentational). */
defineProps<{ label: string }>()
</script>

<template>
  <section class="style-section" :aria-label="label">
    <span class="style-section__label">{{ label }}</span>
    <slot />
  </section>
</template>

<style scoped>
.style-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-section__label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vd-ink-soft);
}
</style>
