/**
 * One call per page sets everything search engines, social previews and
 * AI assistants read: the title and description, the canonical URL, Open
 * Graph and Twitter cards (with an absolute image URL, which every
 * platform requires), robots directives and JSON-LD structured data.
 */

export interface SiteSeoOptions {
  /** Full page title; the site title when omitted. */
  title?: string
  description?: string
  /** The page's path, e.g. `/docs`. */
  path: string
  /** A file in `public/`, e.g. `/og-docs.png` (1200x630). */
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
  /** Keep the page out of search results (test and demo pages). */
  noindex?: boolean
  /** schema.org objects, without `@context`. */
  jsonLd?: Record<string, unknown>[]
}

export function useSiteSeo(options: SiteSeoOptions): void {
  const base = useRuntimeConfig().public.siteUrl as string
  const url = siteUrl(base, options.path)
  const title = options.title ?? SITE.title
  const description = options.description ?? SITE.description
  const image = siteUrl(base, options.image ?? '/og.png')
  const imageAlt = options.imageAlt ?? `${SITE.name}: ${SITE.tagline}`

  useSeoMeta({
    title,
    description,
    robots: options.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    ogType: options.type ?? 'website',
    ogSiteName: SITE.name,
    ogLocale: SITE.locale,
    ogUrl: url,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: 'image/png',
    ogImageAlt: imageAlt,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    twitterImageAlt: imageAlt,
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
    script: options.jsonLd?.length
      ? [
          {
            type: 'application/ld+json',
            // Static data built from SITE: safe to serialize as-is.
            innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@graph': options.jsonLd }),
          },
        ]
      : [],
  })
}
