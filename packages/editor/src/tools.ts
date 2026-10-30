import type { ToolId } from '@opendrawjs/core'

import type { IconName } from './icons.js'

/**
 * The tool table — Excalidraw's components/Tools.tsx: each tool's icon,
 * name and keys (letter and number). The dock, the keyboard handler and
 * the shortcuts dialog all read it, so they can never disagree.
 */
export interface ToolDefinition {
  tool: ToolId
  icon: IconName
  name: string
  /** Lower-case `event.key` values that arm the tool. */
  keys: readonly string[]
  /**
   * True for the image tool: its button is an insertion gesture that opens
   * the file picker, so it never shows a persistent active state.
   */
  opensPicker?: boolean
  /** Listed under the toolbar's "More tools" dropdown (Excalidraw's extra tools). */
  more?: boolean
}

/** Tools in Excalidraw's island order, grouped by the dock's dividers. */
export const TOOL_GROUPS: readonly (readonly ToolDefinition[])[] = [
  [
    { tool: 'hand', icon: 'hand', name: 'Hand', keys: ['h'] },
    { tool: 'selection', icon: 'selection', name: 'Selection', keys: ['1', 'v'] },
  ],
  [
    { tool: 'rectangle', icon: 'rectangle', name: 'Rectangle', keys: ['2', 'r'] },
    { tool: 'diamond', icon: 'diamond', name: 'Diamond', keys: ['3', 'd'] },
    { tool: 'ellipse', icon: 'ellipse', name: 'Ellipse', keys: ['4', 'o'] },
    { tool: 'arrow', icon: 'arrow', name: 'Arrow', keys: ['5', 'a'] },
    { tool: 'line', icon: 'line', name: 'Line', keys: ['6', 'l'] },
  ],
  [
    { tool: 'freedraw', icon: 'freedraw', name: 'Freedraw', keys: ['p', 'x', '7'] },
    { tool: 'text', icon: 'text', name: 'Text', keys: ['t', '8'] },
    { tool: 'stickynote', icon: 'stickyNoteTool', name: 'Sticky note', keys: ['n'] },
    { tool: 'image', icon: 'imageTool', name: 'Image', keys: ['9'], opensPicker: true },
    { tool: 'eraser', icon: 'eraser', name: 'Eraser', keys: ['e', '0'] },
  ],
  [
    { tool: 'frame', icon: 'frameTool', name: 'Frame tool', keys: ['f'], more: true },
    { tool: 'laser', icon: 'laserTool', name: 'Laser pointer', keys: ['k'], more: true },
  ],
]

export const TOOLS: readonly ToolDefinition[] = TOOL_GROUPS.flat()

/** `event.key` (lower-cased) → tool. */
export const TOOL_BY_KEY: ReadonlyMap<string, ToolDefinition> = new Map(
  TOOLS.flatMap((def) => def.keys.map((key) => [key, def] as const)),
)

/** "Selection (1)" — the accessible name and tooltip of a dock button. */
export function toolLabel(def: ToolDefinition): string {
  return `${def.name} (${def.keys[0]!.toUpperCase()})`
}

/**
 * The key hint a toolbar button shows in its corner: the number key when
 * the tool has one, else its letter (Excalidraw's numericKey ?? letterKey).
 */
export function toolKeyHint(def: ToolDefinition): string {
  const key = def.keys.find((k) => /^\d$/.test(k)) ?? def.keys[0]!
  return key.toUpperCase()
}
