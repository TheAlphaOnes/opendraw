import type { IconName } from '../icons.js'
import type { EditorController } from '../controller.js'

/**
 * A user command, Excalidraw's `Action`. One definition feeds every
 * surface: the keyboard dispatcher, the context menu, the panels and the
 * shortcuts dialog, so a shortcut can never be advertised without working.
 */
export interface OpenDrawAction {
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
  enabled?: (ctx: EditorController) => boolean
  perform: (ctx: EditorController) => void
  /** Destructive actions render in the danger tone. */
  danger?: boolean
}
