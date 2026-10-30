<script setup lang="ts">
import { Download, Files, LayoutGrid, PenTool, Smartphone, Workflow } from 'lucide-vue-next'

/** What people can do with opendraw, one card per idea. */
const FEATURES = [
  {
    icon: PenTool,
    title: 'Draw anything',
    text: 'Rectangles, diamonds, ellipses, lines, freehand strokes, text and sticky notes, all with a sketchy hand-drawn look.',
  },
  {
    icon: Workflow,
    title: 'Connect ideas',
    text: 'Arrows snap to shapes and follow them when they move: straight, curved, or elbowed around whatever is in the way.',
  },
  {
    icon: LayoutGrid,
    title: 'Keep it tidy',
    text: 'Group, align and distribute, layer, lock, and gather related work into frames. Undo and redo every step.',
  },
  {
    icon: Files,
    title: 'Many drawings',
    text: 'Create, rename, duplicate and search drawings in a sidebar. Each one saves itself as you work.',
  },
  {
    icon: Download,
    title: 'Share your work',
    text: 'Export to PNG or SVG for docs and slides, or save an .opendraw file to keep editing later.',
  },
  {
    icon: Smartphone,
    title: 'Any screen',
    text: 'A roomy desktop layout, a phone layout with the tools at your thumb, pinch to zoom, light and dark themes.',
  },
] as const

const { target, armed, revealed } = useRevealOnScroll()
</script>

<template>
  <section ref="target" class="features" :class="{ 'is-armed': armed, 'is-revealed': revealed }" aria-labelledby="features-title">
    <h2 id="features-title" class="section-title">What you can do</h2>
    <ul class="features__grid">
      <li v-for="(feature, index) in FEATURES" :key="feature.title" class="feature" :style="{ '--i': index }">
        <span class="feature__icon" aria-hidden="true">
          <component :is="feature.icon" :size="20" :stroke-width="1.75" />
        </span>
        <h3 class="feature__title">{{ feature.title }}</h3>
        <p class="feature__text">{{ feature.text }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.features {
  padding: 56px 0 8px;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 14px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.feature {
  padding: 20px;
  border-radius: 14px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #ececf4;
  transition: box-shadow 160ms ease-out;
}

/* Held back only once the page runs and the section is still out of view. */
.features.is-armed:not(.is-revealed) .feature {
  opacity: 0;
  transform: translateY(10px);
}

/* Cards land one after another, each a beat behind the last. */
.features.is-revealed .feature {
  animation: feature-in 520ms cubic-bezier(0.19, 1, 0.22, 1) calc(var(--i) * 70ms) both;
}

.feature:hover {
  box-shadow: inset 0 0 0 1px #f6c9a8;
}

.feature__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #fff4ec;
  color: #ea580c;
}

.features.is-revealed .feature__icon {
  animation: icon-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--i) * 70ms + 180ms) both;
}

.feature__title {
  margin: 14px 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: #1b1b1f;
}

.feature__text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: #4a4a54;
}

@keyframes feature-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes icon-pop {
  from {
    transform: scale(0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .features.is-revealed .feature,
  .features.is-revealed .feature__icon {
    animation: none;
  }
}
</style>
