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

export interface KeyDisplay {
  apple: Readonly<Ref<boolean>>
  /** One display string per key ("⌘", "Shift", "Z"). */
  format: (keys: readonly string[]) => string[]
  /** The whole combo as one hint: "⌘⇧E" on Apple, "Ctrl+Shift+E" elsewhere. */
  text: (keys: readonly string[]) => string
}

export function useKeyDisplay(): KeyDisplay {
  const format = (keys: readonly string[]): string[] => formatKeys(keys, apple.value)
  return {
    apple,
    format,
    text: (keys) => {
      const parts = format(keys)
      return parts.join(parts.some((key) => key.length > 1) ? '+' : '')
    },
  }
}
