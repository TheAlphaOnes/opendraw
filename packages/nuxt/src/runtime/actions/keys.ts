/**
 * Keyboard helpers shared by the action registry and the shortcut
 * displays.
 */

/** True on Apple platforms, where Mod is ⌘ and Alt is ⌥. */
export function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

/** Ctrl, or ⌘ on Apple platforms — Excalidraw's CTRL_OR_CMD. */
export function isMod(event: KeyboardEvent): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey
}

/**
 * Mod with no Alt — the plain "command" chord. Either Ctrl or ⌘ counts so
 * remote-desktop and automation key streams still reach the action.
 */
export function plainMod(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey
}

/** No Ctrl, ⌘ or Alt held (Shift is free). */
export function noMod(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey
}

/** Case-insensitive `event.key` match. */
export function keyIs(event: KeyboardEvent, key: string): boolean {
  return event.key.toLowerCase() === key.toLowerCase()
}

/** Typing contexts own their keys — shortcuts never fire inside them. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

/** Renders a key combo for display, platform-aware. */
export function formatKeys(keys: readonly string[]): string[] {
  const apple = isApplePlatform()
  return keys.map((key) => {
    if (key === 'Mod') {
      return apple ? '⌘' : 'Ctrl'
    }
    if (key === 'Alt') {
      return apple ? '⌥' : 'Alt'
    }
    if (key === 'Shift') {
      return apple ? '⇧' : 'Shift'
    }
    return key
  })
}
