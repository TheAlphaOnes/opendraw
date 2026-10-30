import { onMounted, onScopeDispose } from 'vue'

import { attachScenePersistence, type ScenePersistence, type ScenePersistenceOptions } from '@opendraw/editor'

import type { OpenDrawContext } from './useOpenDraw.js'

export type { ScenePersistence, ScenePersistenceOptions }

/**
 * Automatic localStorage persistence for a Vue-hosted editor (the editor's
 * `attachScenePersistence`, bound to the component lifecycle).
 *
 * Restore runs after hydration: the shell's data-theme attribute must match
 * the server-rendered markup, and mount hooks run before the browser can
 * dispatch any input event, so no user change can precede the restore.
 */
export function useScenePersistence(ctx: OpenDrawContext, options: ScenePersistenceOptions = {}): ScenePersistence | null {
  if (typeof window === 'undefined') {
    return null
  }
  const persistence = attachScenePersistence(ctx.editor, options)
  onMounted(persistence.restore)
  onScopeDispose(persistence.dispose)
  return persistence
}
