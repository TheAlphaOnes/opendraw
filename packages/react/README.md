# @opendrawjs/react

Hand-drawn diagrams for **React**: an Excalidraw-style whiteboard with a toolbar, zoom, history, theme and autosave, built on the framework-free [`@opendrawjs/editor`](https://www.npmjs.com/package/@opendrawjs/editor).

```bash
npm install @opendrawjs/react
```

```tsx
import '@opendrawjs/react/styles.css'
import { OpenDraw } from '@opendrawjs/react'

export function Board() {
  return (
    <div style={{ height: '100vh' }}>
      <OpenDraw onChange={(state) => console.log(state.elements.length)} />
    </div>
  )
}
```

| | |
| --- | --- |
| Full editor | `<OpenDraw theme persist initialElements ui onChange>` |
| Canvas only | `<OpenDrawCanvas editor>` |
| Your own controller | `useOpenDrawEditor()` |
| Reactive state | `useEditorState(editor, (e) => e.activeTool)` |

Requires React 18.2 or newer. Full documentation: [https://github.com/TheAlphaOnes/opendraw](https://github.com/TheAlphaOnes/opendraw#readme)

MIT License
