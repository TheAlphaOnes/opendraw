<template>
  <NuxtPage />
</template>

<style>
/* The canvas owns the whole viewport: the UA body margin leaves the page
   scrollable (16px of slack), and any focus-triggered scroll would shift
   the canvas coordinate mapping mid-gesture. */
body {
  margin: 0;
}

/* Visually hidden, still read by screen readers and crawlers. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
