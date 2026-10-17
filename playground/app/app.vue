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
</style>
