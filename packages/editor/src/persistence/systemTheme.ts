/**
 * Theme default resolution.
 *
 * Excalidraw detects the system color scheme on first load: the editor starts
 * dark when the browser prefers dark, and any theme the user explicitly chose
 * (persisted) wins over that default. This module owns that resolution so both
 * the shell and the persistence layer share one definition of "the theme the
 * editor should start with".
 */

import type { ThemeName } from '@opendrawjs/core'

/** A theme default as accepted on the `<OpenDraw>` component. */
export type ThemeDefault = ThemeName | 'system'

/** The media query Excalidraw consults for the system color scheme. */
const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Resolves a theme default against the browser color scheme: `'system'`
 * becomes `'dark'` or `'light'` per the media query, an explicit theme passes
 * through untouched. SSR-safe — without `matchMedia` the light theme is the
 * conservative default and the client re-resolves on hydration.
 */
export function resolveThemeDefault(theme: ThemeDefault): ThemeName {
  if (theme !== 'system') {
    return theme
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia(PREFERS_DARK_QUERY).matches ? 'dark' : 'light'
}
