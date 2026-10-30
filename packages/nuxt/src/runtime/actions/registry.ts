import type { VueDrawContext } from '../composables/useVueDraw.js'
import { keyIs, noMod, plainMod } from './keys.js'
import type { VueDrawAction } from './types.js'

const hasSelection = (ctx: VueDrawContext): boolean => ctx.selectedElements.value.length > 0

/**
 * Every editor command, keyed by id. Order inside the record is the
 * keyboard dispatch order: the first action whose `keyTest` matches wins.
 */
export const ACTIONS = {
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
    keyTest: (e) => plainMod(e) && keyIs(e, 'd'),
    enabled: hasSelection,
    perform: (ctx) => ctx.duplicateSelection(),
  },
  cut: {
    label: 'Cut',
    icon: 'cut',
    keys: ['Mod', 'X'],
    keyTest: (e) => plainMod(e) && keyIs(e, 'x'),
    enabled: hasSelection,
    perform: (ctx) => ctx.cutSelection(),
  },
  copy: {
    label: 'Copy',
    icon: 'copy',
    keys: ['Mod', 'C'],
    keyTest: (e) => plainMod(e) && keyIs(e, 'c'),
    enabled: hasSelection,
    perform: (ctx) => ctx.copySelection(),
  },
  paste: {
    label: 'Paste',
    icon: 'paste',
    keys: ['Mod', 'V'],
    keyTest: (e) => plainMod(e) && keyIs(e, 'v'),
    enabled: (ctx) => ctx.clipboardSize.value > 0,
    perform: (ctx) => ctx.paste(),
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
  bringForward: {
    label: 'Bring forward',
    icon: 'bringForward',
    keys: [']'],
    keyTest: (e) => noMod(e) && e.key === ']',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('forward'),
  },
  sendBackward: {
    label: 'Send backward',
    icon: 'sendBackward',
    keys: ['['],
    keyTest: (e) => noMod(e) && e.key === '[',
    enabled: hasSelection,
    perform: (ctx) => ctx.reorderSelection('backward'),
  },
} satisfies Record<string, VueDrawAction>

export type ActionId = keyof typeof ACTIONS

export function actionById(id: ActionId): VueDrawAction {
  return ACTIONS[id]
}

export function isActionEnabled(ctx: VueDrawContext, id: ActionId): boolean {
  const action: VueDrawAction = ACTIONS[id]
  return action.enabled ? action.enabled(ctx) : true
}

/** Runs an action when it applies; returns whether it ran. */
export function runAction(ctx: VueDrawContext, id: ActionId): boolean {
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
export function dispatchActionKey(ctx: VueDrawContext, event: KeyboardEvent): boolean {
  for (const id of Object.keys(ACTIONS) as ActionId[]) {
    const action: VueDrawAction = ACTIONS[id]
    if (action.keyTest?.(event)) {
      event.preventDefault()
      runAction(ctx, id)
      return true
    }
  }
  return false
}
