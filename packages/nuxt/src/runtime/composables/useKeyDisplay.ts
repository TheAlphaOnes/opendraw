import { shallowRef, type Ref } from 'vue'

import { appleKeyDisplay, formatKeys } from '@opendraw/editor'

/**
 * Shortcut hints in Vue: a ref mirroring the editor's display platform, so
 * hints re-render from "Ctrl" to "⌘" once a canvas mounts (the hydration
 * render must match the server, which cannot know the platform).
 */
const apple = shallowRef(appleKeyDisplay.value)
appleKeyDisplay.subscribe((value) => {
  apple.value = value
})

export function useKeyDisplay(): { apple: Readonly<Ref<boolean>>; format: (keys: readonly string[]) => string[] } {
  return {
    apple,
    format: (keys) => formatKeys(keys, apple.value),
  }
}
