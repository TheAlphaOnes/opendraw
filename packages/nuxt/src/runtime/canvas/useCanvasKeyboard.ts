import { onBeforeUnmount, onMounted } from 'vue'

import type { Point, ToolId, VueDrawElement } from '@vuedraw/core'
import { moveElements } from '@vuedraw/core'

import { dispatchActionKey } from '../actions/registry.js'
import { finishLinearDraft } from './linearDraft.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * Canvas keyboard: gesture-local keys first (space-pan, finishing a
 * multi-point draft, Escape), then the shared action registry, then
 * selection nudging and tool shortcuts.
 */

const TOOL_SHORTCUTS: Record<string, ToolId> = {
  '1': 'selection',
  h: 'hand',
  '2': 'rectangle',
  '3': 'diamond',
  '4': 'ellipse',
  '5': 'arrow',
  '6': 'line',
  p: 'freedraw',
  t: 'text',
  '9': 'image',
  e: 'eraser',
  f: 'frame',
  k: 'laser',
}

const NUDGE_STEP = 2
const NUDGE_STEP_LARGE = 20

const ARROW_DIRECTIONS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

export interface CanvasKeyboard {
  onKeyDown: (event: KeyboardEvent) => void
}

export function useCanvasKeyboard(rt: CanvasRuntime): CanvasKeyboard {
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

  function onKeyDown(event: KeyboardEvent): void {
    // The text editor handles its own keys.
    if (ctx.editingId.value) {
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
      ctx.select(null)
      return
    }
    if (event.key === 'Enter' && drafting) {
      finishLinearDraft(rt)
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
    const tool = event.metaKey || event.ctrlKey ? undefined : TOOL_SHORTCUTS[event.key.toLowerCase()]
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

  onMounted(() => {
    window.addEventListener('keyup', onWindowKeyUp)
    window.addEventListener('keydown', onWindowKeyDown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keyup', onWindowKeyUp)
    window.removeEventListener('keydown', onWindowKeyDown)
  })

  return { onKeyDown }
}
