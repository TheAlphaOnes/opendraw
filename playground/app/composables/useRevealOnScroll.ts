import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Plays a section's entrance once it scrolls into view. Content is visible
 * by default, in the server render, without JavaScript, and for crawlers,
 * and is only held back (`armed`) once the page is running and the
 * section is still below the fold. It is revealed when it comes into view.
 */
export function useRevealOnScroll(): { target: Ref<HTMLElement | null>; armed: Ref<boolean>; revealed: Ref<boolean> } {
  const target = ref<HTMLElement | null>(null)
  const armed = ref(false)
  const revealed = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const element = target.value
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!element || reducedMotion || !('IntersectionObserver' in window)) {
      return
    }
    // Already on screen at load: play the entrance right away.
    if (element.getBoundingClientRect().top < window.innerHeight) {
      armed.value = true
      revealed.value = true
      return
    }
    armed.value = true
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          revealed.value = true
          observer?.disconnect()
          observer = null
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    observer.observe(element)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return { target, armed, revealed }
}
