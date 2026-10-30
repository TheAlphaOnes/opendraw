<script setup lang="ts">
/** One labelled fieldset of the properties island (Excalidraw's legend + controls). */
defineProps<{ label: string }>()
</script>

<template>
  <fieldset class="style-section">
    <legend class="style-section__label">{{ label }}</legend>
    <slot />
  </fieldset>
</template>

<style scoped>
.style-section {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  animation: style-section-in 200ms var(--od-ease) both;
}

/* Sections settle in sequence when the panel opens. */
.style-section:nth-of-type(2) { animation-delay: 20ms; }
.style-section:nth-of-type(3) { animation-delay: 40ms; }
.style-section:nth-of-type(4) { animation-delay: 60ms; }
.style-section:nth-of-type(n + 5) { animation-delay: 80ms; }

@keyframes style-section-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
}

.style-section__label {
  display: block;
  margin: 0 0 4px;
  padding: 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--od-ink);
}
</style>
