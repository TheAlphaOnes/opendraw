<script setup lang="ts">
/** The content pages' footer: where to go next, credits and the license. */
</script>

<template>
  <footer class="site-footer">
    <nav class="site-footer__links" aria-label="Footer">
      <NuxtLink to="/">Editor</NuxtLink>
      <NuxtLink to="/docs">Docs</NuxtLink>
      <NuxtLink to="/about">About</NuxtLink>
      <a :href="SITE.repository" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a :href="SITE.npm" target="_blank" rel="noopener noreferrer">npm</a>
    </nav>
    <p class="site-footer__note">
      {{ SITE.name }} is MIT licensed, © 2026 {{ SITE.author }}. Built with
      <a href="https://github.com/rough-stuff/rough" target="_blank" rel="noopener noreferrer">rough.js</a>,
      <a href="https://github.com/steveruizok/perfect-freehand" target="_blank" rel="noopener noreferrer">perfect-freehand</a> and
      <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">Lucide</a>.
    </p>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 72px;
  padding: 28px 0 48px;
  border-top: 1px solid #ececf4;
  font-size: 14px;
  color: #5c5c66;
}

.site-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}

.site-footer a {
  color: inherit;
  text-decoration: none;
  transition: color 120ms ease-out;
}

.site-footer a:hover {
  color: #ea580c;
}

.site-footer a:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
  border-radius: 4px;
}

.site-footer__links a {
  font-weight: 600;
  color: #1b1b1f;
}

.site-footer__note {
  margin: 14px 0 0;
  line-height: 1.6;
}

.site-footer__note a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
