import { onBeforeUnmount, onMounted } from 'vue'

import type { Point, VueDrawElement } from '@vuedraw/core'
import { elementsInGroup, moveElements, parentEditingGroupId } from '@vuedraw/core'

import { dispatchActionKey } from '../actions/registry.js'
import { isTypingTarget } from '../actions/keys.js'
import { TOOL_BY_KEY } from '../constants/tools.js'
import { finishLinearDraft } from './linearDraft.js'
import { editTextOf } from './textEntry.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * Canvas keyboard: gesture-local keys first (space-pan, finishing a
 * multi-point draft, Escape), then the shared action registry, then
 * selection nudging and tool shortcuts.
 */


const NUDGE_STEP = 2
const NUDGE_STEP_LARGE = 20

const ARROW_DIRECTIONS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

function noModifier(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
}

/** Controls that own Space/Enter themselves (activation keys). */
function isActivatable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('button, [role="button"], [role="radio"], a, select') !== null
}

/**
 * Keys are handled on the whole editor (the `.vuedraw-root` around the
 * canvas, or the canvas itself when mounted headless) — Excalidraw's
 * container-level onKeyDown — so a shortcut still works right after a
 * toolbar click moved focus onto a button.
 */
export function useCanvasKeyboard(rt: CanvasRuntime): void {
  const { ctx } = rt

  function nudge(direction: Point, large: boolean): void {
    // With a grid on, nudging steps one cell at a time.
    const step = ctx.gridSize.value ?? (large ? NUDGE_STEP_LARGE : NUDGE_STEP)
    const delta = { x: direction.x * step, y: direction.y * step }
    for (const { id, patch } of moveElements(ctx.selectedElements.value, delta)) {
      // The selection mixes element kinds, so patches are base-union typed.
      ctx.doc.updateElement<VueDrawElement>(id, patch)
    }
  }

  /**
   * Escape inside an edited group climbs one level and reselects at that
   * level (actionDeselect's parent-group walk); otherwise it deselects.
   */
  function stepOutOrDeselect(): void {
    const editing = ctx.editingGroupId.value
    if (!editing) {
      ctx.select(null)
      return
    }
    const elements = ctx.elements.value
    const selected = ctx.selectedElements.value
    const keep = selected.length > 0 ? selected : elementsInGroup(elements, editing)
    ctx.setEditingGroup(parentEditingGroupId(keep, editing))
    ctx.selectGrouped(keep.map((el) => el.id))
  }

  function onKeyDown(event: KeyboardEvent): void {
    // The text editor and other inputs handle their own keys; a nested
    // editor's own handler may also have consumed the event already.
    if (ctx.editingId.value || event.defaultPrevented || isTypingTarget(event.target)) {
      return
    }
    // A focused button keeps Space/Enter as its activation keys.
    if ((event.code === 'Space' || event.key === 'Enter') && isActivatable(event.target)) {
      return
    }
    if (event.code === 'Space') {
      if (!rt.spaceDown.value) {
        rt.spaceDown.value = true
        event.preventDefault()
      }
      return
    }
    const drafting = rt.interaction.value.kind === 'draftingLinear'
    if (event.key === 'Escape') {
      // Escape ends a multi-point draft first; otherwise it drops selection.
      if (drafting) {
        finishLinearDraft(rt)
        return
      }
      stepOutOrDeselect()
      return
    }
    if (event.key === 'Enter' && drafting) {
      finishLinearDraft(rt)
      return
    }
    // Enter on a lone text or shape starts editing its text (Excalidraw).
    const selected = ctx.selectedElements.value
    if (event.key === 'Enter' && noModifier(event) && selected.length === 1 && editTextOf(rt, selected[0]!)) {
      event.preventDefault()
      return
    }
    if (dispatchActionKey(ctx, event)) {
      return
    }
    const direction = ARROW_DIRECTIONS[event.key]
    if (direction && ctx.selectedElements.value.length > 0) {
      event.preventDefault()
      nudge(direction, event.shiftKey)
      return
    }
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
    const tool = plain ? TOOL_BY_KEY.get(event.key.toLowerCase())?.tool : undefined
    if (tool) {
      if (drafting) {
        finishLinearDraft(rt)
      }
      // The image "tool" is an insertion gesture: pressing 9 opens the
      // picker rather than parking the app in a mode, matching the toolbar.
      if (tool === 'image') {
        ctx.openImagePicker()
        return
      }
      ctx.setActiveTool(tool)
    }
  }

  // Space is tracked window-wide so a pan can start with focus anywhere.
  function onWindowKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !ctx.editingId.value) {
      rt.spaceDown.value = true
    }
  }

  function onWindowKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      rt.spaceDown.value = false
    }
  }

  let keyRoot: HTMLElement | null = null

  onMounted(() => {
    const host = rt.hostRef.value
    keyRoot = host?.closest<HTMLElement>('.vuedraw-root') ?? host
    keyRoot?.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onWindowKeyUp)
    window.addEventListener('keydown', onWindowKeyDown)
  })
  onBeforeUnmount(() => {
    keyRoot?.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onWindowKeyUp)
    window.removeEventListener('keydown', onWindowKeyDown)
  })
}
