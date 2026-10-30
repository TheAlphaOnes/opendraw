/**
 * The About page's questions and answers. The page renders them and its
 * FAQPage structured data is built from them, so what search engines read
 * is exactly what visitors see (a requirement for FAQ rich results).
 * Answers are plain text: they go into JSON-LD as-is.
 */

export interface FaqEntry {
  question: string
  answer: string
}

export const ABOUT_FAQ: readonly FaqEntry[] = [
  {
    question: 'What is opendraw?',
    answer:
      'opendraw is a free, open-source whiteboard for hand-drawn diagrams: shapes, arrows, text, sticky notes and freehand sketches. You can use it right here in the browser, or add it to your own app as a single component.',
  },
  {
    question: 'Is opendraw free to use?',
    answer:
      'Yes. opendraw is open source under the MIT license: free for personal and commercial projects, with the full source code on GitHub.',
  },
  {
    question: 'Which frameworks does it work with?',
    answer:
      'Vue 3, Nuxt 4, React 18 or newer, and Svelte 5, each with a native component. For anything else, the framework-free @opendrawjs/editor package runs in plain JavaScript.',
  },
  {
    question: 'Where are my drawings stored?',
    answer:
      'In your own browser. Drawings save automatically to local storage and never leave your device unless you export them as a PNG image, an SVG file or an .opendraw file.',
  },
  {
    question: 'Does it work on phones and tablets?',
    answer:
      'Yes. The layout adapts to small screens, the toolbar moves to the bottom on phones, and you can pinch to zoom and drag with two fingers to move around the canvas.',
  },
  {
    question: 'Can I change how it looks in my app?',
    answer:
      'Yes. Colors come from CSS custom properties you can override, there are light and dark themes, and you can hide the built-in toolbar and panels to build your own interface around the canvas.',
  },
  {
    question: 'Is opendraw related to Excalidraw?',
    answer:
      'opendraw is an independent project. It is inspired by Excalidraw and uses the same hand-drawn font, but it is written from scratch and is not affiliated with the Excalidraw team.',
  },
]
