/**
 * robots.txt: everything is open to crawlers, AI assistants included (they
 * read llms.txt to understand the project). Test pages opt out with a
 * noindex meta tag rather than a Disallow, so crawlers can still see it.
 */
export default defineEventHandler((event) => {
  const base = useRuntimeConfig(event).public.siteUrl as string
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI assistants and answer engines are welcome.',
    ...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'].flatMap(
      (agent) => [`User-agent: ${agent}`, 'Allow: /', ''],
    ),
    `Sitemap: ${siteUrl(base, '/sitemap.xml')}`,
    '',
  ].join('\n')
})
