import type { IconName } from '../constants/icons.js'
import type { VueDrawContext } from '../composables/useVueDraw.js'

/**
 * A user command — Excalidraw's `Action`. One definition feeds every
 * surface: the keyboard dispatcher, the context menu, the panels and the
 * shortcuts dialog, so a shortcut can never be advertised without working.
 */
export interface VueDrawAction {
  label: string
  icon?: IconName
  /**
   * Key combo as displayed, one segment per key. `Mod` renders as ⌘ on
   * Apple platforms and Ctrl elsewhere; `Alt` renders as ⌥ / Alt.
   */
  keys?: readonly string[]
  /** True when a keydown should trigger this action. */
  keyTest?: (event: KeyboardEvent) => boolean
  /** Whether the action applies to the current state (defaults to true). */
  enabled?: (ctx: VueDrawContext) => boolean
  perform: (ctx: VueDrawContext) => void
  /** Destructive actions render in the danger tone. */
  danger?: boolean
}
