import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * A reactive CSS media query. False on the server and the hydration render
 * (both must agree), then live after mount.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)
  let list: MediaQueryList | null = null
  const update = (): void => {
    matches.value = list?.matches ?? false
  }
  onMounted(() => {
    list = window.matchMedia(query)
    update()
    list.addEventListener('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener('change', update))
  return matches
}
