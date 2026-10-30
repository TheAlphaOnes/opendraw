import { useCallback } from 'react'

import type { OpenDrawState } from '@opendraw/core'
import { OpenDraw } from '@opendraw/react'

declare global {
  interface Window {
    /** The e2e suite reads the scene through the public onChange event. */
    __opendraw?: { elements: OpenDrawState['elements']; theme: string }
  }
}

/** The React test app: the full editor filling the page. */
export function App() {
  const onChange = useCallback((state: OpenDrawState) => {
    window.__opendraw = { elements: state.elements, theme: state.appState.theme }
  }, [])

  return (
    <main className="page">
      <OpenDraw onChange={onChange} />
    </main>
  )
}
