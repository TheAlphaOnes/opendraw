/**
 * llms.txt (llmstxt.org): a plain summary for AI assistants and answer
 * engines — what opendraw is, how to install it and where the details are.
 * llms-full.txt carries the full package documentation.
 */
export default defineEventHandler((event) => {
  const base = useRuntimeConfig(event).public.siteUrl as string
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `# ${SITE.name}

> ${SITE.name} is a free, open-source (MIT) Excalidraw-style whiteboard that embeds in web apps as a native component for Vue, Nuxt, React and Svelte. Users draw hand-drawn diagrams with shapes, arrows, text and sticky notes; developers add it with one component and control it through a typed API.

Key facts:

- Install for Nuxt or Vue: \`npm install @opendrawjs/nuxt\`, add \`modules: ['@opendrawjs/nuxt']\` to nuxt.config, then render \`<OpenDraw />\` in a container with a height. Plain Vue 3 imports from \`@opendrawjs/nuxt/vue\`.
- Install for React: \`npm install @opendrawjs/react\`, \`import '@opendrawjs/react/styles.css'\` and render \`<OpenDraw />\`.
- Install for Svelte 5: \`npm install @opendrawjs/svelte\`, \`import '@opendrawjs/svelte/styles.css'\` and render \`<OpenDraw />\`.
- It follows Excalidraw's behavior and keyboard shortcuts, but it is an independent implementation, not a fork, and not affiliated with Excalidraw. It renders natively (no iframe, no React inside Vue apps).
- Drawings autosave to the browser's localStorage. Scenes export to PNG, SVG and .opendraw JSON files.
- Written in TypeScript. Current version: ${SITE.version}. Author: ${SITE.author}. License: MIT.

Features:

${SITE.features.map((feature) => `- ${feature}`).join('\n')}

## Docs

- [Live editor](${siteUrl(base, '/')}): try opendraw in the browser
- [Documentation](${siteUrl(base, '/docs')}): installation, components, composables, theming and the editor API
- [Full documentation as text](${siteUrl(base, '/llms-full.txt')}): every package README in one file

## Packages

${PACKAGES.map((pkg) => `- [${pkg.name}](https://www.npmjs.com/package/${pkg.name}): ${pkg.summary}`).join('\n')}

## Optional

- [Source code](${SITE.repository}): the pnpm monorepo on GitHub
- [Issues](${SITE.repository}/issues): bug reports and feature requests
`
})
