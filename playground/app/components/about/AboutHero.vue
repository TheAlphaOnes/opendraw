<script setup lang="ts">
import { ArrowRight, BookOpen } from 'lucide-vue-next'

/** The About page's opening: what opendraw is, the two next steps, and a look at it. */
</script>

<template>
  <section class="hero" aria-labelledby="about-title">
    <div class="hero__copy">
      <p class="hero__eyebrow">About opendraw</p>
      <h1 id="about-title" class="hero__title">A whiteboard you can make your own</h1>
      <p class="hero__lead">
        opendraw is a free, open-source whiteboard for hand-drawn diagrams. Sketch an idea, connect it with arrows, add a
        sticky note, then put the same editor inside your own app with one component.
      </p>
      <div class="hero__actions">
        <NuxtLink to="/" class="hero__button hero__button--primary">
          Open the editor
          <ArrowRight :size="16" :stroke-width="2" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink to="/docs" class="hero__button">
          <BookOpen :size="16" :stroke-width="1.75" aria-hidden="true" />
          Read the docs
        </NuxtLink>
      </div>
    </div>
    <figure class="hero__shot">
      <img
        src="/screenshot.png"
        width="1440"
        height="860"
        alt="The opendraw editor: Sketch, Share and Ship joined by arrows, and a yellow sticky note"
        fetchpriority="high"
      />
    </figure>
  </section>
</template>

<style scoped>
.hero {
  display: grid;
  gap: 40px;
  padding: 64px 0 24px;
}

.hero__eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ea580c;
  animation: hero-rise 420ms cubic-bezier(0.19, 1, 0.22, 1) both;
}

.hero__title {
  max-width: 14ch;
  margin: 10px 0 0;
  font-family: 'Excalifont', 'Segoe Print', 'Bradley Hand', cursive;
  font-size: clamp(40px, 6vw, 60px);
  font-weight: 400;
  line-height: 1.08;
  color: #1b1b1f;
  animation: hero-rise 520ms cubic-bezier(0.19, 1, 0.22, 1) 60ms both;
}

.hero__lead {
  max-width: 60ch;
  margin: 18px 0 0;
  font-size: 19px;
  line-height: 1.6;
  color: #4a4a54;
  animation: hero-rise 560ms cubic-bezier(0.19, 1, 0.22, 1) 120ms both;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
  animation: hero-rise 560ms cubic-bezier(0.19, 1, 0.22, 1) 180ms both;
}

.hero__button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border-radius: 10px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #ececf4;
  color: #1b1b1f;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 120ms ease-out,
    transform 90ms cubic-bezier(0.19, 1, 0.22, 1);
}

.hero__button:hover {
  background: #fff4ec;
}

.hero__button:active {
  transform: scale(0.97);
}

.hero__button--primary {
  background: #ea580c;
  box-shadow: none;
  color: #fff;
}

.hero__button--primary:hover {
  background: #c2410c;
}

.hero__button:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
}

.hero__shot {
  margin: 0;
  overflow: hidden;
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 24px 60px -18px rgba(124, 45, 18, 0.28);
  animation: hero-shot 720ms cubic-bezier(0.19, 1, 0.22, 1) 220ms both;
}

.hero__shot img {
  display: block;
  width: 100%;
  height: auto;
}

@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes hero-shot {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.985);
  }
}

@media (max-width: 640px) {
  .hero {
    gap: 28px;
    padding-top: 36px;
  }

  .hero__lead {
    font-size: 17px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero * {
    animation: none !important;
  }
}
</style>
