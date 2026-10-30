<script setup lang="ts">
/**
 * Frequently asked questions, as native disclosure widgets: keyboard
 * accessible, working without JavaScript, and fully in the page for search
 * engines. The same entries feed the page's FAQPage structured data.
 */
</script>

<template>
  <section class="faq" aria-labelledby="faq-title">
    <h2 id="faq-title" class="section-title">Questions</h2>
    <div class="faq__list">
      <details v-for="(entry, index) in ABOUT_FAQ" :key="entry.question" class="faq__item" :open="index === 0">
        <summary class="faq__question">
          <span>{{ entry.question }}</span>
          <svg class="faq__chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </summary>
        <p class="faq__answer">{{ entry.answer }}</p>
      </details>
    </div>
  </section>
</template>

<style scoped>
.faq {
  padding-top: 56px;
}

.faq__list {
  margin-top: 20px;
  border-top: 1px solid #ececf4;
}

.faq__item {
  border-bottom: 1px solid #ececf4;
}

.faq__question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 4px;
  font-size: 17px;
  font-weight: 600;
  color: #1b1b1f;
  list-style: none;
  cursor: pointer;
  transition: color 120ms ease-out;
}

.faq__question::-webkit-details-marker {
  display: none;
}

.faq__question:hover {
  color: #ea580c;
}

.faq__question:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
  border-radius: 6px;
}

.faq__chevron {
  flex-shrink: 0;
  color: #9a9aa5;
  transition: transform 260ms cubic-bezier(0.19, 1, 0.22, 1), color 120ms ease-out;
}

.faq__item[open] .faq__chevron {
  transform: rotate(180deg);
  color: #ea580c;
}

.faq__answer {
  max-width: 68ch;
  margin: 0;
  padding: 0 4px 20px;
  font-size: 16px;
  line-height: 1.65;
  color: #4a4a54;
}

/* The answer settles in a moment after the row opens. */
.faq__item[open] .faq__answer {
  animation: answer-in 320ms cubic-bezier(0.19, 1, 0.22, 1) 40ms both;
}

@keyframes answer-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .faq__item[open] .faq__answer {
    animation: none;
  }
}
</style>
