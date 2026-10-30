<template>
  <main class="demo">
    <OpenDraw class="demo__draw" />
  </main>
</template>

<script setup lang="ts">
// A test page: reachable, but kept out of search results.
useSiteSeo({ path: '/excalidraw', title: 'Full-viewport demo | opendraw', noindex: true })

/**
 * Full-viewport Excalidraw-style demo: the complete editor chrome against a
 * 100vh canvas, the shape the library drops into a host page.
 */
</script>

<style scoped>
.demo {
  height: 100vh;
  height: 100dvh;
}

.demo__draw {
  width: 100%;
  height: 100%;
}
</style>
