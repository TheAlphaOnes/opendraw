import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * llms-full.txt: the complete documentation for AI assistants — every
 * package README, as published on npm, in one plain file. Generated at
 * build time (the routes are prerendered), from the monorepo's packages.
 */
const ORDER = ['nuxt', 'react', 'svelte', 'editor', 'core'] as const

/** The README's markdown without its centered HTML banner (logo, badges, screenshot). */
function stripBanner(markdown: string): string {
  return markdown.replace(/<p align="center">[\s\S]*?<\/p>\s*/g, '').trim()
}

export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig(event).public.siteUrl as string
  const sections = await Promise.all(
    ORDER.map(async (name) => {
      const path = resolve(process.cwd(), '..', 'packages', name, 'README.md')
      try {
        return `# @opendrawjs/${name}\n\n${stripBanner(await readFile(path, 'utf8'))}`
      } catch (error) {
        throw createError({ statusCode: 500, message: `llms-full.txt: cannot read ${path}`, cause: error })
      }
    }),
  )
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `# ${SITE.name}: full documentation

> ${SITE.description} Live editor: ${siteUrl(base, '/')} · Docs: ${siteUrl(base, '/docs')} · Source: ${SITE.repository}

${sections.join('\n\n---\n\n')}
`
})
