<script setup lang="ts">
/**
 * Why opendraw exists, how it is built and what it stands for, the
 * background a visitor (or a search engine) needs to trust the project.
 */
const PRINCIPLES = [
  { title: 'Native', text: 'A real component in each framework: no iframe, and no second framework smuggled into your app.' },
  { title: 'Private', text: 'Drawings stay in the browser. Nothing is uploaded, tracked or stored on a server.' },
  { title: 'Accessible', text: 'Real buttons and menus, labelled controls, keyboard shortcuts for everything, reduced-motion support.' },
  { title: 'Open', text: 'MIT licensed, typed end to end, and tested in real browsers across Vue, React and Svelte.' },
] as const

const { target, armed, revealed } = useRevealOnScroll()
</script>

<template>
  <section ref="target" class="story" :class="{ 'is-armed': armed, 'is-revealed': revealed }">
    <div class="story__block" style="--i: 0" aria-labelledby="why-title">
      <h2 id="why-title" class="section-title">Why opendraw</h2>
      <p>
        A quick sketch often explains an idea faster than a page of text. Hand-drawn whiteboards made that feel natural,
        but adding one to your own product usually meant embedding someone else's app in an iframe, or shipping a second
        UI framework alongside yours.
      </p>
      <p>
        opendraw is that whiteboard as a native building block. Drop it into a Vue, Nuxt, React or Svelte app and it
        behaves like part of your product: your theme, your data, your interface around it.
      </p>
    </div>

    <div class="story__block" style="--i: 1" aria-labelledby="built-title">
      <h2 id="built-title" class="section-title">How it's built</h2>
      <p>
        A framework-free core does the real work, the drawing model, history, geometry and rendering, and thin
        adapters connect it to each framework, so every version draws and behaves the same.
      </p>
      <ul class="story__packages">
        <li v-for="pkg in PACKAGES" :key="pkg.name">
          <a :href="`https://www.npmjs.com/package/${pkg.name}`" class="story__package" rel="noopener noreferrer" target="_blank">
            <code>{{ pkg.name }}</code>
          </a>
          <span>{{ pkg.summary }}</span>
        </li>
      </ul>
    </div>

    <div class="story__block" style="--i: 2" aria-labelledby="values-title">
      <h2 id="values-title" class="section-title">What it stands for</h2>
      <ul class="story__principles">
        <li v-for="(principle, index) in PRINCIPLES" :key="principle.title" class="principle" :style="{ '--j': index }">
          <h3 class="principle__title">{{ principle.title }}</h3>
          <p class="principle__text">{{ principle.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.story {
  display: grid;
  gap: 8px;
  padding-top: 40px;
}

.story__block {
  padding-top: 16px;
}

.story p {
  max-width: 68ch;
  font-size: 17px;
  line-height: 1.7;
  color: #33333b;
}

.story.is-armed:not(.is-revealed) .story__block {
  opacity: 0;
  transform: translateY(10px);
}

/* Each block arrives a beat after the one above it. */
.story.is-revealed .story__block {
  animation: story-in 560ms cubic-bezier(0.19, 1, 0.22, 1) calc(var(--i) * 110ms) both;
}

.story__packages {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.story__packages li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  font-size: 15px;
  color: #4a4a54;
}

.story__package {
  text-decoration: none;
}

.story__package code {
  padding: 2px 8px;
  border-radius: 6px;
  background: #fff4ec;
  color: #c2410c;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  transition: background-color 120ms ease-out;
}

.story__package:hover code {
  background: #ffe2cf;
}

.story__package:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
  border-radius: 6px;
}

.story__principles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.principle {
  padding: 18px;
  border-left: 3px solid #ea580c;
  border-radius: 4px 12px 12px 4px;
  background: #fffaf6;
}

.story.is-revealed .principle {
  animation: story-in 480ms cubic-bezier(0.19, 1, 0.22, 1) calc(220ms + var(--j) * 70ms) both;
}

.principle__title {
  margin: 0;
  font-family: 'Excalifont', 'Segoe Print', 'Bradley Hand', cursive;
  font-size: 22px;
  font-weight: 400;
  color: #1b1b1f;
}

.principle .principle__text {
  margin: 6px 0 0;
  font-size: 15px;
  line-height: 1.55;
  color: #4a4a54;
}

@keyframes story-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .story.is-revealed .story__block,
  .story.is-revealed .principle {
    animation: none;
  }
}
</style>
