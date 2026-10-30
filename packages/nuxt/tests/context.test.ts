import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { newRectangleElement } from '@opendrawjs/core'
import { createEditor } from '@opendrawjs/editor'

import { createOpenDrawContext } from '../src/runtime/composables/useOpenDraw.js'

describe('createOpenDrawContext, the Vue bridge over the editor', () => {
  it('re-evaluates computeds on document changes', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const ctx = createOpenDrawContext({ elements: [rect] })
    const count = computed(() => ctx.selectedElements.value.length)
    expect(count.value).toBe(0)
    ctx.select(rect.id)
    expect(count.value).toBe(1)
    expect(ctx.canUndo.value).toBe(false)
    ctx.deleteSelection()
    expect(ctx.elements.value).toHaveLength(0)
    expect(ctx.canUndo.value).toBe(true)
  })

  it('re-evaluates on editor-only changes (tool lock, clipboard)', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const ctx = createOpenDrawContext({ elements: [rect] })
    expect(ctx.toolLocked.value).toBe(false)
    ctx.toggleToolLock()
    expect(ctx.toolLocked.value).toBe(true)
    ctx.select(rect.id)
    ctx.copySelection()
    expect(ctx.clipboardSize.value).toBe(1)
  })

  it('can wrap an existing controller, sharing its state', () => {
    const editor = createEditor()
    const ctx = createOpenDrawContext(editor)
    editor.setActiveTool('rectangle')
    expect(ctx.editor).toBe(editor)
    expect(ctx.activeTool.value).toBe('rectangle')
  })
})
