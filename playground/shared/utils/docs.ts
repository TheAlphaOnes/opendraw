/**
 * The documentation's pages, in reading order. One list drives everything
 * that must agree: the sidebar, the previous/next links, each page's title
 * and description, the sitemap, prerendering and llms.txt. Each page is a
 * real URL, search engines index pages, not #anchors.
 */

export interface DocSection {
  /** The anchor on the page. */
  id: string
  label: string
}

export interface DocPage {
  /** URL segment after /docs ('' is /docs itself). */
  slug: string
  group: string
  /** Sidebar label. */
  label: string
  /** The page heading and the first half of its title tag. */
  title: string
  /** ~150 characters for search results. */
  description: string
  sections: readonly DocSection[]
}

export const DOC_PAGES: readonly DocPage[] = [
  {
    slug: '',
    group: 'Getting started',
    label: 'Introduction',
    title: 'Getting started',
    description:
      'Install opendraw, add the Nuxt module and render a hand-drawn whiteboard with one component. Autosave, shortcuts and the five packages explained.',
    sections: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'quick-start', label: 'Quick start' },
    ],
  },
  {
    slug: 'opendraw-app',
    group: 'Getting started',
    label: '<OpenDrawApp>',
    title: 'OpenDrawApp: a complete drawing app in one component',
    description:
      'Configure <OpenDrawApp> with one typed object: many drawings, a copyable install command, top-right links, a Share button and lifecycle hooks.',
    sections: [
      { id: 'opendraw-app', label: 'Configuration' },
      { id: 'slot-components', label: 'Slot components' },
    ],
  },
  {
    slug: 'component',
    group: 'Vue & Nuxt',
    label: '<OpenDraw>',
    title: 'The OpenDraw component',
    description:
      'Every prop, event and slot of <OpenDraw>, the Vue and Nuxt whiteboard component: theme, UI level, grid, autosave key, change and ready events.',
    sections: [
      { id: 'component', label: 'Overview' },
      { id: 'props', label: 'Props' },
      { id: 'events', label: 'Events' },
      { id: 'slots', label: 'Slots' },
    ],
  },
  {
    slug: 'composables',
    group: 'Vue & Nuxt',
    label: 'useOpenDraw() & custom UI',
    title: 'useOpenDraw() and custom UI',
    description:
      'Read and drive the whiteboard from any Vue component with useOpenDraw(), or render only the canvas and build your own toolbar around it.',
    sections: [
      { id: 'use-opendraw', label: 'useOpenDraw()' },
      { id: 'custom-ui', label: 'Custom UI' },
    ],
  },
  {
    slug: 'react-svelte',
    group: 'React & Svelte',
    label: 'React & Svelte',
    title: 'React and Svelte',
    description:
      'Use the opendraw whiteboard in React 18+ and Svelte 5: the OpenDraw component, styles, driving the editor from outside and reactive state.',
    sections: [
      { id: 'react-svelte', label: 'Overview' },
      { id: 'react', label: 'React' },
      { id: 'svelte', label: 'Svelte' },
    ],
  },
  {
    slug: 'packages',
    group: 'Packages',
    label: 'core & editor',
    title: 'The core and editor packages',
    description:
      'The framework-free engine (@opendrawjs/core) and editor (@opendrawjs/editor): scene document, history, export, commands and persistence.',
    sections: [
      { id: 'core', label: '@opendrawjs/core' },
      { id: 'editor', label: '@opendrawjs/editor' },
      { id: 'persistence', label: 'Persistence' },
    ],
  },
  {
    slug: 'adapters',
    group: 'Guides',
    label: 'Build an adapter',
    title: 'Build your own adapter',
    description:
      'Bring the opendraw whiteboard to Solid, Angular, Lit or plain JavaScript: render the surface, mount the editor and mirror its state.',
    sections: [
      { id: 'adapters', label: 'Overview' },
      { id: 'adapter-surface', label: 'The surface' },
      { id: 'adapter-vanilla', label: 'Mount' },
      { id: 'adapter-react', label: 'Mirror state' },
      { id: 'adapter-chrome', label: 'Toolbars, menus and icons' },
    ],
  },
]

export function docPath(page: DocPage): string {
  return page.slug ? `/docs/${page.slug}` : '/docs'
}

/** The page that holds an anchor, for links written before the docs were split. */
export function docPageForAnchor(id: string): DocPage | undefined {
  return DOC_PAGES.find((page) => page.sections.some((section) => section.id === id))
}
