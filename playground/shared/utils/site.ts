/**
 * The site's identity in one place — titles, descriptions, links and the
 * facts search engines and AI assistants are given (meta tags, JSON-LD,
 * llms.txt). Pages read from here so every surface says the same thing.
 */

export const SITE = {
  name: 'opendraw',
  title: 'opendraw — hand-drawn diagrams for Vue, Nuxt, React & Svelte',
  /** ~155 characters: what a search result shows under the title. */
  description:
    'Free, open-source hand-drawn whiteboard for your app. Draw hand-drawn diagrams with shapes, arrows, text and sticky notes — one component for Vue, Nuxt, React and Svelte.',
  tagline: 'Hand-drawn diagrams, right in your app.',
  locale: 'en_US',
  author: 'Vishnu',
  version: '0.1.0',
  themeColor: { light: '#ffffff', dark: '#121212' },
  accent: '#ea580c',
  repository: 'https://github.com/TheAlphaOnes/opendraw',
  npm: 'https://www.npmjs.com/package/@opendrawjs/nuxt',
  license: 'https://opensource.org/licenses/MIT',
  keywords: [
    'whiteboard component',
    'hand-drawn diagrams',
    'vue whiteboard',
    'nuxt whiteboard',
    'react whiteboard',
    'svelte whiteboard',
    'diagram editor',
    'canvas drawing library',
    'open source whiteboard',
  ],
  features: [
    'Shapes, arrows (sharp, curved and elbow), lines, freehand drawing, text and sticky notes',
    'Arrows that bind to shapes and follow them',
    'Frames, groups, align and distribute, layers and undo/redo',
    'Light and dark themes',
    'Many named drawings saved in the browser',
    'Export to PNG, SVG and .opendraw files',
    'Keyboard shortcuts for every tool and command',
    'Touch support with pinch to zoom',
    'Works with Vue, Nuxt, React and Svelte',
  ],
} as const

export const PACKAGES = [
  { name: '@opendrawjs/nuxt', summary: 'Nuxt and Vue: the full editor UI, components and composables.' },
  { name: '@opendrawjs/react', summary: 'React: the editor as a component, with hooks.' },
  { name: '@opendrawjs/svelte', summary: 'Svelte 5: the editor as a component, with runes.' },
  { name: '@opendrawjs/editor', summary: 'The framework-free editor, for plain JavaScript or a new adapter.' },
  { name: '@opendrawjs/core', summary: 'The engine: element model, history, rendering and export; runs in Node.' },
] as const

/** Absolute URL for a site path. */
export function siteUrl(base: string, path = '/'): string {
  return `${base.replace(/\/$/, '')}${path === '/' ? '/' : path}`
}
