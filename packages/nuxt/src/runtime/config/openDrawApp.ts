import type { OpenDrawElement } from '@opendrawjs/core'
import type { EditorController, ThemeDefault } from '@opendrawjs/editor'

import type { IconName } from '../constants/icons.js'
import type { OpenDrawChangeDetail } from '../composables/useOpenDraw.js'

/**
 * The one-object configuration for <OpenDrawApp>, the demo site's whole
 * layout (top-right buttons, the glowing install command, share, menu
 * links) plus the editor options and lifecycle hooks:
 *
 *   const config = defineOpenDrawConfig({
 *     links: [{ label: 'Docs', icon: 'docs', to: '/docs' }],
 *     command: { text: 'npm install my-lib', short: 'npm i my-lib' },
 *     share: true,
 *     onChange: ({ elements }) => save(elements),
 *   })
 */

/** A top-right button (Excalidraw's on-canvas style). */
export interface OpenDrawAppLink {
  label: string
  icon?: IconName
  /** In-app route (NuxtLink). */
  to?: string
  /** URL; external ones open in a new tab. */
  href?: string
  variant?: 'filled' | 'primary' | 'ghost'
  onClick?: () => void
}

/** The copyable command pill. */
export interface OpenDrawAppCommand {
  text: string
  /** Shown on laptop widths so the top row never meets the toolbar. */
  short?: string
  /** Sweeping light and breathing halo (default true). */
  glow?: boolean
  prompt?: string
}

/** Several named drawings in this browser, with a drawings sidebar. */
export interface OpenDrawAppFiles {
  /** Where the drawing index is saved (default `opendraw:files`). */
  indexKey?: string
}

/** The Share button: the platform share sheet, or copy the link. */
export interface OpenDrawAppShare {
  url?: string
  title?: string
  label?: string
}

export interface OpenDrawAppConfig {
  // --- editor -------------------------------------------------------------
  theme?: ThemeDefault
  /** Autosave: true (shared key), a storage key, or false. Ignored with `files`. */
  persist?: boolean | string
  /**
   * Many drawings instead of one: a Drawings button top-right opens a
   * sidebar to create, open, rename, duplicate and delete them, each saved
   * on its own. The scene saved before files were enabled becomes the
   * first drawing. `true` for the defaults.
   */
  files?: boolean | OpenDrawAppFiles
  grid?: boolean | number
  initialElements?: OpenDrawElement[]
  /** Fill the viewport (default) or the parent element. */
  fullscreen?: boolean

  // --- chrome -------------------------------------------------------------
  /** Top-right buttons, left to right after the command. */
  links?: OpenDrawAppLink[]
  /** The copyable command, top-right; a string is shorthand for `{ text }`. */
  command?: string | OpenDrawAppCommand
  /** The primary Share button, top-right; `true` for the defaults. */
  share?: boolean | OpenDrawAppShare
  /** Links in the main menu (docs, repository, …). */
  menuLinks?: { label: string; href: string; icon?: IconName }[]

  // --- hooks --------------------------------------------------------------
  /** The editor is mounted: drive it from outside here. */
  onReady?: (editor: EditorController) => void
  /** Every document or editor-state change. */
  onChange?: (detail: OpenDrawChangeDetail) => void
  /** The selection changed. */
  onSelect?: (ids: string[]) => void
  /** The command was copied. */
  onCopy?: (command: string) => void
  /** The link was shared or copied. */
  onShare?: (url: string) => void
}

/** Types an <OpenDrawApp> config (an identity function, like defineNuxtConfig). */
export function defineOpenDrawConfig(config: OpenDrawAppConfig): OpenDrawAppConfig {
  return config
}
