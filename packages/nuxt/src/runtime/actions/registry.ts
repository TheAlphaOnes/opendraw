import { allInSameGroup } from '@opendraw/core'

import type { OpenDrawContext } from '../composables/useOpenDraw.js'
import { keyIs, noMod, plainMod } from './keys.js'
import type { OpenDrawAction } from './types.js'

/**
 * Every editor command, keyed by id, with Excalidraw's shortcut map
 * (packages/excalidraw/actions/shortcuts.ts). Order inside the record is
 * the keyboard dispatch order: the first action whose `keyTest` matches
 * wins. Chords that Alt or Shift re-map on some layouts (⌥C types "ç",
 * Shift+1 types "!") test `event.code`, the physical key.
 */

const hasSelection = (ctx: OpenDrawContext): boolean => ctx.selectedElements.value.length > 0
const hasUnlockedSelection = (ctx: OpenDrawContext): boolean =>
  ctx.selectedElements.value.some((el) => !el.locked)
const hasSelectedText = (ctx: OpenDrawContext): boolean =>
  ctx.selectedElements.value.some((el) => el.type === 'text')
/** Align needs two units to align against each other. */
const canAlign = (ctx: OpenDrawContext): boolean => ctx.selectedElements.value.length > 1
/** Distribute needs three units for a gap to equalize. */
const canDistribute = (ctx: OpenDrawContext): boolean => ctx.selectedElements.value.length > 2

/** Ctrl or ⌘, either one, with Alt — and the physical key. */
const modAlt = (e: KeyboardEvent, code: string): boolean =>
  (e.metaKey || e.ctrlKey) && e.altKey && e.code === code
/** Alt alone (Shift free) — and the physical key. */
const altOnly = (e: KeyboardEvent, code: string): boolean =>
  e.altKey && !e.metaKey && !e.ctrlKey && e.code === code
/** Ctrl/⌘ + Shift, no Alt. */
const modShift = (e: KeyboardEvent): boolean => plainMod(e) && e.shiftKey

/** The canvas center, in host-local screen px — where keyboard zoom anchors. */
function canvasCenter(ctx: OpenDrawContext): { x: number; y: number } {
  const { width, height } = ctx.viewportSize.value
  return { x: width / 2, y: height / 2 }
}

export const ACTIONS = {
  // ---------------------------------------------------------------- history
  undo: {
    label: 'Undo',
    icon: 'undo',
    keys: ['Mod', 'Z'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'z'),
    enabled: (ctx) => ctx.canUndo.value,
    perform: (ctx) => void ctx.undo(),
  },
  redo: {
    label: 'Redo',
    icon: 'redo',
    keys: ['Mod', 'Shift', 'Z'],
    keyTest: (e) => plainMod(e) && ((e.shiftKey && keyIs(e, 'z')) || keyIs(e, 'y')),
    enabled: (ctx) => ctx.canRedo.value,
    perform: (ctx) => void ctx.redo(),
  },

  // -------------------------------------------------------------- clipboard
  cut: {
    label: 'Cut',
    icon: 'cut',
    keys: ['Mod', 'X'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'x'),
    enabled: hasSelection,
    perform: (ctx) => ctx.cutSelection(),
  },
  copy: {
    label: 'Copy',
    icon: 'copy',
    keys: ['Mod', 'C'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'c'),
    enabled: hasSelection,
    perform: (ctx) => ctx.copySelection(),
  },
  paste: {
    label: 'Paste',
    icon: 'paste',
    keys: ['Mod', 'V'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'v'),
    enabled: (ctx) => ctx.clipboardSize.value > 0,
    perform: (ctx) => ctx.paste(),
  },
  copyStyles: {
    label: 'Copy styles',
    icon: 'copyStyles',
    keys: ['Mod', 'Alt', 'C'],
    keyTest: (e) => modAlt(e, 'KeyC'),
    enabled: hasSelection,
    perform: (ctx) => ctx.copyStyles(),
  },
  pasteStyles: {
    label: 'Paste styles',
    icon: 'pasteStyles',
    keys: ['Mod', 'Alt', 'V'],
    keyTest: (e) => modAlt(e, 'KeyV'),
    enabled: (ctx) => ctx.hasCopiedStyles.value && hasSelection(ctx),
    perform: (ctx) => ctx.pasteStyles(),
  },

  // -------------------------------------------------------------- selection
  selectAll: {
    label: 'Select all',
    keys: ['Mod', 'A'],
    keyTest: (e) => plainMod(e) && keyIs(e, 'a'),
    perform: (ctx) => ctx.selectAll(),
  },
  duplicate: {
    label: 'Duplicate',
    icon: 'duplicate',
    keys: ['Mod', 'D'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'd'),
    enabled: hasSelection,
    perform: (ctx) => ctx.duplicateSelection(),
  },
  deleteSelection: {
    label: 'Delete',
    icon: 'trash',
    keys: ['Del'],
    keyTest: (e) => noMod(e) && (e.key === 'Delete' || e.key === 'Backspace'),
    enabled: hasSelection,
    perform: (ctx) => ctx.deleteSelection(),
    danger: true,
  },
  toggleLock: {
    label: 'Lock / unlock',
    icon: 'lock',
    keys: ['Mod', 'Shift', 'L'],
    keyTest: (e) => modShift(e) && keyIs(e, 'l'),
    enabled: hasSelection,
    perform: (ctx) => ctx.toggleSelectionLock(),
  },

  // ----------------------------------------------------------------- groups
  group: {
    label: 'Group selection',
    icon: 'group',
    keys: ['Mod', 'G'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'g'),
    // Excalidraw's enableActionGroup: two or more elements that are not
    // already one group (at the current editing level).
    enabled: (ctx) =>
      ctx.selectedElements.value.length > 1 &&
      !allInSameGroup(ctx.selectedElements.value, ctx.editingGroupId.value),
    perform: (ctx) => ctx.groupSelection(),
  },
  ungroup: {
    label: 'Ungroup',
    icon: 'ungroup',
    keys: ['Mod', 'Shift', 'G'],
    keyTest: (e) => modShift(e) && keyIs(e, 'g'),
    enabled: (ctx) => ctx.selectedGroupIds.value.length > 0,
    perform: (ctx) => ctx.ungroupSelection(),
  },

  // ---------------------------------------------------------------- z-order
  sendBackward: {
    label: 'Send backward',
    icon: 'sendBackward',
    keys: ['Mod', '['],
    keyTest: (e) => plainMod(e) && !e.shiftKey && e.code === 'BracketLeft',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('backward'),
  },
  bringForward: {
    label: 'Bring forward',
    icon: 'bringForward',
    keys: ['Mod', ']'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && e.code === 'BracketRight',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('forward'),
  },
  // Excalidraw binds Mod+Alt on macOS and Mod+Shift elsewhere; both work here.
  sendToBack: {
    label: 'Send to back',
    icon: 'sendBack',
    keys: ['Mod', 'Shift', '['],
    keyTest: (e) => (e.metaKey || e.ctrlKey) && (e.shiftKey || e.altKey) && e.code === 'BracketLeft',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('back'),
  },
  bringToFront: {
    label: 'Bring to front',
    icon: 'bringFront',
    keys: ['Mod', 'Shift', ']'],
    keyTest: (e) => (e.metaKey || e.ctrlKey) && (e.shiftKey || e.altKey) && e.code === 'BracketRight',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('front'),
  },

  // ---------------------------------------------------------------- arrange
  alignLeft: {
    label: 'Align left',
    icon: 'alignLeftEdges',
    keys: ['Mod', 'Shift', '←'],
    keyTest: (e) => modShift(e) && e.key === 'ArrowLeft',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'x', position: 'start' }),
  },
  alignHorizontalCenter: {
    label: 'Center horizontally',
    icon: 'alignHorizontalCenters',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'x', position: 'center' }),
  },
  alignRight: {
    label: 'Align right',
    icon: 'alignRightEdges',
    keys: ['Mod', 'Shift', '→'],
    keyTest: (e) => modShift(e) && e.key === 'ArrowRight',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'x', position: 'end' }),
  },
  alignTop: {
    label: 'Align top',
    icon: 'alignTopEdges',
    keys: ['Mod', 'Shift', '↑'],
    keyTest: (e) => modShift(e) && e.key === 'ArrowUp',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'y', position: 'start' }),
  },
  alignVerticalCenter: {
    label: 'Center vertically',
    icon: 'alignVerticalCenters',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'y', position: 'center' }),
  },
  alignBottom: {
    label: 'Align bottom',
    icon: 'alignBottomEdges',
    keys: ['Mod', 'Shift', '↓'],
    keyTest: (e) => modShift(e) && e.key === 'ArrowDown',
    enabled: canAlign,
    perform: (ctx) => ctx.alignSelection({ axis: 'y', position: 'end' }),
  },
  distributeHorizontally: {
    label: 'Distribute horizontally',
    icon: 'distributeHorizontal',
    keys: ['Alt', 'H'],
    keyTest: (e) => altOnly(e, 'KeyH') && !e.shiftKey,
    enabled: canDistribute,
    perform: (ctx) => ctx.distributeSelection('x'),
  },
  distributeVertically: {
    label: 'Distribute vertically',
    icon: 'distributeVertical',
    keys: ['Alt', 'V'],
    keyTest: (e) => altOnly(e, 'KeyV') && !e.shiftKey,
    enabled: canDistribute,
    perform: (ctx) => ctx.distributeSelection('y'),
  },
  flipHorizontal: {
    label: 'Flip horizontal',
    icon: 'flipHorizontal',
    keys: ['Shift', 'H'],
    keyTest: (e) => noMod(e) && e.shiftKey && keyIs(e, 'h'),
    enabled: hasUnlockedSelection,
    perform: (ctx) => ctx.flipSelection('horizontal'),
  },
  flipVertical: {
    label: 'Flip vertical',
    icon: 'flipVertical',
    keys: ['Shift', 'V'],
    keyTest: (e) => noMod(e) && e.shiftKey && keyIs(e, 'v'),
    enabled: hasUnlockedSelection,
    perform: (ctx) => ctx.flipSelection('vertical'),
  },

  // ------------------------------------------------------------------- text
  increaseFontSize: {
    label: 'Increase font size',
    keys: ['Mod', 'Shift', '>'],
    keyTest: (e) => modShift(e) && (e.key === '>' || e.key === '.' || e.code === 'Period'),
    enabled: hasSelectedText,
    perform: (ctx) => ctx.stepFontSize(1),
  },
  decreaseFontSize: {
    label: 'Decrease font size',
    keys: ['Mod', 'Shift', '<'],
    keyTest: (e) => modShift(e) && (e.key === '<' || e.key === ',' || e.code === 'Comma'),
    enabled: hasSelectedText,
    perform: (ctx) => ctx.stepFontSize(-1),
  },

  // ------------------------------------------------------------------- view
  zoomIn: {
    label: 'Zoom in',
    icon: 'zoomIn',
    keys: ['Mod', '+'],
    keyTest: (e) => plainMod(e) && (e.key === '+' || e.key === '=' || e.code === 'Equal'),
    perform: (ctx) => ctx.zoomIn(canvasCenter(ctx)),
  },
  zoomOut: {
    label: 'Zoom out',
    icon: 'zoomOut',
    keys: ['Mod', '-'],
    keyTest: (e) => plainMod(e) && (e.key === '-' || e.code === 'Minus'),
    perform: (ctx) => ctx.zoomOut(canvasCenter(ctx)),
  },
  resetZoom: {
    label: 'Reset zoom',
    icon: 'resetZoom',
    keys: ['Mod', '0'],
    keyTest: (e) => plainMod(e) && (e.key === '0' || e.code === 'Digit0'),
    perform: (ctx) => ctx.resetZoom(),
  },
  zoomToFit: {
    label: 'Zoom to fit all elements',
    icon: 'zoomToFit',
    keys: ['Shift', '1'],
    keyTest: (e) => noMod(e) && e.shiftKey && e.code === 'Digit1',
    enabled: (ctx) => ctx.elements.value.length > 0,
    perform: (ctx) => ctx.zoomToFitAll(),
  },
  zoomToSelectionInViewport: {
    label: 'Zoom to selection',
    icon: 'zoomToSelection',
    keys: ['Shift', '2'],
    keyTest: (e) => noMod(e) && e.shiftKey && e.code === 'Digit2',
    enabled: hasSelection,
    perform: (ctx) => ctx.zoomToFitSelection('scale-down'),
  },
  zoomToSelection: {
    label: 'Fill canvas with selection',
    keys: ['Shift', '3'],
    keyTest: (e) => noMod(e) && e.shiftKey && e.code === 'Digit3',
    enabled: hasSelection,
    perform: (ctx) => ctx.zoomToFitSelection('contain'),
  },
  toggleGrid: {
    label: 'Toggle grid',
    icon: 'grid',
    keys: ['Mod', "'"],
    keyTest: (e) => plainMod(e) && (e.key === "'" || e.code === 'Quote'),
    perform: (ctx) => ctx.setGridSize(ctx.gridSize.value === null ? 20 : null),
  },
  toggleTheme: {
    label: 'Toggle dark theme',
    icon: 'moon',
    keys: ['Shift', 'Alt', 'D'],
    keyTest: (e) => altOnly(e, 'KeyD') && e.shiftKey,
    perform: (ctx) => ctx.toggleTheme(),
  },
  toolLock: {
    label: 'Keep selected tool active after drawing',
    icon: 'toolLock',
    keys: ['Q'],
    keyTest: (e) => noMod(e) && !e.shiftKey && keyIs(e, 'q'),
    perform: (ctx) => ctx.toggleToolLock(),
  },

  // ------------------------------------------------------------------ files
  saveToFile: {
    label: 'Save to file',
    icon: 'save',
    keys: ['Mod', 'S'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 's'),
    perform: (ctx) => ctx.saveToFile(),
  },
  openFile: {
    label: 'Open file',
    icon: 'open',
    keys: ['Mod', 'O'],
    keyTest: (e) => plainMod(e) && !e.shiftKey && keyIs(e, 'o'),
    perform: (ctx) => void ctx.openFile(),
  },
  exportPNG: {
    label: 'Export PNG',
    icon: 'image',
    perform: (ctx) => ctx.exportPNG(),
  },
  exportSVG: {
    label: 'Export SVG',
    icon: 'svg',
    perform: (ctx) => ctx.exportSVG(),
  },
  clearCanvas: {
    label: 'Reset the canvas',
    icon: 'clear',
    keys: ['Mod', 'Del'],
    keyTest: (e) => plainMod(e) && e.key === 'Delete',
    enabled: (ctx) => ctx.elements.value.length > 0,
    perform: (ctx) => {
      // Destructive and history-clearing in spirit: always confirm first.
      if (typeof window !== 'undefined' && window.confirm('Clear the canvas? This removes every element.')) {
        ctx.clearCanvas()
      }
    },
    danger: true,
  },
} satisfies Record<string, OpenDrawAction>

export type ActionId = keyof typeof ACTIONS

export function actionById(id: ActionId): OpenDrawAction {
  return ACTIONS[id]
}

export function isActionEnabled(ctx: OpenDrawContext, id: ActionId): boolean {
  const action: OpenDrawAction = ACTIONS[id]
  return action.enabled ? action.enabled(ctx) : true
}

/** Runs an action when it applies; returns whether it ran. */
export function runAction(ctx: OpenDrawContext, id: ActionId): boolean {
  if (!isActionEnabled(ctx, id)) {
    return false
  }
  ACTIONS[id].perform(ctx)
  return true
}

/**
 * Keyboard dispatch: the first action whose key test matches handles the
 * event — it is consumed (default prevented) even when the action does
 * not apply right now, so Mod+D never falls through to the browser's
 * bookmark dialog.
 */
export function dispatchActionKey(ctx: OpenDrawContext, event: KeyboardEvent): boolean {
  for (const id of Object.keys(ACTIONS) as ActionId[]) {
    const action: OpenDrawAction = ACTIONS[id]
    if (action.keyTest?.(event)) {
      event.preventDefault()
      runAction(ctx, id)
      return true
    }
  }
  return false
}
